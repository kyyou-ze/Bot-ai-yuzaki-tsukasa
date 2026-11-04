'use strict';

const path = require('path');
require('dotenv').config();

function getenv(key, def) {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : def;
}

function mustAtoi(value, def = 10) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function splitKeys(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitAccounts(raw) {
  return splitKeys(raw).map((s) => (s.startsWith('@') ? s : '@' + s));
}

function boolEnv(value, def) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return def;
}

function intEnv(value, def) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function load() {
  const sessionRaw = getenv('SESSION_DIR', getenv('SESSION_PATH', './session'));
  // Baileys menyimpan sesi sebagai folder JSON. Jika user mengisi nama file
  // (mis. session.db), ubah menjadi folder dengan nama yang jelas.
  let sessionDir = sessionRaw;
  if (/\.(db|json|sqlite|sqlite3)$/i.test(sessionDir)) {
    sessionDir = sessionDir.replace(/\.(db|json|sqlite|sqlite3)$/i, '') + '_auth';
  }

  const cfg = {
    sessionDir: path.resolve(sessionDir),
    stateDb: path.resolve(getenv('STATE_DB', 'tsukasa_state.json')),
    botName: getenv('BOT_NAME', 'Tsukasa'),
    mode: getenv('MODE', 'MANUAL').toUpperCase(),
    trigger: getenv('TRIGGER', 'tsukasa').toLowerCase(),
    // Zona waktu untuk pengingat & statistik. Offset dipakai untuk
    // mengubah "jam 15:30" menjadi waktu UTC yang tepat.
    timezone: getenv('BOT_TIMEZONE', 'Asia/Jakarta'),
    tzOffset: (() => {
      const n = parseFloat(getenv('BOT_TZ_OFFSET', '7'));
      return Number.isFinite(n) ? n : 7;
    })(),
    // Opsional: nomor WhatsApp (format internasional, mis. 628xxxx) untuk
    // pairing code. Sangat membantu di Pterodactyl yang consolenya sempit.
    pairingNumber: String(getenv('PAIRING_NUMBER', '')).replace(/\D+/g, ''),
    ownerJid: getenv('OWNER_JID', getenv('PAIRING_NUMBER', '')),
    // Pterodactyl memberi port lewat SERVER_PORT. Utamakan itu supaya
    // aplikasi selalu memakai allocation yang diberikan panel.
    port: String(process.env.SERVER_PORT || getenv('PORT', '7860')),
    host: getenv('HOST', '0.0.0.0'),
    sendApiKey: process.env.SEND_API_KEY || '',
    sendRatePerMin: mustAtoi(getenv('SEND_RATE_PER_MIN', '10'), 10),
    geminiKeys: [],
    elevenApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenVoice: getenv('ELEVENLABS_VOICE_ID', 'iWydkXKoiVtvdn4vLKp9'),
    elevenMime: getenv('ELEVENLABS_FORMAT', 'audio/ogg;codecs=opus'),
    vnMaxWords: mustAtoi(getenv('VN_MAX_WORDS', '80'), 80),
    baLinksUrl: getenv('BA_LINKS_URL', ''),
    baLinksLocal: getenv('BA_LINKS_LOCAL', 'anime/bluearchive_links.json'),
    papLinksPath: getenv('PAP_LINKS_PATH', 'anime/pap_links.json'),
    ttMaxVideo: mustAtoi(getenv('TIKTOK_MAX_VIDEO_MB', '50'), 50) * 1024 * 1024,
    ttMaxImage: mustAtoi(getenv('TIKTOK_MAX_IMAGE_MB', '5'), 5) * 1024 * 1024,
    ttMaxDoc: mustAtoi(getenv('TIKTOK_MAX_DOC_MB', '80'), 80) * 1024 * 1024,
    ttMaxSlides: mustAtoi(getenv('TIKTOK_MAX_SLIDES', '10'), 10),
    // Detector video baru + fitur verif ACC.
    tiktokMonitorEnabled: boolEnv(getenv('TIKTOK_MONITOR_ENABLED', 'true'), true),
    tiktokAccounts: splitAccounts(getenv('TIKTOK_ACCOUNTS', '@rinorstr')),
    tiktokCnKeyword: getenv('TIKTOK_CN_KEYWORD', 'ECN'),
    tiktokHashtag: getenv('TIKTOK_HASHTAG', '#margaecn'),
    tiktokCheckMin: Math.max(1, intEnv(getenv('TIKTOK_CHECK_MIN', '3'), 3)),
    tiktokNotifyJid: getenv('TIKTOK_NOTIFY_JID', ''),
    // Opsional: endpoint scraper sendiri. Gunakan placeholder {username} dan
    // {count}, mis. https://api.example.com/tiktok/user/{username}?count={count}
    tiktokApiUrl: getenv('TIKTOK_API_URL', ''),
    tiktokApiKey: getenv('TIKTOK_API_KEY', ''),
    verifDb: path.resolve(getenv('VERIF_DB', 'database/verif.json')),
    historyUpDb: path.resolve(getenv('HISTORY_UP_DB', 'database/history_up.json')),
    upTodayDb: path.resolve(getenv('UP_TODAY_DB', 'database/up_today.json')),
    seenVideosDb: path.resolve(getenv('SEEN_VIDEOS_DB', 'database/seen_videos.json')),
    // Auto-post info anime ke channel WhatsApp (bot harus admin channel).
    animeChannel: {
      enabled: boolEnv(getenv('ANIME_CHANNEL_ENABLED', 'true'), true),
      invite: getenv('ANIME_CHANNEL_INVITE', '0029VbC2pzO5K3zPHUeTud01'),
      jid: getenv('ANIME_CHANNEL_JID', ''),
      intervalMin: Math.max(5, intEnv(getenv('ANIME_CHANNEL_INTERVAL_MIN', '180'), 180)),
      maxPerDay: Math.max(1, intEnv(getenv('ANIME_CHANNEL_MAX_PER_DAY', '8'), 8)),
      sources: getenv('ANIME_CHANNEL_SOURCES', 'anilist,kitsu,animekita,jikan'),
      perSource: Math.max(1, Math.min(20, intEnv(getenv('ANIME_CHANNEL_PER_SOURCE', '8'), 8))),
      images: boolEnv(getenv('ANIME_CHANNEL_IMAGES', 'true'), true),
      translate: boolEnv(getenv('ANIME_CHANNEL_TRANSLATE', 'true'), true),
      startDelaySec: intEnv(getenv('ANIME_CHANNEL_START_DELAY_SEC', '60'), 60),
      // 0 = pakai tahun berjalan. Isi angka untuk mengizinkan anime lama.
      minYear: intEnv(getenv('ANIME_CHANNEL_MIN_YEAR', '0'), 0),
      // 0 = riwayat dedupe disimpan permanen.
      dedupeDays: intEnv(getenv('ANIME_CHANNEL_DEDUPE_DAYS', '0'), 0),
      dedupeMax: Math.max(100, intEnv(getenv('ANIME_CHANNEL_DEDUPE_MAX', '5000'), 5000)),
      // Selipkan info budaya/fakta Jejepangan setiap N post.
      japanInfo: boolEnv(getenv('ANIME_CHANNEL_JAPAN_INFO', 'true'), true),
      infoEvery: Math.max(1, intEnv(getenv('ANIME_CHANNEL_INFO_EVERY', '3'), 3)),
    },
  };

  let keys = splitKeys(process.env.GEMINI_API_KEYS);
  if (keys.length === 0) keys = splitKeys(process.env.GEMINI_API_KEY);
  cfg.geminiKeys = keys;

  if (keys.length === 0) {
    console.error(
      '[FATAL] Tidak ada GEMINI_API_KEYS/GEMINI_API_KEY di .env (boleh beberapa key dipisah koma).'
    );
    process.exit(1);
  }

  if (cfg.mode === 'PROD' && !cfg.sendApiKey) {
    console.warn('[WARN] MODE=PROD tapi SEND_API_KEY kosong. /send akan terbuka tanpa auth!');
  }

  return cfg;
}

module.exports = { load };
