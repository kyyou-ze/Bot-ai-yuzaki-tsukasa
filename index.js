'use strict';

// Sinkronkan .env dengan .env.example SEBELUM dotenv memuatnya, supaya
// variabel baru dari update langsung tersedia pada start/restart ini juga.
const { syncEnvFile } = require('./src/envsync');
const envSync = syncEnvFile();

const log = require('./src/logger');
const qrcode = require('qrcode-terminal');

if (envSync.created) {
  log.info('[ENV] .env belum ada, dibuat dari .env.example.');
} else if (envSync.added && envSync.added.length) {
  log.info(`[ENV] ${envSync.added.length} variabel baru ditambahkan dari .env.example: ${envSync.added.join(', ')}`);
} else if (envSync.disabled) {
  log.info('[ENV] Sinkronisasi .env dimatikan (ENV_SYNC_ENABLED=off).');
} else if (!envSync.ok && envSync.reason === 'no-example') {
  log.warn('[ENV] .env.example tidak ditemukan; sinkronisasi .env dilewati.');
} else if (!envSync.ok) {
  log.warn(`[ENV] Gagal menyinkronkan .env: ${envSync.reason}`);
}

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
const metrics = require('./src/metrics');
const { downloadQueue } = require('./src/downloadqueue');
const { SessionBackup } = require('./src/backup');
const { AuditLog } = require('./src/audit');
const { Promo } = require('./src/promo');
const { hardenAuthState } = require('./src/waauth');

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

/**
 * Error Baileys yang tidak fatal: query awal/presence timeout saat koneksi
 * baru dibuka. Tetap dicatat sebagai metrik, tetapi tidak perlu spam owner.
 */
