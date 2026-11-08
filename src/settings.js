'use strict';

const path = require('path');
const log = require('./logger');
const { atomicWriteJson, safeReadJson } = require('./util');

// Pengaturan runtime yang bisa diubah lewat chat WhatsApp (khusus owner).
// Nilai disimpan di database/settings.json lalu diterapkan ke process.env dan
// ke objek cfg yang sedang berjalan, jadi tidak perlu restart bot.
const SETTINGS_FILE = path.resolve(process.env.SETTINGS_DB || 'database/settings.json');

const NEWS_SOURCE_KEYS = ['ann', 'interest', 'animecorner', 'gematsu', 'siliconera'];
const ANIME_SOURCE_KEYS = ['anilist', 'kitsu', 'animekita', 'jikan'];

function boolValue(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'aktif', 'nyala', 'aktifkan'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'mati', 'nonaktif', 'nonaktifkan'].includes(v)) return false;
  return null;
}

function intValue(raw, def) {
  const s = String(raw ?? '').trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  if (n < def.min || n > def.max) return null;
  return n;
}

function splitList(raw) {
  return String(raw ?? '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeJid(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.includes('@')) return s;
  const digits = s.replace(/\D+/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function normalizeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) throw new Error('URL kosong');
  let url;
  try {
    url = new URL(s);
  } catch {
    throw new Error(`URL tidak valid: ${s}`);
  }
  if (!/^https?:$/i.test(url.protocol)) throw new Error('URL harus http/https');
  return url.toString();
}

function normalizeInstagram(raw) {
  // Lazy require agar modul settings tetap ringan saat boot.
  const instagram = require('./instagram');
  const url = instagram.normalizePostUrl(raw);
  if (!url) throw new Error(`Link Instagram tidak valid: ${raw}`);
  return url;
}

function normalizeItem(def, raw) {
  const s = String(raw ?? '').trim();
  if (!s) throw new Error('Nilai kosong');
  switch (def.item) {
    case 'instagram':
      return normalizeInstagram(s);
    case 'url':
      return normalizeUrl(s);
    case 'newsSource': {
      const key = s.toLowerCase();
      if (!NEWS_SOURCE_KEYS.includes(key)) {
        throw new Error(`Sumber berita tidak dikenal. Pilihan: ${NEWS_SOURCE_KEYS.join(', ')}`);
      }
      return key;
    }
    case 'animeSource': {
      const key = s.toLowerCase();
      if (!ANIME_SOURCE_KEYS.includes(key)) {
        throw new Error(`Sumber anime tidak dikenal. Pilihan: ${ANIME_SOURCE_KEYS.join(', ')}`);
      }
      return key;
    }
    case 'jid':
      return normalizeJid(s);
    default:
      if (/[\r\n]/.test(s)) throw new Error('Nilai tidak boleh mengandung baris baru');
      return s;
  }
}

function parseValue(def, raw) {
  switch (def.type) {
    case 'bool': {
      const v = boolValue(raw);
      if (v === null) throw new Error('Gunakan on/off (atau true/false)');
      return v;
    }
    case 'int': {
      const v = intValue(raw, def);
      if (v === null) {
        throw new Error(`Harus angka bulat antara ${def.min} dan ${def.max}`);
      }
      return v;
    }
    case 'list': {
      const list = splitList(raw).map((item) => normalizeItem(def, item));
      if (!list.length && !def.allowEmpty) throw new Error('Daftar tidak boleh kosong');
      return [...new Set(list)];
    }
    case 'enum': {
      const v = String(raw ?? '').trim().toLowerCase();
      if (!def.values.includes(v)) {
        throw new Error(`Pilihan: ${def.values.join(', ')}`);
      }
      return v;
    }
    case 'string':
    default: {
      const s = String(raw ?? '').trim();
      if (!s && !def.allowEmpty) throw new Error('Nilai tidak boleh kosong');
      if (/[\r\n]/.test(s)) throw new Error('Nilai tidak boleh mengandung baris baru');
      if (def.item === 'jid') return normalizeJid(s);
      if (s.length > (def.maxLength || 500)) throw new Error('Nilai terlalu panjang');
      return s;
    }
  }
}

function serialize(def, value) {
  if (def.type === 'bool') return value ? 'true' : 'false';
  if (def.type === 'int') return String(value);
  if (def.type === 'list') return value.join(',');
  return String(value ?? '');
}

function typedFromRaw(def, raw) {
  if (raw === undefined || raw === null || raw === '') {
    if (def.defaultTyped !== undefined) return def.defaultTyped;
    if (def.type === 'bool') return Boolean(def.default);
    if (def.type === 'int') return Number(def.default) || 0;
    if (def.type === 'list') {
      return Array.isArray(def.default) ? def.default.slice() : splitList(def.default);
    }
    return String(def.default ?? '');
  }
  if (def.type === 'bool') {
    const v = boolValue(raw);
    return v === null ? def.defaultTyped : v;
  }
  if (def.type === 'int') {
    const v = intValue(raw, def);
    return v === null ? def.defaultTyped : v;
  }
  if (def.type === 'list') {
    try {
      return splitList(raw).map((item) => normalizeItem(def, item));
    } catch {
      return def.defaultTyped;
    }
  }
  if (def.type === 'enum') {
    const v = String(raw).trim().toLowerCase();
    return def.values.includes(v) ? v : def.defaultTyped;
  }
  if (def.item === 'jid') return normalizeJid(raw);
  return String(raw).trim();
}

// ---------- Skema ----------
const DEFS = [
  // --- Cosplay ---
  {
    key: 'COSPLAY_ENABLED',
    group: 'cosplay',
    label: 'Aktifkan auto-post cosplay',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.cosplay.enabled = v;
    },
  },
  {
    key: 'COSPLAY_POSTS',
    group: 'cosplay',
    label: 'Daftar URL post Instagram cosplay',
    type: 'list',
    item: 'instagram',
    default: [],
    allowEmpty: true,
    apply: (cfg, v) => {
      cfg.cosplay.posts = v;
    },
  },
  {
    key: 'COSPLAY_RSS',
    group: 'cosplay',
    label: 'Daftar RSS berisi tautan cosplay',
    type: 'list',
    item: 'url',
    default: [],
    allowEmpty: true,
    apply: (cfg, v) => {
      cfg.cosplay.rss = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_COSPLAY_EVERY',
    group: 'cosplay',
    label: 'Selipkan cosplay setiap N post channel (0 = nonaktif)',
    type: 'int',
    min: 0,
    max: 50,
    default: 4,
    apply: (cfg, v) => {
      cfg.animeChannel.cosplayEvery = v;
      cfg.cosplay.every = v;
    },
  },

  // --- Berita ---
  {
    key: 'NEWS_ENABLED',
    group: 'news',
    label: 'Aktifkan fitur berita',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.news.enabled = v;
    },
  },
  {
    key: 'NEWS_SOURCES',
    group: 'news',
    label: `Sumber RSS berita (${NEWS_SOURCE_KEYS.join(', ')})`,
    type: 'list',
    item: 'newsSource',
    default: ['ann', 'animecorner', 'gematsu', 'siliconera'],
    apply: (cfg, v) => {
      cfg.news.sources = v.join(',');
    },
  },
  {
    key: 'NEWS_X_RSS',
    group: 'news',
    label: 'RSS tambahan untuk sumber X/Twitter',
    type: 'list',
    item: 'url',
    default: [],
    allowEmpty: true,
    apply: (cfg, v) => {
      cfg.news.xRss = v;
    },
  },
  {
    key: 'NEWS_PER_SOURCE',
    group: 'news',
    label: 'Kandidat berita per sumber',
    type: 'int',
    min: 1,
    max: 20,
    default: 8,
    apply: (cfg, v) => {
      cfg.news.perSource = v;
    },
  },
  {
    key: 'NEWS_ITEMS',
    group: 'news',
    label: 'Jumlah berita per !news',
    type: 'int',
    min: 1,
    max: 5,
    default: 2,
    apply: (cfg, v) => {
      cfg.news.items = v;
    },
  },
  {
    key: 'NEWS_GACHA_EVERY',
    group: 'news',
    label: 'Prioritaskan berita gacha setiap N (0 = nonaktif)',
    type: 'int',
    min: 0,
    max: 50,
    default: 2,
    apply: (cfg, v) => {
      cfg.news.gachaEvery = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_NEWS_EVERY',
    group: 'news',
    label: 'Selipkan berita bergambar setiap N post channel (0 = nonaktif)',
    type: 'int',
    min: 0,
    max: 50,
    default: 2,
    apply: (cfg, v) => {
      cfg.news.every = v;
    },
  },
  {
    key: 'NEWS_CACHE_MIN',
    group: 'news',
    label: 'Cache RSS berita (menit, 0 = tanpa cache)',
    type: 'int',
    min: 0,
    max: 1440,
    default: 10,
  },
  {
    key: 'NEWS_REPOST_TTL_MIN',
    group: 'news',
    label: 'Anti-repost berita per chat (menit)',
    type: 'int',
    min: 5,
    max: 43200,
    default: 720,
  },

  // --- Channel anime ---
  {
    key: 'ANIME_CHANNEL_ENABLED',
    group: 'channel',
    label: 'Aktifkan auto-post ke channel',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.animeChannel.enabled = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_JID',
    group: 'channel',
    label: 'JID channel langsung (kosongkan untuk pakai invite)',
    type: 'string',
    item: 'jid',
    allowEmpty: true,
    default: '',
    apply: (cfg, v) => {
      cfg.animeChannel.jid = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_INVITE',
    group: 'channel',
    label: 'Kode/URL invite channel',
    type: 'string',
    default: '0029VbC2pzO5K3zPHUeTud01',
    apply: (cfg, v) => {
      cfg.animeChannel.invite = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_INTERVAL_MIN',
    group: 'channel',
    label: 'Interval auto-post (menit)',
    type: 'int',
    min: 5,
    max: 10080,
    default: 180,
    apply: (cfg, v) => {
      cfg.animeChannel.intervalMin = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_MAX_PER_DAY',
    group: 'channel',
    label: 'Batas post per hari',
    type: 'int',
    min: 1,
    max: 100,
    default: 8,
    apply: (cfg, v) => {
      cfg.animeChannel.maxPerDay = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_SOURCES',
    group: 'channel',
    label: `Sumber info anime (${ANIME_SOURCE_KEYS.join(', ')})`,
    type: 'list',
    item: 'animeSource',
    default: ['anilist', 'kitsu', 'animekita', 'jikan'],
    apply: (cfg, v) => {
      cfg.animeChannel.sources = v.join(',');
    },
  },
  {
    key: 'ANIME_CHANNEL_PER_SOURCE',
    group: 'channel',
    label: 'Kandidat anime per sumber',
    type: 'int',
    min: 1,
    max: 20,
    default: 8,
    apply: (cfg, v) => {
      cfg.animeChannel.perSource = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_IMAGES',
    group: 'channel',
    label: 'Kirim gambar cover',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.animeChannel.images = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_TRANSLATE',
    group: 'channel',
    label: 'Terjemahkan sinopsis ke Indonesia',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.animeChannel.translate = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_JAPAN_INFO',
    group: 'channel',
    label: 'Selipkan info budaya/fakta Jejepangan',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.animeChannel.japanInfo = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_INFO_EVERY',
    group: 'channel',
    label: 'Info Jejepangan setiap N post',
    type: 'int',
    min: 1,
    max: 50,
    default: 3,
    apply: (cfg, v) => {
      cfg.animeChannel.infoEvery = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_MIN_YEAR',
    group: 'channel',
    label: 'Tahun rilis minimum (0 = tahun berjalan)',
    type: 'int',
    min: 0,
    max: 2100,
    default: 0,
    apply: (cfg, v) => {
      cfg.animeChannel.minYear = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_DEDUPE_DAYS',
    group: 'channel',
    label: 'Masa simpan dedupe (hari, 0 = permanen)',
    type: 'int',
    min: 0,
    max: 3650,
    default: 0,
    apply: (cfg, v) => {
      cfg.animeChannel.dedupeDays = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_DEDUPE_MAX',
    group: 'channel',
    label: 'Batas entri dedupe',
    type: 'int',
    min: 100,
    max: 100000,
    default: 5000,
    apply: (cfg, v) => {
      cfg.animeChannel.dedupeMax = v;
    },
  },
  {
    key: 'ANIME_CHANNEL_START_DELAY_SEC',
    group: 'channel',
    label: 'Jeda post pertama setelah bot tersambung (detik)',
    type: 'int',
    min: 0,
    max: 3600,
    default: 60,
    apply: (cfg, v) => {
      cfg.animeChannel.startDelaySec = v;
    },
  },

  // --- Moderasi ---
  {
    key: 'MOD_LOG_JID',
    group: 'moderation',
    label: 'JID tujuan log moderasi (kosong = owner)',
    type: 'string',
    item: 'jid',
    allowEmpty: true,
    default: '',
    apply: (cfg, v) => {
      cfg.modLogJid = v;
    },
  },
  {
    key: 'MOD_WARN_LIMIT',
    group: 'moderation',
    label: 'Batas peringatan sebelum kick',
    type: 'int',
    min: 1,
    max: 20,
    default: 5,
    apply: (cfg, v) => {
      cfg.warnLimit = v;
    },
  },
  {
    key: 'MOD_MUTE_MINUTES',
    group: 'moderation',
    label: 'Durasi mute sebelum kick (menit)',
    type: 'int',
    min: 1,
    max: 1440,
    default: 10,
    apply: (cfg, v) => {
      cfg.muteMinutes = v;
    },
  },

  // --- Rate limit ---
  {
    key: 'RATE_NEWS_SEC',
    group: 'rate',
    label: 'Jeda !news/!cosplay per chat (detik)',
    type: 'int',
    min: 0,
    max: 3600,
    default: 15,
    apply: (cfg, v) => {
      cfg.rateLimit.newsSec = v;
    },
  },
  {
    key: 'RATE_DOWNLOAD_SEC',
    group: 'rate',
    label: 'Jeda unduh episode per chat (detik)',
    type: 'int',
    min: 0,
    max: 3600,
    default: 30,
    apply: (cfg, v) => {
      cfg.rateLimit.downloadSec = v;
    },
  },
  {
    key: 'RATE_CHANNEL_SEC',
    group: 'rate',
    label: 'Jeda post manual ke channel per chat (detik)',
    type: 'int',
    min: 0,
    max: 3600,
    default: 30,
    apply: (cfg, v) => {
      cfg.rateLimit.channelSec = v;
    },
  },

  // --- Unduhan anime ---
  {
    key: 'ANIME_DL_CONCURRENCY',
    group: 'anime',
    label: 'Jumlah unduhan episode paralel',
    type: 'int',
    min: 1,
    max: 5,
    default: 1,
  },
  {
    key: 'ANIME_EP_MAX_MB',
    group: 'anime',
    label: 'Batas ukuran episode (MB)',
    type: 'int',
    min: 10,
    max: 2000,
    default: 190,
  },
  {
    key: 'ANIME_EP_TIMEOUT_SEC',
    group: 'anime',
    label: 'Timeout unduh episode (detik)',
    type: 'int',
    min: 30,
    max: 3600,
    default: 240,
  },

  // --- Detector TikTok ---
  {
    key: 'TIKTOK_MONITOR_ENABLED',
    group: 'tiktok',
    label: 'Aktifkan detector TikTok',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.tiktokMonitorEnabled = v;
    },
  },
  {
    key: 'TIKTOK_CHECK_MIN',
    group: 'tiktok',
    label: 'Interval cek detector (menit)',
    type: 'int',
    min: 1,
    max: 1440,
    default: 3,
    apply: (cfg, v) => {
      cfg.tiktokCheckMin = v;
    },
  },
  {
    key: 'TIKTOK_NOTIFY_JID',
    group: 'tiktok',
    label: 'JID tujuan notifikasi detector',
    type: 'string',
    item: 'jid',
    allowEmpty: true,
    default: '',
    apply: (cfg, v) => {
      cfg.tiktokNotifyJid = v;
    },
  },
  {
    key: 'TIKTOK_CN_KEYWORD',
    group: 'tiktok',
    label: 'Keyword CN pada bio',
    type: 'string',
    default: 'ECN',
    apply: (cfg, v) => {
      cfg.tiktokCnKeyword = v;
    },
  },
  {
    key: 'TIKTOK_HASHTAG',
    group: 'tiktok',
    label: 'Hashtag yang dipantau',
    type: 'string',
    default: '#margaecn',
    apply: (cfg, v) => {
      cfg.tiktokHashtag = v;
    },
  },
  {
    key: 'TIKTOK_WAF_COOLDOWN_MIN',
    group: 'tiktok',
    label: 'Cooldown setelah kena WAF (menit)',
    type: 'int',
    min: 1,
    max: 1440,
    default: 10,
    apply: (cfg, v) => {
      cfg.tiktokWafCooldownMin = v;
    },
  },
  {
    key: 'TIKTOK_MAX_VIDEO_MB',
    group: 'tiktok',
    label: 'Batas video TikTok (MB)',
    type: 'int',
    min: 1,
    max: 500,
    default: 50,
    apply: (cfg, v) => {
      cfg.ttMaxVideo = v * 1024 * 1024;
    },
  },
  {
    key: 'TIKTOK_MAX_IMAGE_MB',
    group: 'tiktok',
    label: 'Batas gambar TikTok (MB)',
    type: 'int',
    min: 1,
    max: 500,
    default: 5,
    apply: (cfg, v) => {
      cfg.ttMaxImage = v * 1024 * 1024;
    },
  },
  {
    key: 'TIKTOK_MAX_DOC_MB',
    group: 'tiktok',
    label: 'Batas dokumen TikTok (MB)',
    type: 'int',
    min: 1,
    max: 500,
    default: 80,
    apply: (cfg, v) => {
      cfg.ttMaxDoc = v * 1024 * 1024;
    },
  },
  {
    key: 'TIKTOK_MAX_SLIDES',
    group: 'tiktok',
    label: 'Batas jumlah slide foto TikTok',
    type: 'int',
    min: 1,
    max: 50,
    default: 10,
    apply: (cfg, v) => {
      cfg.ttMaxSlides = v;
    },
  },

  // --- Sticker reply ---
  {
    key: 'STICKER_REPLY_ENABLED',
    group: 'sticker',
    label: 'Aktifkan auto balas sticker',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.stickerReplyEnabled = v;
    },
  },
  {
    key: 'STICKER_REPLY_CHANCE',
    group: 'sticker',
    label: 'Peluang auto balas sticker (%)',
    type: 'int',
    min: 0,
    max: 100,
    default: 30,
    apply: (cfg, v) => {
      cfg.stickerReplyChance = v;
    },
  },
  {
    key: 'STICKER_REPLY_COOLDOWN_SEC',
    group: 'sticker',
    label: 'Cooldown auto sticker per chat (detik)',
    type: 'int',
    min: 5,
    max: 86400,
    default: 90,
    apply: (cfg, v) => {
      cfg.stickerReplyCooldownSec = v;
    },
  },
  {
    key: 'STICKER_DIR',
    group: 'sticker',
    label: 'Folder sticker pack',
    type: 'string',
    default: 'assets/stickers',
    apply: (cfg, v) => {
      cfg.stickerDir = path.resolve(v);
    },
  },

  // --- AI tools (Tier 2) ---
  {
    key: 'AI_TOOLS_ENABLED',
    group: 'ai',
    label: 'Aktifkan AI memilih aksi (sticker/reaksi/gambar/pengingat/cari)',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.aiToolsEnabled = v;
    },
  },
  {
    key: 'AI_TOOLS_MAX_ACTIONS',
    group: 'ai',
    label: 'Maksimal aksi AI per balasan',
    type: 'int',
    min: 1,
    max: 5,
    default: 2,
    apply: (cfg, v) => {
      cfg.aiToolsMax = v;
    },
  },
  {
    key: 'AI_TOOLS_IMAGE',
    group: 'ai',
    label: 'Izinkan AI membuat gambar',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.aiToolsImage = v;
    },
  },
  {
    key: 'AI_TOOLS_SEARCH',
    group: 'ai',
    label: 'Izinkan AI mencari di web',
    type: 'bool',
    default: true,
    apply: (cfg, v) => {
      cfg.aiToolsSearch = v;
    },
  },

  // --- Auto-update dari GitHub ---
  {
    key: 'AUTO_UPDATE_ENABLED',
    group: 'update',
    label: 'Aktifkan auto-update dari GitHub',
    type: 'bool',
    default: false,
  },
  {
    key: 'AUTO_UPDATE_CHECK_MIN',
    group: 'update',
    label: 'Interval cek update GitHub (menit)',
    type: 'int',
    min: 1,
    max: 1440,
    default: 10,
  },
  {
    key: 'UPDATE_BRANCH',
    group: 'update',
    label: 'Branch GitHub yang dipantau',
    type: 'string',
    default: 'main',
  },
  {
    key: 'UPDATE_REMOTE',
    group: 'update',
    label: 'Nama remote git (biasanya origin)',
    type: 'string',
    default: 'origin',
  },
  {
    key: 'GITHUB_USER',
    group: 'update',
    label: 'Username GitHub pemilik repo',
    type: 'string',
    allowEmpty: true,
    default: '',
  },
  {
    key: 'GITHUB_REPO',
    group: 'update',
    label: 'Nama repository GitHub',
    type: 'string',
    allowEmpty: true,
    default: '',
  },
  {
    key: 'GITHUB_TOKEN',
    group: 'update',
    label: 'Token GitHub (opsional, untuk repo privat)',
    type: 'string',
    allowEmpty: true,
    secret: true,
    default: '',
  },
  {
    key: 'PTERO_URL',
    group: 'update',
    label: 'URL panel Pterodactyl (tanpa / di akhir)',
    type: 'string',
    allowEmpty: true,
    default: '',
  },
  {
    key: 'PTERO_CLIENT_KEY',
    group: 'update',
    label: 'Client API key Pterodactyl (ptlc_...)',
    type: 'string',
    allowEmpty: true,
    secret: true,
    default: '',
  },
  {
    key: 'PTERO_SERVER_ID',
    group: 'update',
    label: 'ID server Pterodactyl (8 karakter)',
    type: 'string',
    allowEmpty: true,
    default: '',
  },
  {
    key: 'AUTO_UPDATE_RESTART_MODE',
    group: 'update',
    label: 'Cara restart setelah update',
    type: 'enum',
    values: ['api', 'exit', 'none'],
    default: 'api',
  },
];

const BY_KEY = new Map();
for (const def of DEFS) {
  def.defaultTyped = typedFromRaw(def, def.default);
  BY_KEY.set(def.key, def);
}

const GROUPS = {
  cosplay: 'Cosplay',
  news: 'Berita',
  channel: 'Channel Anime',
  moderation: 'Moderasi',
  rate: 'Rate Limit',
  anime: 'Unduhan Anime',
  tiktok: 'Detector TikTok',
  sticker: 'Sticker Reply',
  ai: 'AI Tools',
  update: 'Auto Update',
};

let overrides = {};
let baseEnv = {};
let loaded = false;
let cfgRef = null;
let applyHook = null;

function file() {
  return SETTINGS_FILE;
}

function save() {
  const clean = {};
  for (const def of DEFS) {
    if (Object.prototype.hasOwnProperty.call(overrides, def.key)) {
      clean[def.key] = overrides[def.key];
    }
  }
  try {
    atomicWriteJson(file(), clean);
  } catch (err) {
    log.warn('[SETTINGS] gagal menyimpan override:', err.message);
  }
}

function load() {
  if (loaded) return overrides;
  loaded = true;
  for (const def of DEFS) baseEnv[def.key] = process.env[def.key];

  const raw = safeReadJson(file(), null);
  overrides = {};
  if (raw && typeof raw === 'object') {
    for (const def of DEFS) {
      if (!Object.prototype.hasOwnProperty.call(raw, def.key)) continue;
      const value = String(raw[def.key] ?? '').trim();
      try {
        const typed = parseValue(def, value);
        overrides[def.key] = serialize(def, typed);
        process.env[def.key] = overrides[def.key];
      } catch {
        // Abaikan nilai lama yang tidak valid supaya bot tetap bisa boot.
      }
    }
  }
  return overrides;
}

function bindConfig(cfg) {
  cfgRef = cfg || null;
}

function setHook(fn) {
  applyHook = typeof fn === 'function' ? fn : null;
}

function isKnown(key) {
  return BY_KEY.has(String(key || '').toUpperCase());
}

function getDef(key) {
  return BY_KEY.get(String(key || '').toUpperCase()) || null;
}

function currentTyped(def) {
  const raw = process.env[def.key];
  if (raw === undefined) return def.defaultTyped;
  return typedFromRaw(def, raw);
}

function applyToConfig() {
  if (!cfgRef) return;
  for (const def of DEFS) {
    if (typeof def.apply !== 'function') continue;
    try {
      def.apply(cfgRef, currentTyped(def));
    } catch {
      // Jangan sampai satu setting rusak menggagalkan yang lain.
    }
  }
}

function notify(key) {
  if (!applyHook) return;
  try {
    applyHook(key, currentTyped(BY_KEY.get(key)));
  } catch {
    // hook bersifat opsional
  }
}

function set(key, raw) {
  const def = getDef(key);
  if (!def) return { ok: false, error: `Setting tidak dikenal: ${key}` };
  let typed;
  try {
    typed = parseValue(def, raw);
  } catch (err) {
    return { ok: false, error: err.message, def };
  }
  overrides[def.key] = serialize(def, typed);
  process.env[def.key] = overrides[def.key];
  save();
  applyToConfig();
  notify(def.key);
  return { ok: true, def, value: typed };
}

function unset(key) {
  const def = getDef(key);
  if (!def) return { ok: false, error: `Setting tidak dikenal: ${key}` };
  delete overrides[def.key];
  if (baseEnv[def.key] === undefined) delete process.env[def.key];
  else process.env[def.key] = baseEnv[def.key];
  save();
  applyToConfig();
  notify(def.key);
  return { ok: true, def, value: currentTyped(def) };
}

function add(key, raw) {
  const def = getDef(key);
  if (!def) return { ok: false, error: `Setting tidak dikenal: ${key}` };
  if (def.type !== 'list') return { ok: false, error: `${def.key} bukan daftar. Gunakan set.` };
  let item;
  try {
    item = normalizeItem(def, raw);
  } catch (err) {
    return { ok: false, error: err.message, def };
  }
  const list = currentTyped(def).slice();
  if (list.includes(item)) {
    return { ok: true, def, value: list, unchanged: true };
  }
  list.push(item);
  return set(def.key, list.join(','));
}

function remove(key, raw) {
  const def = getDef(key);
  if (!def) return { ok: false, error: `Setting tidak dikenal: ${key}` };
  if (def.type !== 'list') return { ok: false, error: `${def.key} bukan daftar. Gunakan reset.` };
  let item;
  try {
    item = normalizeItem(def, raw);
  } catch (err) {
    return { ok: false, error: err.message, def };
  }
  const list = currentTyped(def).slice();
  const next = list.filter((v) => v !== item);
  if (next.length === list.length) {
    return { ok: true, def, value: list, unchanged: true };
  }
  return set(def.key, next.join(','));
}

function formatValue(def, typed) {
  if (def.type === 'bool') return typed ? 'on' : 'off';
  if (def.type === 'list') return typed.length ? typed.join(', ') : '(kosong)';
  if (typed === '' || typed === undefined || typed === null) return '(kosong)';
  if (def.secret) {
    const s = String(typed);
    if (s.length <= 8) return '********';
    return `${s.slice(0, 4)}…${s.slice(-4)}`;
  }
  return String(typed);
}

function describe(key) {
  const def = getDef(key);
  if (!def) return null;
  const typed = currentTyped(def);
  const source = Object.prototype.hasOwnProperty.call(overrides, def.key)
    ? 'chat'
    : process.env[def.key] !== undefined
      ? 'env'
      : 'default';
  return {
    key: def.key,
    group: def.group,
    groupLabel: GROUPS[def.group] || def.group,
    label: def.label,
    type: def.type,
    value: typed,
    text: formatValue(def, typed),
    source,
  };
}

function list(group) {
  const g = String(group || '').toLowerCase();
  return DEFS.filter((def) => !g || def.group === g).map((def) => describe(def.key));
}

function groups() {
  return Object.entries(GROUPS).map(([key, label]) => ({
    key,
    label,
    count: DEFS.filter((def) => def.group === key).length,
  }));
}

function stats() {
  return {
    file: file(),
    total: DEFS.length,
    overrides: Object.keys(overrides).length,
    groups: groups(),
  };
}

module.exports = {
  DEFS,
  GROUPS,
  SETTINGS_FILE,
  load,
  save,
  bindConfig,
  setHook,
  applyToConfig,
  isKnown,
  getDef,
  currentTyped,
  set,
  unset,
  add,
  remove,
  describe,
  list,
  groups,
  stats,
  formatValue,
  normalizeJid,
};
