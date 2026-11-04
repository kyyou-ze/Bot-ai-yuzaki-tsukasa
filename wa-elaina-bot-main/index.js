'use strict';

const pino = require('pino');
const qrcode = require('qrcode-terminal');

const { load } = require('./src/config');
const { Store } = require('./src/state');
const memory = require('./src/memory');
const llm = require('./src/llm');
const wa = require('./src/wa');
const { Router } = require('./src/router');
const { HttpApi } = require('./src/httpapi');
const { Reminders } = require('./src/reminders');
const { AnimeChannelPoster } = require('./src/features/animechannel');
const { GroupTools } = require('./src/features/grouptools');
const { VerifStore } = require('./src/verifstore');
const { TikTokMonitor } = require('./src/tiktokmonitor');

const logger = pino({ level: process.env.BAILEYS_LOG || 'warn' });

async function main() {
  const cfg = load();
  llm.init(cfg);
  memory.loadAll();

  // Baileys 6.7.24 adalah paket ESM. Muat lewat dynamic import agar tetap
  // kompatibel dengan aplikasi CommonJS ini (dan Node 20/22 di Pterodactyl).
  let baileys;
  try {
    baileys = await import('@whiskeysockets/baileys');
  } catch (err) {
    console.error('[FATAL] Gagal memuat @whiskeysockets/baileys:', err.message);
    process.exit(1);
  }
  wa.setBaileys(baileys);
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

  const store = new Store(cfg.stateDb);
  let waReady = false;
  const isReady = () => waReady;
  const animeChannel = new AnimeChannelPoster(cfg, store, isReady);
  const reminders = new Reminders(cfg);
  const groupTools = new GroupTools(cfg, store);
  const verifStore = new VerifStore(cfg);
  const tiktokMonitor = new TikTokMonitor(cfg, verifStore, isReady);

  const api = new HttpApi(cfg, isReady);
  api.start();

  console.log(`[BOOT] Bot ${cfg.botName} | Mode: ${cfg.mode} | Trigger: "${cfg.trigger}"`);
  console.log(`[BOOT] Session dir: ${cfg.sessionDir}`);
  console.log(`[BOOT] State file: ${cfg.stateDb}`);
  console.log(`[BOOT] HTTP: ${cfg.host || '0.0.0.0'}:${cfg.port}`);

  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let currentSock = null;
  let shuttingDown = false;

  async function startSocket() {
    // Bersihkan socket lama agar listener-nya tidak ikut memicu reconnect
    // ganda saat koneksi baru sudah aktif.
    if (currentSock) {
      try {
        currentSock.ev.removeAllListeners();
        currentSock.end(undefined);
      } catch {
        /* ignore */
      }
      currentSock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(cfg.sessionDir);
    let pairingRequested = false;

    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (err) {
      console.warn('[WA] gagal cek versi Baileys, pakai default:', err.message);
    }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Tsukasa', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: true,
      getMessage: async () => undefined,
    });

    wa.setSock(sock);
    currentSock = sock;
    const router = new Router(
      cfg,
      sock,
      isReady,
      store,
      animeChannel,
      groupTools,
      verifStore,
      tiktokMonitor
    );

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update || {};

      if (qr) {
        if (cfg.pairingNumber) {
          if (!pairingRequested) {
            pairingRequested = true;
            sock
              .requestPairingCode(cfg.pairingNumber)
              .then((code) => {
                console.log('[WA] Pairing code untuk ' + cfg.pairingNumber + ': ' + code);
                console.log('[WA] Buka WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon.');
              })
              .catch((err) => {
                console.error('[WA] Gagal minta pairing code:', err.message);
                console.log('[WA] Fallback ke QR:');
                qrcode.generate(qr, { small: true });
              });
          }
        } else {
          console.log('[WA] Scan QR berikut dengan WhatsApp (Perangkat Tertaut):');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        waReady = true;
        reconnectAttempts = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        console.log('[WA] Terhubung. Bot siap menerima pesan.');
        console.log('[READY] Tsukasa siap menerima pesan.');
        animeChannel.start();
        reminders.start();
        groupTools.start();
        tiktokMonitor.start();
      }

      if (connection === 'connecting') {
        waReady = false;
        animeChannel.stop();
        groupTools.stop();
        tiktokMonitor.stop();
        console.log('[WA] Menghubungkan...');
      }

      if (connection === 'close') {
        waReady = false;
        animeChannel.stop();
        reminders.stop();
        groupTools.stop();
        tiktokMonitor.stop();
        if (shuttingDown) return;

        const statusCode =
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output &&
          lastDisconnect.error.output.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          console.error('[WA] Sesi logout. Hapus folder sesi lalu jalankan ulang untuk scan QR.');
          process.exit(1);
        }

        reconnectAttempts += 1;
        const delay = Math.min(30000, 2000 * reconnectAttempts);
        console.warn(`[WA] Terputus (code=${statusCode || '?'}). Reconnect dalam ${delay}ms...`);
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startSocket().catch((err) => {
            console.error('[WA] reconnect gagal:', err.message);
            setTimeout(() => startSocket().catch(() => {}), 5000);
          });
        }, delay);
      }
    });

    sock.ev.on('messages.upsert', async (payload) => {
      const { messages, type } = payload || {};
      // Hanya proses pesan baru. Type "append" berasal dari sinkronisasi
      // riwayat/offline dan bisa membuat bot membalas pesan lama.
      if (type && type !== 'notify') return;
      if (!Array.isArray(messages)) return;

      for (const msg of messages) {
        try {
          await router.handleMessage(msg);
        } catch (err) {
          console.error('[ROUTER] error:', err.message);
          if (process.env.ROUTER_DEBUG === 'true') console.error(err.stack);
        }
      }
    });

    sock.ev.on('group-participants.update', async (ev) => {
      try {
        await router.handleGroupParticipantsUpdate(ev);
      } catch (err) {
        console.error('[GROUP] error:', err.message);
      }
    });
  }

  process.on('SIGINT', () => {
    shuttingDown = true;
    console.log('[BOOT] SIGINT diterima, menutup...');
    animeChannel.stop();
    groupTools.stop();
    tiktokMonitor.stop();
    try {
      wa.getSock()?.end?.(undefined);
    } catch {
      /* ignore */
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    shuttingDown = true;
    console.log('[BOOT] SIGTERM diterima, menutup...');
    animeChannel.stop();
    groupTools.stop();
    tiktokMonitor.stop();
    try {
      wa.getSock()?.end?.(undefined);
    } catch {
      /* ignore */
    }
    process.exit(0);
  });

  await startSocket();
}

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED]', err && err.message ? err.message : err);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err && err.stack ? err.stack : err);
});

main().catch((err) => {
  console.error('[FATAL]', err && err.stack ? err.stack : err);
  process.exit(1);
});