function isTransientWaError(tag, message) {
  if (!/^WA(?::|$)/i.test(String(tag || ''))) return false;
  const text = String(message || '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Race normal di grup: pesan tiba sebelum SenderKey dibagikan, sehingga
  // libsignal gagal mendekripsi lalu transaksi di-rollback. WhatsApp akan
  // mengirim ulang pesan/sesi secara otomatis; bukan kegagalan bot dan tidak
  // perlu memicu notifikasi error ke owner.
  if (/no session found to decrypt message/.test(text)) return true;
  if (
    /transaction failed, rolling back/.test(text) &&
    /(decrypt|decryption|session|senderkey|sender key|forbidden)/.test(text)
  ) {
    return true;
  }
  // Media yang tidak membawa mediaKey (mis. pesan lama/sekali lihat yang sudah
  // kedaluwarsa) tidak bisa diunduh. Ini bukan kegagalan bot, jadi cukup
  // dicatat di log tanpa notifikasi ke owner.
  if (/cannot derive from empty media key/.test(text)) return true;

  if (!/(timed out|timeout)/.test(text)) return false;
  return /unexpected error in '(init queries|presence update requests)'/.test(text);
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

  // Baileys v7 adalah paket ESM. Muat lewat dynamic import agar tetap
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
  const backup = new SessionBackup(cfg);
  const audit = new AuditLog(cfg);
  const promo = new Promo(cfg);
  downloadQueue.setConcurrency(cfg.downloadQueueConcurrency);

  // Error hook: catat metrik dan kirim notifikasi ke owner dengan cooldown.
  let lastAlertAt = 0;
  let alertInFlight = false;
  log.setErrorHook(({ tag, message }) => {
    metrics.recordError(message, { tag });
    if (isTransientWaError(tag, message)) return;
    if (!cfg.healthAlertEnabled || alertInFlight || !waReady) return;
    const cooldownMs = Math.max(10, Number(cfg.healthAlertCooldownSec) || 120) * 1000;
    const now = Date.now();
    if (now - lastAlertAt < cooldownMs) return;
    const to = ownerTarget(cfg);
    if (!to) return;
    lastAlertAt = now;
    alertInFlight = true;
    const { formatDateTime } = require('./src/util');
    const text = [
      '⚠️ *Error Tsukasa*',
      `• Waktu: ${formatDateTime(now, cfg.timezone)}`,
      `• Tag: ${tag || 'APP'}`,
      `• Pesan: ${String(message || '-').slice(0, 300)}`,
      `• Total error: ${metrics.snapshot().counters.errors}`,
    ].join('\n');
    wa
      .sendText(to, text)
      .catch(() => {})
      .finally(() => {
        alertInFlight = false;
      });
  });
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
    if (key.startsWith('SESSION_BACKUP_')) {
      backup.stop();
      backup.configure(cfg);
      if (cfg.sessionBackupEnabled) backup.start();
    }
    if (key === 'DOWNLOAD_QUEUE_CONCURRENCY') {
      downloadQueue.setConcurrency(cfg.downloadQueueConcurrency);
    }
    if (
      key === 'AUDIT_LOG_ENABLED' ||
      key === 'AUDIT_LOG_PATH' ||
      key === 'AUDIT_LOG_MAX_BYTES'
    ) {
      audit.configure(cfg);
    }
  });

  const api = new HttpApi(cfg, isReady);
  api.start();
  backup.start();

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
    hardenAuthState(baileys, state, cfg.sessionDir);
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
      // Baileys v7: pulihkan sesi yang rusak dan simpan pesan terbaru
      // otomatis supaya retry dari penerima bisa dilayani.
      enableAutoSessionRecreation: true,
      enableRecentMessageCache: true,
    });

    wa.setSock(sock);
    currentSock = sock;

    // Baileys v7 mempublikasikan pasangan LID <-> nomor telepon. Simpan
    // supaya balasan chat pribadi selalu diarahkan ke alamat yang benar.
    sock.ev.on('lid-mapping.update', (mapping) => {
      if (mapping) wa.rememberLidPn(mapping.lid, mapping.pn);
    });
    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts || []) {
        if (!c || !c.lid) continue;
        const pn = c.jid || (/@s\.whatsapp\.net$/i.test(String(c.id || '')) ? c.id : '');
        if (pn) wa.rememberLidPn(c.lid, pn);
      }
    });
    sock.ev.on('messaging-history.set', (payload) => {
      for (const pair of (payload && payload.lidPnMappings) || []) {
        if (pair && pair.lid && pair.pn) wa.rememberLidPn(pair.lid, pair.pn);
      }
    });

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
      updater,
      backup,
      audit,
      promo
    );

    // Akun yang sudah diverifikasi sebelum fitur ini ada tetap ikut dipantau.
    router.verif
      .syncMonitoredAccounts()
      .then((res) => {
        if (res && res.added) {
          log.info(`[TIKTOK] ${res.added} akun verif ditambahkan ke daftar pantauan`);
        }
      })
      .catch((err) => log.error('[TIKTOK] gagal sinkron akun verif:', err.message));

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
        metrics.setGauge('waReady', 1);
        metrics.setGauge('reconnectAttempts', 0);
        metrics.setGauge('reconnectDelayMs', 0);
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        log.info(`[WA] Terhubung | ${cfg.botName} siap menerima pesan`);
        // Backup pertama setelah sesi benar-benar ada (mis. setelah pairing).
        if (cfg.sessionBackupEnabled && !backup.last) {
          backup.runNow().catch(() => {});
        }
        animeChannel.start();
        reminders.start();
        groupTools.start();
        groupGuard.start();
        tiktokMonitor.start();
        updater.start();
        promo.start();
      }

      if (connection === 'connecting') {
        waReady = false;
        metrics.setGauge('waReady', 0);
        animeChannel.stop();
        groupTools.stop();
        groupGuard.stop();
        tiktokMonitor.stop();
        updater.stop();
        promo.stop();
        log.info('[WA] Menghubungkan...');
      }

      if (connection === 'close') {
        waReady = false;
        metrics.setGauge('waReady', 0);
        animeChannel.stop();
        reminders.stop();
        groupTools.stop();
        groupGuard.stop();
        tiktokMonitor.stop();
        updater.stop();
        promo.stop();
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
        metrics.inc('reconnects');
        // Backoff eksponensial dengan jitter ±10% agar banyak bot tidak
        // reconnect serentak. Batas atas diatur RECONNECT_MAX_DELAY_SEC.
        const maxDelayMs = Math.max(5000, Number(cfg.reconnectMaxDelaySec) || 60) * 1000;
        const expDelay = Math.min(
          maxDelayMs,
          2000 * Math.pow(2, Math.max(0, reconnectAttempts - 1))
        );
        const jitter = Math.floor(expDelay * (Math.random() * 0.2 - 0.1));
        const delay = Math.max(1000, Math.min(maxDelayMs, expDelay + jitter));
        metrics.setGauge('reconnectAttempts', reconnectAttempts);
        metrics.setGauge('reconnectDelayMs', delay);
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
        metrics.inc('messages');
        metrics.setGauge('lastMessageAt', Date.now());
        // Simpan pasangan LID -> nomor telepon supaya balasan tidak dikirim
        // ke JID @lid (tidak terkirim di Baileys 6.7.x).
        wa.rememberJids(msg.key);
        // Simpan pesan masuk agar bisa dipakai saat ada retry/quote.
        messageCache.put(msg.key, msg.message);
        const chatKey = msg.key.remoteJid || msg.key.id || 'unknown';
        messageQueue.push(chatKey, () => router.handleMessage(msg));
      }
    });

    // Pengiriman yang ditolak WhatsApp muncul asinkron di sini, setelah
    // sendMessage() selesai. Catat supaya kegagalan tidak senyap.
    sock.ev.on('messages.update', (updates) => {
      for (const u of updates || []) {
        const info = (u && u.update) || {};
        const stubs = info.messageStubParameters;
        const errorStatus =
          baileys.proto &&
          baileys.proto.WebMessageInfo &&
          baileys.proto.WebMessageInfo.Status &&
          info.status === baileys.proto.WebMessageInfo.Status.ERROR;
        if (!errorStatus && !(Array.isArray(stubs) && stubs.length)) continue;
        const key = (u && u.key) || {};
        log.warn(
          `[WA] Pengiriman gagal id=${key.id || '-'} ke=${key.remoteJid || '-'} ` +
            `status=${info.status} alasan=${JSON.stringify(stubs || [])}`
        );
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
    backup.stop();
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
    backup.stop();
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
