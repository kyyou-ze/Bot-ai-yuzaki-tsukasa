'use strict';

const log = require('./logger');
const path = require('path');
require('dotenv').config();
const settings = require('./settings');

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
  // Terapkan override dari chat (!config) sebelum config dibaca, supaya
  // pengaturan yang disimpan lewat WhatsApp tetap berlaku setelah restart.
  settings.load();

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
    // Sticker reply: auto balas sticker + paket sticker per mood.
    stickerReplyEnabled: boolEnv(getenv('STICKER_REPLY_ENABLED', 'true'), true),
    stickerReplyChance: Math.max(
      0,
      Math.min(100, intEnv(getenv('STICKER_REPLY_CHANCE', '30'), 30))
    ),
    stickerReplyCooldownSec: Math.max(
      5,
      intEnv(getenv('STICKER_REPLY_COOLDOWN_SEC', '90'), 90)
    ),
    stickerDir: path.resolve(getenv('STICKER_DIR', 'assets/stickers')),
    // Tier 2: AI tool calling. Model boleh memilih aksi (sticker, reaksi,
    // gambar, pengingat, cari web) lewat tag khusus yang diproses bot.
    aiToolsEnabled: boolEnv(getenv('AI_TOOLS_ENABLED', 'true'), true),
    aiToolsImage: boolEnv(getenv('AI_TOOLS_IMAGE', 'true'), true),
    aiToolsSearch: boolEnv(getenv('AI_TOOLS_SEARCH', 'true'), true),
    aiToolsMax: Math.max(1, Math.min(5, intEnv(getenv('AI_TOOLS_MAX_ACTIONS', '2'), 2))),
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
    // Endpoint download video/foto sendiri (placeholder {url}).
    tiktokDlApiUrl: getenv('TIKTOK_DL_API_URL', ''),
    tiktokDlApiKey: getenv('TIKTOK_DL_API_KEY', ''),
    // Provider API cadangan anti-WAF. Cukup isi salah satu key.
    tikhubApiKey: getenv('TIKHUB_API_KEY', ''),
    tiktokApi23Url: getenv(
      'TIKTOK_API23_URL',
      'https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id={username}&count={count}'
    ),
    tiktokApi23DlUrl: getenv(
      'TIKTOK_API23_DL_URL',
      'https://tiktok-api23.p.rapidapi.com/api/post?url={url}'
    ),
    tiktokApi23Key: getenv('TIKTOK_API23_KEY', getenv('RAPIDAPI_KEY', '')),
    tiktokApi23Host: getenv('TIKTOK_API23_HOST', 'tiktok-api23.p.rapidapi.com'),
    ensigApiUrl: getenv('ENSIG_API_URL', ''),
    ensigDlUrl: getenv('ENSIG_DL_URL', ''),
    ensigApiKey: getenv('ENSIG_API_KEY', ''),
    // Rotasi proxy (pisahkan koma). Butuh paket undici.
    tiktokProxyUrls: splitKeys(getenv('TIKTOK_PROXY_URLS', '')),
    // Cookie browser TikTok opsional, mis. "tt_chain_token=...; msToken=...".
    tiktokCookie: getenv('TIKTOK_COOKIE', ''),
    // Jina Reader dipakai untuk membaca profil TikTok dari server Jina,
    // sehingga request tidak langsung dari IP bot dan tidak mudah kena WAF.
    // API key opsional; tanpa key tetap jalan dengan rate limit lebih kecil.
    tiktokJinaKey: getenv('TIKTOK_JINA_KEY', getenv('JINA_API_KEY', '')),
    tiktokJinaBase: getenv('TIKTOK_JINA_BASE', 'https://r.jina.ai/'),
    // Setelah kena 403/WAF, berhenti dulu selama N menit (default 10).
    tiktokWafCooldownMin: Math.max(1, intEnv(getenv('TIKTOK_WAF_COOLDOWN_MIN', '10'), 10)),
    // Daftar akun yang diubah via command (/addakun, /delakun).
    tiktokAccountsDb: getenv('TIKTOK_ACCOUNTS_DB', './database/accounts.json'),
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
      // Selipkan post cosplay Instagram setiap N post.
      cosplayEvery: Math.max(0, intEnv(getenv('ANIME_CHANNEL_COSPLAY_EVERY', '4'), 4)),
    },
    // Auto-post cosplay dari daftar post Instagram / RSS.
    cosplay: {
      enabled: boolEnv(getenv('COSPLAY_ENABLED', 'true'), true),
      posts: splitKeys(getenv('COSPLAY_POSTS', '')),
      rss: splitKeys(getenv('COSPLAY_RSS', '')),
      every: Math.max(0, intEnv(getenv('ANIME_CHANNEL_COSPLAY_EVERY', '4'), 4)),
    },
    // Berita anime/manga/gacha + carousel Instagram.
    news: {
      enabled: boolEnv(getenv('NEWS_ENABLED', 'true'), true),
      sources: getenv('NEWS_SOURCES', 'ann,animecorner,gematsu,siliconera'),
      // RSS tambahan, mis. RSS X/Twitter dari layanan pihak ketiga.
      xRss: splitKeys(getenv('NEWS_X_RSS', '')),
      perSource: Math.max(1, Math.min(20, intEnv(getenv('NEWS_PER_SOURCE', '8'), 8))),
      items: Math.max(1, Math.min(5, intEnv(getenv('NEWS_ITEMS', '2'), 2))),
      // Setiap N post channel, selipkan satu berita bergambar.
      every: intEnv(getenv('ANIME_CHANNEL_NEWS_EVERY', '2'), 2),
      // Setiap N berita, utamakan berita gacha.
      gachaEvery: Math.max(0, intEnv(getenv('NEWS_GACHA_EVERY', '2'), 2)),
    },
    // Moderasi grup: log, batas warn, dan durasi mute sebelum kick.
    modLogJid: getenv('MOD_LOG_JID', ''),
    warnLimit: Math.max(1, intEnv(getenv('MOD_WARN_LIMIT', '5'), 5)),
    muteMinutes: Math.max(1, intEnv(getenv('MOD_MUTE_MINUTES', '10'), 10)),
    // Jeda command berat (detik) untuk mencegah spam.
    rateLimit: {
      newsSec: Math.max(0, intEnv(getenv('RATE_NEWS_SEC', '15'), 15)),
      downloadSec: Math.max(0, intEnv(getenv('RATE_DOWNLOAD_SEC', '30'), 30)),
      channelSec: Math.max(0, intEnv(getenv('RATE_CHANNEL_SEC', '30'), 30)),
    },
  };

  let keys = splitKeys(process.env.GEMINI_API_KEYS);
  if (keys.length === 0) keys = splitKeys(process.env.GEMINI_API_KEY);
  cfg.geminiKeys = keys;

  if (keys.length === 0) {
    log.error(
      '[FATAL] Tidak ada GEMINI_API_KEYS/GEMINI_API_KEY di .env (boleh beberapa key dipisah koma).'
    );
    process.exit(1);
  }

  if (cfg.mode === 'PROD' && !cfg.sendApiKey) {
    log.warn('[WARN] MODE=PROD tapi SEND_API_KEY kosong. /send akan terbuka tanpa auth!');
  }

  // Simpan referensi cfg agar perubahan lewat chat langsung diterapkan ke
  // objek yang sedang dipakai fitur lain (tanpa restart).
  settings.bindConfig(cfg);
  return cfg;
}

module.exports = { load };
