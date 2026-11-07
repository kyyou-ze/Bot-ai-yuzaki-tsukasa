'use strict';

const log = require('./src/logger');
const qrcode = require('qrcode-terminal');

const { load } = require('./src/config');
const settings = require('./src/settings');
const { Store } = require('./src/state');
const memory = require('./src/memory');
const llm = require('./src/llm');
const wa = require('./src/wa');
const { messageCache } = require('./src/messagecache');
const { TaskQueue } = require('./src/taskqueue');
const { Router } = require('./src/router');
const { HttpApi } = require('./src/httpapi');
const { Reminders } = require('./src/reminders');
const { AnimeChannelPoster } = require('./src/features/animechannel');
const { GroupTools } = require('./src/features/grouptools');
const { GroupGuard } = require('./src/features/groupguard');
const { VerifStore } = require('./src/verifstore');
const { TikTokAccounts } = require('./src/tiktokaccounts');
const { TikTokMonitor } = require('./src/tiktokmonitor');
const { Updater } = require('./src/updater');

// Logger Baileys sudah diarahkan ke logger aplikasi (lihat src/wa.js).
const logger = wa.logger;

function ownerTarget(cfg) {
  const raw = String(
    process.env.OWNER_JID ||
      process.env.OWNER_NUMBER ||
      process.env.PAIRING_NUMBER ||
      cfg.ownerJid ||
      ''
  ).trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D+/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

async function main() {
  const cfg = load();
  llm.init(cfg);
  memory.loadAll();

  const updater = new Updater(cfg, {
    appDir: __dirname,
    notify: async (text) => {
      const to = ownerTarget(cfg);
      if (!to) return;
      try {
        await wa.sendText(to, text);
      } catch (err) {
        log.warn('[UPDATE] gagal kirim notifikasi:', err.message);
      }
    },
  });

  // Baileys 6.7.24 adalah paket ESM. Muat lewat dynamic import agar tetap
  // kompatibel dengan aplikasi CommonJS ini (dan Node 20/22 di Pterodactyl).
  let baileys;
  try {
    baileys = await import('@whiskeysockets/baileys');
  } catch (err) {
    log.error('[FATAL] Gagal memuat @whiskeysockets/baileys:', err.message);
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
  const groupGuard = new GroupGuard(cfg, store);
  const verifStore = new VerifStore(cfg);
  const tiktokAccounts = new TikTokAccounts(cfg);
  const tiktokMonitor = new TikTokMonitor(cfg, verifStore, isReady, tiktokAccounts);

  // Terapkan perubahan !config ke layanan yang sedang berjalan.
  settings.setHook((key) => {
    if (key === 'ANIME_CHANNEL_ENABLED') {
      if (cfg.animeChannel.enabled && waReady) animeChannel.start();
      else animeChannel.stop();
    }
    if (key === 'ANIME_CHANNEL_JID' || key === 'ANIME_CHANNEL_INVITE') {
      animeChannel.channelJid = '';
      animeChannel.channelName = '';
    }
    if (key === 'ANIME_CHANNEL_INTERVAL_MIN') {
      animeChannel.reschedule();
    }
    if (key === 'TIKTOK_MONITOR_ENABLED') {
      if (cfg.tiktokMonitorEnabled && waReady) tiktokMonitor.start();
      else tiktokMonitor.stop();
    }
    if (key === 'TIKTOK_CHECK_MIN') {
      if (cfg.tiktokMonitorEnabled && waReady) {
        tiktokMonitor.stop();
        tiktokMonitor.start();
      }
    }
    if (key === 'AUTO_UPDATE_ENABLED' || key === 'AUTO_UPDATE_CHECK_MIN') {
      if (waReady) updater.reschedule();
      else updater.stop();
    }
  });

  const api = new HttpApi(cfg, isReady);
  api.start();

  log.info(`[BOOT] ${cfg.botName} | mode ${cfg.mode} | trigger "${cfg.trigger}"`);
  log.info(
    `[BOOT] session ${cfg.sessionDir} | state ${cfg.stateDb} | http ${
      cfg.host || '0.0.0.0'
    }:${cfg.port}`
  );

  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let currentSock = null;
  let shuttingDown = false;

  const messageQueue = new TaskQueue({
    concurrency: Math.max(1, Number(process.env.MSG_CONCURRENCY) || 4),
    onError: (err) => {
      log.error('[ROUTER] error:', err);
      if (process.env.ROUTER_DEBUG === 'true') log.error('[ROUTER] stack:', err.stack);
    },
  });

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
      log.warn('[WA] gagal cek versi Baileys, pakai default:', err.message);
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
      getMessage: async (key) => messageCache.get(key),
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
      tiktokMonitor,
      tiktokAccounts,
      groupGuard,
      updater
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
                log.info('[WA] Pairing code untuk ' + cfg.pairingNumber + ': ' + code);
                log.info('[WA] Buka WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon.');
              })
              .catch((err) => {
                log.error('[WA] Gagal minta pairing code:', err.message);
                log.info('[WA] Fallback ke QR:');
                qrcode.generate(qr, { small: true });
              });
          }
        } else {
          log.info('[WA] Scan QR berikut dengan WhatsApp (Perangkat Tertaut):');
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
        log.info(`[WA] Terhubung | ${cfg.botName} siap menerima pesan`);
        animeChannel.start();
        reminders.start();
        groupTools.start();
        groupGuard.start();
        tiktokMonitor.start();
        updater.start();
      }

      if (connection === 'connecting') {
        waReady = false;
        animeChannel.stop();
        groupTools.stop();
        groupGuard.stop();
        tiktokMonitor.stop();
        updater.stop();
        log.info('[WA] Menghubungkan...');
      }

      if (connection === 'close') {
        waReady = false;
        animeChannel.stop();
        reminders.stop();
        groupTools.stop();
        groupGuard.stop();
        tiktokMonitor.stop();
        updater.stop();
        if (shuttingDown) return;

        const statusCode =
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output &&
          lastDisconnect.error.output.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          log.error('[WA] Sesi logout. Hapus folder sesi lalu jalankan ulang untuk scan QR.');
          process.exit(1);
        }

        reconnectAttempts += 1;
        const delay = Math.min(30000, 2000 * reconnectAttempts);
        log.warn(`[WA] Terputus (code=${statusCode || '?'}). Reconnect dalam ${delay}ms...`);
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startSocket().catch((err) => {
            log.error('[WA] reconnect gagal:', err.message);
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
        if (!msg || !msg.key || !msg.message) continue;
        // Simpan pesan masuk agar bisa dipakai saat ada retry/quote.
        messageCache.put(msg.key, msg.message);
        const chatKey = msg.key.remoteJid || msg.key.id || 'unknown';
        messageQueue.push(chatKey, () => router.handleMessage(msg));
      }
    });

    sock.ev.on('group-participants.update', async (ev) => {
      try {
        await router.handleGroupParticipantsUpdate(ev);
      } catch (err) {
        log.error('[GROUP] error:', err.message);
      }
    });
  }

  process.on('SIGINT', () => {
    shuttingDown = true;
    log.info('[BOOT] SIGINT | menutup...');
    animeChannel.stop();
    groupTools.stop();
    groupGuard.stop();
    tiktokMonitor.stop();
    updater.stop();
    try {
      wa.getSock()?.end?.(undefined);
    } catch {
      /* ignore */
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    shuttingDown = true;
    log.info('[BOOT] SIGTERM | menutup...');
    animeChannel.stop();
    groupTools.stop();
    groupGuard.stop();
    tiktokMonitor.stop();
    updater.stop();
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
  log.error('[UNHANDLED]', err || 'promise ditolak tanpa alasan');
});

process.on('uncaughtException', (err) => {
  log.error('[UNCAUGHT]', err);
});

main().catch((err) => {
  log.error('[FATAL]', err);
  process.exit(1);
});
