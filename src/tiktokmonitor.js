'use strict';

const path = require('path');
const log = require('./logger');
const wa = require('./wa');
const { sleep, downloadBytes, isGroupJid, jidUser, safeReadJson, atomicWriteJson } = require('./util');
const { shortError } = require('./logfmt');
const {
  desktopHeaders,
  tiktokFetch,
  readViaJina,
  isWafError,
  isRateLimitError,
  isAuthError,
  isArchivePostsBlocked,
  hasConfiguredPostsApi,
  fetchUserPostsApi,
  fetchTikTokUser,
  fetchTikwmApiComLatest,
} = require('./tiktokapi');
const {
  dayKey,
  normalizeAccount,
  normalizeCn,
  normalizeCnText,
  normalizeHashtag,
  formatClock,
} = require('./verifstore');
const { fetchProfileEmbed, parseEmbedState, videosFromEmbed } = require('./tiktoklocal');

const START_DELAY_MS = 1500;
// Monitor ALYA MD menunggu 1,5 detik antar akun.
const ACCOUNT_DELAY_MIN_MS = 1500;
const ACCOUNT_DELAY_MAX_MS = 1500;
const CAPTION_MAX = 180;
const DEFAULT_POLL_MS = 60000;
// Profil (videoCount/avatar) dari API pihak ketiga di-cache 5 menit supaya
// tidak membanjiri layanan gratis dan tidak cepat kena kuota.
const PROFILE_CACHE_MS = 5 * 60 * 1000;
// Error yang sama tidak perlu ditulis tiap 3 menit; cukup sekali per 10 menit.
const ERROR_LOG_EVERY_MS = 10 * 60 * 1000;
// Backoff per akun saat semua sumber gagal/kuota: 2 menit, naik maksimal 30.
const ACCOUNT_BACKOFF_BASE_MS = 2 * 60 * 1000;
const ACCOUNT_BACKOFF_MAX_MS = 30 * 60 * 1000;
// Semua sumber kena kuota: istirahat 10 menit, jangan coba tiap tick.
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000;
// Jeda antar notifikasi grup supaya tidak dikira spam oleh WhatsApp.
const NOTIFY_GAP_MIN_MS = 1500;
const NOTIFY_GAP_MAX_MS = 3500;
// Batas notifikasi per siklus. Sisanya ditunda ke siklus berikutnya.
const MAX_NOTIFY_PER_TICK = 4;

function truncate(value, max) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!max || s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function normalizeCreateTime(value) {
  const n = Math.floor(Number(value) || 0);
  if (n > 0 && n > 1e12) return Math.floor(n / 1000);
  return n;
}

function pickUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = pickUrl(item);
      if (url) return url;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  return (
    pickUrl(value.url_list) ||
    pickUrl(value.urlList) ||
    pickUrl(value.url) ||
    pickUrl(value.src) ||
    ''
  );
}

function normalizeVideo(v, fallbackUnique) {
  if (!v || typeof v !== 'object') return null;
  const author = v.author || v.authorInfo || v.user || v.author_user || {};
  const id = String(
    v.video_id ||
      v.id ||
      v.aweme_id ||
      v.awemeId ||
      v.item_id ||
      v.itemId ||
      (v.video && v.video.id) ||
      ''
  ).trim();
  if (!/^\d{6,}$/.test(id)) return null;

  const uniqueId = normalizeAccount(
    author.unique_id ||
      author.uniqueId ||
      author.unique ||
      v.unique_id ||
      v.uniqueId ||
      fallbackUnique
  );
  if (!uniqueId) return null;

  const nickname = String(
    author.nickname ||
      author.nickName ||
      author.nick_name ||
      author.name ||
      v.nickname ||
      v.author_name ||
      ''
  ).trim();
  const caption = String(
    v.title || v.desc || v.caption || v.description || v.text || ''
  ).trim();
  let createTime = normalizeCreateTime(
    v.create_time || v.createTime || v.create_time_ms || v.createTimeMs || v.ctime || v.timestamp || 0
  );
  if (!createTime) createTime = timestampFromVideoId(id);

  // Pertahankan jenis post (video/photo) kalau sumber memberi link aslinya.
  const kindMatch = String(v.link || v.url || '').match(
    /tiktok\.com\/@[^/]+\/(video|photo)\/\d{6,}/i
  );
  const kind = kindMatch ? kindMatch[1].toLowerCase() : 'video';
  const cover =
    pickUrl(v.cover) ||
    pickUrl(v.origin_cover) ||
    pickUrl(v.originCover) ||
    pickUrl(v.dynamic_cover) ||
    pickUrl(v.dynamicCover) ||
    pickUrl(v.video && (v.video.cover || v.video.origin_cover || v.video.dynamic_cover)) ||
    pickUrl(v.image_post_info && v.image_post_info.images && v.image_post_info.images[0]) ||
    '';

  return {
    id,
    username: '@' + uniqueId,
    nickname,
    caption,
    createTime,
    cover,
    link: `https://www.tiktok.com/@${uniqueId}/${kind}/${id}`,
  };
}

function normalizeList(raw, fallbackUnique) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const v = normalizeVideo(item, fallbackUnique);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}

function looksLikeVideo(o) {
  if (!o || typeof o !== 'object') return false;
  const id = o.id || o.video_id || o.aweme_id || o.item_id;
  const hasCaption = o.desc !== undefined || o.title !== undefined || o.caption !== undefined;
  const hasAuthor = o.author || o.authorInfo || o.user;
  return Boolean(id && hasCaption && hasAuthor);
}

function deepCollectItems(root, out = [], depth = 0) {
  if (!root || depth > 8) return out;
  if (Array.isArray(root)) {
    for (const item of root) {
      if (looksLikeVideo(item)) out.push(item);
      else deepCollectItems(item, out, depth + 1);
    }
    return out;
  }
  if (typeof root !== 'object') return out;
  if (looksLikeVideo(root)) {
    out.push(root);
    return out;
  }
  for (const value of Object.values(root)) deepCollectItems(value, out, depth + 1);
  return out;
}

function parseProfileHtml(html) {
  const match = String(html || '').match(
    /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return [];
  try {
    return deepCollectItems(JSON.parse(match[1]));
  } catch {
    return [];
  }
}

async function fetchProfileHtml(unique, cfg = {}) {
  const url = `https://www.tiktok.com/@${encodeURIComponent(unique)}?lang=en`;
  const res = await tiktokFetch(
    url,
    {
      headers: desktopHeaders(cfg, {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      }),
      redirect: 'follow',
    },
    30000,
    cfg
  );
  if (!res.ok) throw new Error(`profil TikTok HTTP ${res.status}`);
  const html = await res.text();
  if (html.length < 5000 || /Just a moment|slardarClientWAF|cf-chl/i.test(html)) {
    throw new Error('profil TikTok diblokir WAF');
  }
  return normalizeList(parseProfileHtml(html), unique);
}

/**
 * ID video TikTok adalah snowflake: 32 bit teratas berisi Unix timestamp
 * dalam detik. Dengan begitu kita tetap bisa tahu waktu upload walau sumber
 * hanya memberi link (mis. hasil render Jina Reader).
 */
function timestampFromVideoId(id) {
  try {
    const seconds = Number(BigInt(String(id)) >> 32n);
    if (seconds > 1000000000 && seconds < 4102444800) return seconds;
  } catch {
    /* bukan angka */
  }
  return 0;
}

function cleanJinaText(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*~`>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanJinaCaption(value) {
  let caption = cleanJinaText(value);
  // Alt text TikTok: "<caption> created by <nickname> with <sound>".
  caption = caption.replace(/\s*\bcreated by\b[\s\S]*$/i, '');
  caption = caption.replace(/\s*\[Video \d+\][\s\S]*$/i, ' ');
  caption = caption.replace(/\s+\bPinned\b\s*$/i, '');
  return caption.replace(/\s+/g, ' ').trim();
}

function nicknameFromJina(markdown, unique) {
  const title = (String(markdown || '').match(/^Title:\s*(.+)$/m) || [])[1] || '';
  const titleMatch = title.match(
    new RegExp(`^(.*?)\\s*\\(@${escapeRegExp(unique)}\\)`, 'i')
  );
  if (titleMatch && titleMatch[1]) return cleanJinaText(titleMatch[1]);

  const altMatch = String(markdown || '').match(/\bcreated by\s+(.+?)\s+with\b/i);
  if (altMatch && altMatch[1]) return cleanJinaText(altMatch[1]);
  return '';
}

/**
 * Parse markdown hasil Jina Reader untuk halaman profil TikTok.
 * Contoh baris:
 * [![Image 2: caption created by Nick](thumb) 1.2K](https://.../video/123)
 */
function parseProfileMarkdown(markdown, unique) {
  const acc = normalizeAccount(unique);
  if (!acc) return [];

  const text = String(markdown || '');
  const nickname = nicknameFromJina(text, acc);
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const link = line.match(
      /https?:\/\/(?:www\.)?tiktok\.com\/@([^/\s)]+)\/(video|photo)\/(\d{6,})/i
    );
    if (!link) continue;
    // Abaikan video akun lain yang mungkin muncul di bagian rekomendasi.
    if (link[1].toLowerCase() !== acc.toLowerCase()) continue;

    const id = link[3];
    if (seen.has(id)) continue;

    let caption = '';
    const titleAttr = line.match(/(?:video|photo)\/\d{6,}\s+"([^"]*)"/i);
    if (titleAttr) caption = titleAttr[1];
    if (!caption) {
      const alt = line.match(/!\[Image\s+\d+:\s*([^\]]*?)\]/i);
      if (alt) caption = alt[1];
    }
    if (!caption) {
      const next = (lines[i + 1] || '').trim();
      if (next && !/^[![]/.test(next) && !/^(?:Title|URL Source):/i.test(next)) {
        caption = next;
      }
    }

    seen.add(id);
    const thumb = line.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
    out.push({
      aweme_id: id,
      author: { unique_id: acc, nickname },
      desc: cleanJinaCaption(caption),
      create_time: timestampFromVideoId(id),
      cover: thumb ? thumb[1] : '',
      link: `https://www.tiktok.com/@${acc}/${link[2].toLowerCase()}/${id}`,
    });
  }

  return out;
}

/**
 * Baca profil lewat Jina Reader. Ini jalur anti-WAF utama untuk daftar video:
 * request dilakukan dari server Jina, bukan dari IP bot.
 */
async function fetchProfileJina(unique, cfg = {}) {
  const acc = normalizeAccount(unique);
  if (!acc) return [];

  const text = await readViaJina(
    `https://www.tiktok.com/@${encodeURIComponent(acc)}?lang=en`,
    cfg,
    60000
  );

  if (/couldn.?\s*t find this account|could not find this account/i.test(text)) {
    const err = new Error(`akun @${acc} tidak ditemukan`);
    err.notFound = true;
    throw err;
  }

  const items = parseProfileMarkdown(text, acc);
  if (items.length) return normalizeList(items, acc);

  // Profil valid tapi memang belum punya video.
  if (new RegExp(`\\(@${escapeRegExp(acc)}\\)`, 'i').test(text) || /Followers/i.test(text)) {
    return [];
  }

  if (
    /just a moment|performing security verification|captcha|slardarClientWAF|access denied/i.test(
      text
    )
  ) {
    const err = new Error('profil TikTok diblokir WAF (Jina)');
    err.waf = true;
    throw err;
  }

  throw new Error('Jina: tidak ada video di halaman profil');
}

/**
 * Fallback Jina berbentuk HTML: ambil halaman embed lewat server Jina lalu
 * parse `__FRONTITY_CONNECT_STATE__` yang sama dengan scraper lokal. Ini
 * bekerja ketika embed langsung kena WAF, karena request tidak berasal dari
 * IP panel.
 */
async function fetchProfileJinaHtml(unique, cfg = {}) {
  const acc = normalizeAccount(unique);
  if (!acc) return [];

  const html = await readViaJina(
    `https://www.tiktok.com/embed/@${encodeURIComponent(acc)}?lang=en`,
    cfg,
    60000,
    'html'
  );

  const data = parseEmbedState(html);
  if (!data) {
    if (/couldn.?\s*t find this account|could not find this account|account is private/i.test(html)) {
      const err = new Error(`akun @${acc} tidak ditemukan`);
      err.notFound = true;
      throw err;
    }
    if (/slardarClientWAF|Please wait\.\.\.|id="_wafchallengeid"|access denied/i.test(html)) {
      const err = new Error('embed TikTok diblokir WAF (Jina HTML)');
      err.waf = true;
      throw err;
    }
    throw new Error('Jina HTML: state profil tidak ditemukan');
  }

  const result = videosFromEmbed(data, acc);
  return normalizeList(result.items, acc);
}

async function fetchUserVideos(account, cfg = {}) {
  const unique = normalizeAccount(account);
  if (!unique) return [];
  const errors = [];
  let waf = false;
  let authFailures = 0;

  const localRequest = (url, options, timeoutMs) =>
    tiktokFetch(url, options, timeoutMs, cfg);

  // Jalur utama: scraper lokal di panel (embed creator, tanpa WAF/API key).
  const tryLocal = async () => {
    if (cfg.tiktokLocalEnabled === false) throw new Error('scraper lokal dimatikan');
    const result = await fetchProfileEmbed(unique, cfg, localRequest);
    const videos = normalizeList(result.items, unique);
    // Profil valid tanpa video: kembalikan kosong, jangan lanjut ke sumber
    // lain yang justru bisa memicu WAF.
    if (!videos.length && !result.items.length) return [];
    if (!videos.length) throw new Error('scraper lokal: 0 video');
    log.debug(
      `[TIKTOK] lokal @${unique}: ${videos.length} video` +
        (result.profile.nickname ? ` (${result.profile.nickname})` : '')
    );
    return videos;
  };

  const tryApi = async () => {
    const { items } = await fetchUserPostsApi(unique, cfg);
    const videos = normalizeList(items, unique);
    // Respons kosong bisa berarti parser provider tidak cocok. Biarkan jalur
    // berikutnya mencoba, daripada akun dianggap tidak pernah upload.
    if (!videos.length) throw new Error('API: 0 video');
    return videos;
  };
  const tryJina = () => fetchProfileJina(unique, cfg);
  const tryJinaHtml = () => fetchProfileJinaHtml(unique, cfg);
  const tryHtml = () => fetchProfileHtml(unique, cfg);

  // Mode "auto" (default): endpoint ALYA MD (tikwmapi) lebih dulu, lalu
  // scraper lokal dan cadangan lain. Mode "local": wajib lokal. Mode "api":
  // langsung API/Jina seperti dulu.
  const mode = String(cfg.tiktokScraperMode || 'auto').toLowerCase();
  const steps = [];
  if (mode !== 'local' && hasConfiguredPostsApi(cfg)) steps.push(['TikwmAPI', tryApi]);
  if (mode !== 'api') steps.push(['Local', tryLocal]);
  if (mode !== 'local') {
    steps.push(['Jina', tryJina]);
    steps.push(['Jina HTML', tryJinaHtml]);
  } else {
    // Mode local tetap boleh memakai Jina saat embed benar-benar diblokir WAF,
    // supaya detector tidak mati total hanya karena IP panel sedang diblokir.
    steps.push(['Jina (cadangan WAF)', tryJina, 'onWaf']);
    steps.push(['Jina HTML (cadangan WAF)', tryJinaHtml, 'onWaf']);
  }
  if (mode !== 'local' && !hasConfiguredPostsApi(cfg)) steps.push(['API', tryApi]);
  steps.push(['HTML', tryHtml]);

  for (const [name, fn, when] of steps) {
    if (when === 'onWaf' && !waf) continue;
    if (when === 'onWaf') {
      log.warn('[TIKTOK] embed lokal kena WAF, memakai Jina sebagai cadangan.');
    }
    try {
      return await fn();
    } catch (err) {
      // Akun benar-benar tidak ada: jangan lanjut ke sumber lain yang bisa
      // memicu cooldown WAF hanya karena akunnya sudah dihapus/rename.
      if (err && err.notFound) {
        const notFoundError = new Error(`${name}: ${err.message}`);
        notFoundError.notFound = true;
        throw notFoundError;
      }
      if ((err && err.waf) || isWafError(err)) waf = true;
      if ((err && err.auth) || isAuthError(err)) authFailures += 1;
      errors.push(`${name}: ${err && err.message ? err.message : err}`);
    }
  }

  const finalError = new Error(errors.join(' | ') || 'gagal mengambil video TikTok');
  finalError.waf = waf;
  // Semua sumber yang dicoba hanya menolak key/langganan: masalah konfigurasi,
  // jangan dikirim sebagai alert error berulang ke owner.
  if (authFailures && authFailures === errors.length) finalError.auth = true;
  throw finalError;
}

function captionHasHashtag(caption, hashtag) {
  const target = normalizeHashtag(hashtag).toLowerCase();
  if (!target) return false;
  // Gunakan batas kata agar #margaecn tidak ikut cocok dengan #margaecnx.
  const re = new RegExp(escapeRegExp(target) + '(?![a-z0-9_])', 'i');
  return re.test(String(caption || ''));
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nicknameMatchesCn(nickname, cn) {
  const target = normalizeCnText(cn);
  if (!target) return false;
  return normalizeCnText(nickname).includes(target);
}

function buildVideoData(video, cfg) {
  const hashtag = normalizeHashtag((cfg && cfg.tiktokHashtag) || '#margaecn');
  const cn = normalizeCn((cfg && cfg.tiktokCnKeyword) || 'ECN');
  const hashtagOk = captionHasHashtag(video.caption, hashtag);
  const cnOk = nicknameMatchesCn(video.nickname, cn);
  return {
    id: video.id,
    username: video.username,
    nickname: video.nickname || normalizeAccount(video.username),
    cn: cnOk ? cn : '',
    caption: video.caption,
    hashtagStatus: hashtagOk ? 'Ada' : 'Tidak Ada',
    cnStatus: cnOk ? 'Cocok' : 'Tidak Cocok',
    link: video.link,
    cover: video.cover || '',
    timestamp: video.createTime ? video.createTime * 1000 : Date.now(),
  };
}

function formatDetectorMessage(video, cfg) {
  const cn = normalizeCn((cfg && cfg.tiktokCnKeyword) || 'ECN');
  const hashtag = normalizeHashtag((cfg && cfg.tiktokHashtag) || '#margaecn');
  const nick = video.nickname ? ` (${video.nickname})` : '';
  const hashtagOk = video.hashtagStatus === 'Ada';
  const cnOk = video.cnStatus === 'Cocok';
  const lines = [
    '🎬 *Tsukasa Detector*',
    `👤 UP: ${video.username}${nick}`,
    `ACC: ${video.cn || cn}`,
    `📌 ${hashtag} - ${video.hashtagStatus} ${hashtagOk ? '✅' : '❎'}`,
    `📌 CN ${cn} - ${video.cnStatus} ${cnOk ? '✅' : '❎'}`,
    `📝 Caption: ${truncate(video.caption, CAPTION_MAX) || '-'}`,
    `🔗 ${video.link}`,
  ];
  if (!hashtagOk) {
    lines.push('', `⚠️ Caption belum memuat ${hashtag}. Tolong tambahkan hashtag-nya ya!`);
  }
  return lines.join('\n');
}

function formatNumberId(value) {
  return (Number(value) || 0).toLocaleString('id-ID');
}

/** Daftar hashtag wajib untuk satu grup, diambil dari entri verif grup itu. */
function requiredHashtagsFor(store, gcId, video, cfg) {
  const acc = normalizeAccount(video && video.username).toLowerCase();
  const cn = normalizeCn(video && video.cn);
  const tags = new Set();

  let entries = [];
  try {
    if (store && typeof store.list === 'function') entries = store.list(gcId);
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    const byAccount = acc && normalizeAccount(entry.accName).toLowerCase() === acc;
    const byCn = cn && normalizeCn(entry.cnKeyword) === cn;
    if (!byAccount && !byCn) continue;
    const tag = normalizeHashtag(entry.hashtag || '');
    if (tag) tags.add(tag);
  }

  // Target hashtag yang diset langsung dari grup lewat .tthashtag on #tag
  const groupCfg = global.db && global.db.groups && global.db.groups[gcId];
  if (groupCfg && groupCfg.detectHashtag && Array.isArray(groupCfg.requiredHashtags)) {
    for (const raw of groupCfg.requiredHashtags) {
      const tag = normalizeHashtag(raw);
      if (tag) tags.add(tag);
    }
  }

  if (!tags.size) {
    const fallback = normalizeHashtag((cfg && cfg.tiktokHashtag) || '');
    if (fallback) tags.add(fallback);
  }
  return [...tags];
}

/** Status hashtag gaya ALYA MD: sesuai target / memakai / tanpa hashtag. */
function hashtagStatusFor(caption, required) {
  const found = (String(caption || '').match(/#[\w\u0590-\u05ff]+/g) || []).map((tag) =>
    tag.toLowerCase()
  );
  const wanted = (Array.isArray(required) ? required : []).filter(Boolean);
  if (wanted.length) {
    const hit = wanted.filter((tag) => found.includes(String(tag).toLowerCase()));
    if (hit.length) return `Sesuai Target (${hit.join(', ')})`;
    return `Tidak Sesuai Target (Target: ${wanted.join(', ')})`;
  }
  return found.length ? 'Menggunakan Hashtag' : 'Tanpa Hashtag';
}

/** Susunan alert real-time yang dipakai ALYA MD. */
function formatArchiveAlert(video, meta = {}) {
  const profile = meta.profile || {};
  const username = normalizeAccount(video && video.username);
  const nickname = (video && video.nickname) || profile.nickname || '-';
  const total = Number(profile.videoCount ?? meta.currentCount ?? 0);
  const diff = Math.max(1, Number(meta.diff) || 1);
  const followers = Number(profile.followers ?? 0);
  const likes = Number(profile.hearts ?? profile.heartsCount ?? 0);
  const groupName = meta.groupName || 'Grup ini';
  const now = new Date();
  const clock = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const hashtags = String((video && video.caption) || '').match(/#[\w\u0590-\u05ff]+/g) || [];
  const status = meta.hashtagStatus || '';

  let text = '🔔 *[ NOTIFIKASI TIKTOK REAL-TIME ]* 🔔\n\n';
  text += `Halo member *${groupName}*! Akun TikTok terverifikasi baru saja mengupload video baru! 🎬🚀\n\n`;
  text += `👤 *Akun*: @${username}\n`;
  text += `📛 *Nickname*: ${nickname || '-'}\n`;
  text += `🎬 *Total Video*: ${total} *(+${diff} video baru)*\n`;
  text += `👥 *Followers*: ${formatNumberId(followers)}\n`;
  text += `❤️ *Total Likes*: ${formatNumberId(likes)}\n`;
  if (video && video.caption) {
    text += `*Deskripsi*: ${truncate(video.caption, 150)}\n`;
  }
  if (meta.checkHashtag) {
    text += `*Hashtags*: ${
      hashtags.length ? hashtags.join(' ') : '_(Tidak ada hashtag)_'
    }\n`;
    text += `*Status Hashtag*: ${status || (hashtags.length ? 'Menggunakan Hashtag' : 'Tanpa Hashtag')}\n`;
  }
  if (!meta.countOnly && video && video.link) {
    text += `\n🎬 *Link Video Terbaru (VT)*:\n👉 ${video.link}\n`;
  }
  text += `\n🔗 *Profil TikTok*:\n👉 https://www.tiktok.com/@${username}\n\n`;
  text += '━━━━━━━━━━━━━━━━━━━━━\n';
  text += `📢 *Group Target*: ${groupName}\n`;
  text += `📅 *Tanggal*: ${date}\n`;
  text += `⏰ *Waktu*: ${clock} WIB\n\n`;
  text += '_Notifikasi otomatis TikTok Profile Monitoring_';
  return text;
}

class TikTokMonitor {
  constructor(cfg, store, isReady, accountsStore) {
    this.cfg = cfg || {};
    this.store = store;
    this.accountsStore = accountsStore || null;
    this.ready = typeof isReady === 'function' ? isReady : () => Boolean(isReady);
    this.intervalMs = Math.max(
      10000,
      Number(this.cfg.tiktokPollMs) || DEFAULT_POLL_MS
    );
    this.timer = null;
    this.startTimer = null;
    this.ticking = false;
    this.profileCache = new Map();
    this.groupNames = new Map();
    this.countFile = path.join(
      this.cfg.tiktokDataDir || path.resolve('data/tiktok'),
      'monitor.json'
    );
    const countState = safeReadJson(this.countFile, null);
    this.countState =
      countState && typeof countState === 'object' && !Array.isArray(countState)
        ? countState
        : {};
    // Akun yang sudah dihapus/rename jangan dilaporkan tiap siklus.
    this.missingAccounts = new Set();
    // Throttle log error per akun supaya panel tidak spam.
    this.errorLogAt = new Map();
    // Cooldown WAF global: kalau semua sumber 403, berhenti sebentar supaya
    // tidak makin dicurigai. Log hanya sekali per cooldown.
    this.wafUntil = 0;
    this.wafLogged = false;
    this.wafCooldownMs =
      Math.max(1, Number(this.cfg.tiktokWafCooldownMin) || 10) * 60 * 1000;
    // Cooldown kuota/rate-limit: semua provider sedang diblokir sementara.
    this.quotaUntil = 0;
    this.quotaLogged = false;
    // Backoff per akun supaya akun bermasalah tidak dicoba tiap tick.
    this.accountBackoff = new Map();
    this.backoffStrikes = new Map();
    // Penanda notifikasi yang sudah terkirim (video:grup) agar tidak dobel.
    this.notified = new Set();
    this.notifyCount = 0;
    this.lastCheckAt = 0;
    this.lastOkAt = 0;
    this.lastError = '';
  }

  health() {
    return {
      enabled: this.isEnabled(),
      scraper: this.cfg.tiktokScraperMode || 'auto',
      localEnabled: this.cfg.tiktokLocalEnabled !== false,
      pollSeconds: Math.round(this.intervalMs / 1000),
      lastCheckAt: this.lastCheckAt,
      lastOkAt: this.lastOkAt,
      lastError: this.lastError,
      cooldownUntil: Math.max(this.wafUntil || 0, this.quotaUntil || 0) || 0,
      accounts: this.getAccounts().length,
    };
  }

  enterWafCooldown() {
    this.wafUntil = Date.now() + this.wafCooldownMs;
    this.lastError = 'WAF/rate limit TikTok';
    if (!this.wafLogged) {
      const minutes = Math.max(1, Math.round(this.wafCooldownMs / 60000));
      log.warn(`[TIKTOK] WAF block, retry ${minutes} menit`);
      this.wafLogged = true;
    }
  }

  enterQuotaCooldown(err) {
    this.quotaUntil = Date.now() + QUOTA_COOLDOWN_MS;
    this.lastError = shortError(err) || 'kuota/rate limit TikTok';
    if (!this.quotaLogged) {
      log.warn(
        `[TIKTOK] kuota/rate limit semua sumber, istirahat ${Math.round(
          QUOTA_COOLDOWN_MS / 60000
        )} menit (tidak dikirim ke owner)`
      );
      this.quotaLogged = true;
    }
  }

  clearWafCooldown() {
    this.wafUntil = 0;
    this.wafLogged = false;
  }

  logCheckError(account, err) {
    const now = Date.now();
    this.lastError = shortError(err);
    // Kuota/rate-limit bukan error fatal: jangan memicu notifikasi owner.
    if (isRateLimitError(err)) return;
    // Key/langganan provider ditolak sudah dilaporkan sekali oleh tiktokapi;
    // tidak perlu dihitung sebagai error berulang.
    if (err && err.auth) return;
    const last = this.errorLogAt.get(account) || 0;
    if (now - last < ERROR_LOG_EVERY_MS) return;
    this.errorLogAt.set(account, now);
    log.error(`[TIKTOK] ${account} gagal: ${shortError(err)}`);
  }

  /** Daftar akun aktif: dari data/tiktok/accounts.json bila sudah diubah. */
  getAccounts() {
    if (this.accountsStore) return this.accountsStore.list();
    return Array.isArray(this.cfg.tiktokAccounts) ? this.cfg.tiktokAccounts : [];
  }

  isEnabled() {
    if (this.accountsStore) return this.accountsStore.isEnabled();
    return this.cfg.tiktokMonitorEnabled !== false;
  }

  /**
   * Dipanggil setelah /addakun, /delakun, atau /detector on|off supaya
   * perubahan langsung berlaku tanpa restart.
   */
  refresh() {
    if (!this.isEnabled()) {
      this.stop();
      log.info('[TIKTOK] Detector dimatikan.');
      return;
    }

    const accounts = this.getAccounts();
    if (!accounts.length) {
      this.stop();
      log.warn('[TIKTOK] Daftar akun kosong, detector berhenti sampai ada /addakun.');
      return;
    }

    if (this.timer) {
      log.info(`[TIKTOK] Akun diperbarui | ${accounts.join(', ')}`);
      return;
    }

    this.start();
  }

  /** Terapkan ulang interval setelah config diubah dari WhatsApp/panel. */
  reconfigure() {
    this.intervalMs = Math.max(
      10000,
      Number(this.cfg.tiktokPollMs) || DEFAULT_POLL_MS
    );
    if (this.timer || this.startTimer) {
      this.stop();
      this.start();
    }
  }

  start() {
    if (!this.isEnabled()) return;
    const accounts = this.getAccounts();
    if (!accounts.length) {
      log.warn('[TIKTOK] Daftar akun kosong, detector tidak berjalan. Tambah via /addakun.');
      return;
    }
    if (this.timer) return;

    log.info(
      `[TIKTOK] Detector aktif | ${accounts.length} akun | interval ${Math.round(
        this.intervalMs / 1000
      )} detik | scraper ${this.cfg.tiktokScraperMode || 'auto'}` +
        `${this.cfg.tiktokLocalEnabled === false ? ' (lokal off)' : ' (lokal on)'} | ${accounts.join(', ')}`
    );
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      this.tick().catch(() => {});
    }, START_DELAY_MS);
    if (typeof this.startTimer.unref === 'function') this.startTimer.unref();

    this.timer = setInterval(() => this.tick().catch(() => {}), this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop() {
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (!this.isEnabled()) return;
    if (!this.ready()) return;
    if (this.ticking) return;
    const now = Date.now();
    if (now < this.wafUntil || now < this.quotaUntil) return;
    if (this.wafUntil) {
      // Cooldown selesai: coba lagi dan izinkan satu log baru kalau masih WAF.
      this.wafUntil = 0;
      this.wafLogged = false;
    }
    if (this.quotaUntil) {
      this.quotaUntil = 0;
      this.quotaLogged = false;
    }
    this.ticking = true;
    this.lastCheckAt = now;
    this.notifyCount = 0;
    try {
      const accounts = this.getAccounts();
      for (let i = 0; i < accounts.length; i += 1) {
        // Cek satu per satu; jeda 1,5 detik seperti monitor ALYA MD.
        if (i > 0) {
          await sleep(
            ACCOUNT_DELAY_MIN_MS +
              Math.floor(Math.random() * (ACCOUNT_DELAY_MAX_MS - ACCOUNT_DELAY_MIN_MS + 1))
          );
        }
        if (Date.now() < this.wafUntil || Date.now() < this.quotaUntil) break;

        const account = accounts[i];
        if (this.isAccountBackedOff(account)) continue;
        try {
          await this.checkAccount(account);
          this.clearAccountBackoff(account);
        } catch (err) {
          if (err && err.waf) {
            this.enterWafCooldown();
            break;
          }
          if (err && err.notFound) {
            if (!this.missingAccounts.has(account)) {
              this.missingAccounts.add(account);
              log.warn(`[TIKTOK] ${account} tidak ditemukan, dilewati.`);
            }
            continue;
          }
          if (isRateLimitError(err)) {
            this.enterQuotaCooldown(err);
            break;
          }
          this.backoffAccount(account, err);
          this.logCheckError(account, err);
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  isAccountBackedOff(account) {
    const until = this.accountBackoff.get(account) || 0;
    if (!until) return false;
    if (until > Date.now()) return true;
    this.accountBackoff.delete(account);
    return false;
  }

  backoffAccount(account, err) {
    const strikes = (this.backoffStrikes.get(account) || 0) + 1;
    this.backoffStrikes.set(account, strikes);
    const wait = Math.min(
      ACCOUNT_BACKOFF_MAX_MS,
      ACCOUNT_BACKOFF_BASE_MS * 2 ** Math.min(4, strikes - 1)
    );
    this.accountBackoff.set(account, Date.now() + wait);
    log.debug(`[TIKTOK] ${account} backoff ${Math.round(wait / 1000)}s: ${shortError(err)}`);
  }

  clearAccountBackoff(account) {
    this.accountBackoff.delete(account);
    this.backoffStrikes.delete(account);
  }

  countKey(account) {
    return String(account || '').trim().toLowerCase();
  }

  getCountInfo(account) {
    const item = this.countState[this.countKey(account)];
    return item && typeof item === 'object' ? item : null;
  }

  setCountInfo(account, patch) {
    const key = this.countKey(account);
    if (!key) return;
    const prev = this.countState[key] && typeof this.countState[key] === 'object'
      ? this.countState[key]
      : {};
    const changed = Object.keys(patch || {}).some((field) => prev[field] !== patch[field]);
    this.countState[key] = { ...prev, ...patch, updatedAt: Date.now() };
    if (!changed) return;
    try {
      atomicWriteJson(this.countFile, this.countState);
    } catch (err) {
      log.warn(`[TIKTOK] gagal menyimpan monitor.json: ${shortError(err)}`);
    }
  }

  async getProfile(account) {
    const key = String(account || '').toLowerCase();
    const cached = this.profileCache.get(key);
    if (cached && Date.now() - cached.at < PROFILE_CACHE_MS) return cached.profile;
    const profile = await fetchTikTokUser(account, this.cfg);
    this.profileCache.set(key, { at: Date.now(), profile });
    return profile;
  }

  async checkAccount(account) {
    // Monitor ALYA MD memakai profil sebagai sumber utama: videoCount naik
    // berarti ada upload baru. Daftar video hanya diambil saat itu terjadi,
    // jadi request jauh lebih hemat daripada scraping daftar tiap tick.
    let profile = null;
    try {
      profile = await this.getProfile(account);
    } catch (err) {
      if (err && err.notFound) throw err;
      // Kuota/rate-limit profil bukan error fatal: lanjut ke deteksi ID video.
      log.debug(`[TIKTOK] profil @${account} gagal: ${shortError(err)}`);
    }

    this.missingAccounts.delete(account);
    this.errorLogAt.delete(account);

    const state = this.store.getSeenState(account);
    const prevInfo = this.getCountInfo(account) || {};
    const prevCount = Number(prevInfo.lastVideoCount);
    const count = Number(profile && profile.videoCount);
    const hasCount = Number.isFinite(count) && count >= 0;

    // Profil tidak tersedia: kembali ke deteksi berbasis ID video.
    if (!profile) {
      let videos = [];
      try {
        videos = await fetchUserVideos(account, this.cfg);
      } catch (err) {
        if (err && err.notFound) throw err;
        if (isRateLimitError(err)) {
          this.lastError = shortError(err);
          throw err;
        }
        this.logCheckError(account, err);
        return;
      }
      const currentIds = videos.map((v) => v.id);
      if (!state.initialized) {
        const today = dayKey(Date.now(), this.cfg.tzOffset);
        for (const video of videos) {
          const data = buildVideoData(video, this.cfg);
          if (dayKey(data.timestamp, this.cfg.tzOffset) === today) {
            await this.store.recordVideo(data);
          }
        }
        await this.store.markSeen(account, currentIds, true);
        log.info(`[TIKTOK] ${account} baseline ${videos.length} video`);
        return;
      }
      const fresh = videos
        .filter((v) => !state.ids.has(v.id))
        .sort((a, b) => a.createTime - b.createTime);
      for (const video of fresh) {
        const data = buildVideoData(video, this.cfg);
        await this.store.recordVideo(data);
        await this.notify(data, { diff: fresh.length, currentCount: videos.length });
        log.info(
          `[TIKTOK] UP ${data.username} (${data.nickname || '-'}) | ${formatClock(
            data.timestamp,
            this.cfg.timezone
          )}`
        );
      }
      await this.store.markSeen(account, currentIds, true);
      this.lastOkAt = Date.now();
      this.lastError = '';
      this.clearWafCooldown();
      return;
    }

    this.lastOkAt = Date.now();
    this.lastError = '';
    this.clearWafCooldown();
    this.missingAccounts.delete(account);

    const statsPatch = {
      nickname: profile.nickname || null,
      followers: profile.followers ?? null,
      likes: profile.hearts ?? profile.heartsCount ?? null,
    };

    // Pertama kali berjalan: simpan baseline, jangan kirim notifikasi untuk
    // video lama. Daftar video diambil sekali agar /siapaup langsung terisi.
    if (!state.initialized || !Number.isFinite(prevCount)) {
      let videos = [];
      try {
        videos = await fetchUserVideos(account, this.cfg);
      } catch (err) {
        log.debug(`[TIKTOK] baseline daftar video @${account} gagal: ${shortError(err)}`);
      }
      const today = dayKey(Date.now(), this.cfg.tzOffset);
      for (const video of videos) {
        const data = buildVideoData(video, this.cfg);
        if (dayKey(data.timestamp, this.cfg.tzOffset) === today) {
          await this.store.recordVideo(data);
        }
      }
      const patch = { ...statsPatch };
      if (hasCount) patch.lastVideoCount = count;
      if (videos.length) patch.lastVideoId = videos[0].id;
      this.setCountInfo(account, patch);
      await this.store.markSeen(account, videos.map((v) => v.id), true);
      log.info(
        `[TIKTOK] ${account} baseline ${videos.length} video` +
          (hasCount ? ` / ${count} total` : '')
      );
      return;
    }

    // Jumlah video turun (video dihapus/di-private): perbarui baseline tanpa
    // mengirim notifikasi palsu.
    if (hasCount && count < prevCount) {
      this.setCountInfo(account, { ...statsPatch, lastVideoCount: count });
      return;
    }

    // Tidak ada kenaikan: cukup simpan statistik terbaru.
    if (!hasCount || count <= prevCount) {
      this.setCountInfo(account, statsPatch);
      return;
    }

    // Ada upload baru. Utamakan endpoint video terbaru (cepat, seperti ALYA
    // MD), lalu daftar video lengkap bila ID-nya belum terlihat.
    let videos = [];
    let latest = null;
    if (!isArchivePostsBlocked()) {
      try {
        latest = await fetchTikwmApiComLatest(account, this.cfg);
        if (latest) {
          videos = normalizeList(
            [
              {
                video_id: latest.id,
                author: {
                  unique_id: normalizeAccount(account),
                  nickname: profile.nickname,
                },
                title: latest.title,
                create_time: latest.createTime,
                cover: latest.cover,
                link: latest.url,
              },
            ],
            account
          );
        }
      } catch (err) {
        log.debug(`[TIKTOK] tikwmapi latest @${account} gagal: ${shortError(err)}`);
      }
    }

    let fresh = videos
      .filter((v) => !state.ids.has(v.id))
      .sort((a, b) => a.createTime - b.createTime);

    if (!fresh.length) {
      try {
        videos = await fetchUserVideos(account, this.cfg);
      } catch (err) {
        log.debug(`[TIKTOK] daftar video baru @${account} gagal: ${shortError(err)}`);
      }
      fresh = videos
        .filter((v) => !state.ids.has(v.id))
        .sort((a, b) => a.createTime - b.createTime);
    }

    // Seperti monitor ALYA MD: kalau endpoint video terbaru masih
    // mengembalikan video yang sama dengan notifikasi sebelumnya, kenaikan
    // videoCount belum tentu upload baru (cache/lag profil). Perbarui baseline
    // tanpa mengirim alert palsu.
    if (
      !fresh.length &&
      latest &&
      prevInfo.lastVideoId &&
      String(latest.id) === String(prevInfo.lastVideoId)
    ) {
      this.setCountInfo(account, { ...statsPatch, lastVideoCount: count });
      log.debug(
        `[TIKTOK] ${account} videoCount naik tetapi video terbaru masih ${latest.id}; baseline diperbarui`
      );
      return;
    }

    // Fallback monitor ALYA MD: alert tetap dikirim walau link video belum
    // tersedia, karena videoCount sudah membuktikan ada upload baru.
    let countOnly = false;
    if (!fresh.length) {
      const username = normalizeAccount(account);
      fresh = [
        {
          id: `count-${count}`,
          _countOnly: true,
          username: `@${username}`,
          nickname: profile.nickname || prevInfo.nickname || '',
          caption: '',
          createTime: Math.floor(Date.now() / 1000),
          cover: '',
          link: `https://www.tiktok.com/@${username}`,
        },
      ];
      countOnly = true;
    }

    const diff = Math.max(1, count - prevCount);
    for (const video of fresh) {
      const data = buildVideoData(video, this.cfg);
      if (!video._countOnly) await this.store.recordVideo(data);
      await this.notify(data, {
        profile,
        diff,
        currentCount: count,
        checkHashtag: true,
        countOnly,
      });
      log.info(
        `[TIKTOK] UP ${data.username} (${data.nickname || '-'}) | ${formatClock(
          data.timestamp,
          this.cfg.timezone
        )} | ${data.hashtagStatus === 'Ada' ? 'hashtag ok' : 'hashtag -'} | ${
          data.cnStatus === 'Cocok' ? 'CN ok' : 'CN -'
        }`
      );
    }

    const latestReal = videos.find((v) => v && v.id);
    const patch = {
      ...statsPatch,
      lastVideoCount: count,
      notifiedAt: Date.now(),
    };
    if (latestReal && latestReal.id) patch.lastVideoId = latestReal.id;
    this.setCountInfo(account, patch);

    const realIds = videos.map((v) => v.id).filter(Boolean);
    await this.store.markSeen(account, realIds, true);
  }

  async getGroupName(jid) {
    const key = String(jid || '').trim();
    if (!key) return '';
    if (this.groupNames.has(key)) return this.groupNames.get(key);
    let name = '';
    try {
      const sock = typeof wa.getSock === 'function' ? wa.getSock() : null;
      if (sock && typeof sock.groupMetadata === 'function') {
        const meta = await sock.groupMetadata(key);
        name = String((meta && (meta.subject || meta.name)) || '').trim();
      }
    } catch {
      name = '';
    }
    this.groupNames.set(key, name);
    return name;
  }

  async notify(video, meta = {}) {
    // Mode pasif: tetap catat history, tetapi jangan kirim notifikasi otomatis.
    if (this.cfg.passiveMode) {
      log.info(`[TIKTOK] ${video.username} UP | notifikasi dimatikan (BOT_PASSIVE_MODE)`);
      return;
    }
    // Hanya grup yang boleh menerima notifikasi, supaya yang lain tahu siapa
    // yang UP. Map: JID grup -> daftar JID peng-verif untuk di-tag.
    const targets = new Map();
    const add = (jid, users) => {
      const target = String(jid || '').trim();
      if (!target || !isGroupJid(target)) return;
      if (!targets.has(target)) targets.set(target, new Map());
      const slot = targets.get(target);
      for (const user of Array.isArray(users) ? users : []) {
        const ju = String((user && user.jid) || '').trim();
        if (!ju) continue;
        slot.set(ju, String((user && user.name) || '').trim());
      }
    };

    for (const target of this.store.notifyTargets(video)) {
      add(target.gcId, target.users);
    }
    // Grup tambahan yang diset dari WhatsApp lewat /detector setgc.
    add(this.cfg.tiktokNotifyJid, []);

    if (!targets.size) {
      log.info(`[TIKTOK] ${video.username} UP | belum ada grup terverif`);
      return;
    }

    const profile = meta.profile || null;
    let attempted = 0;
    for (const [jid, userMap] of targets) {
      const dedupeKey = `${video.id}:${jid}`;
      if (this.notified.has(dedupeKey)) continue;
      if (this.notifyCount >= MAX_NOTIFY_PER_TICK) {
        log.warn(
          `[TIKTOK] batas ${MAX_NOTIFY_PER_TICK} notifikasi per siklus tercapai, sisanya ditunda`
        );
        break;
      }
      // Jeda antar grup supaya pengiriman tidak terlihat seperti spam.
      if (attempted > 0) {
        await sleep(
          NOTIFY_GAP_MIN_MS +
            Math.floor(Math.random() * (NOTIFY_GAP_MAX_MS - NOTIFY_GAP_MIN_MS + 1))
        );
      }
      attempted += 1;
      const groupName = (await this.getGroupName(jid)) || meta.groupName || 'grup ini';
      const required = requiredHashtagsFor(this.store, jid, video, this.cfg);
      const hashtagStatus = hashtagStatusFor(video.caption, required);
      const baseText = formatArchiveAlert(video, {
        profile,
        diff: meta.diff,
        currentCount: meta.currentCount,
        groupName,
        checkHashtag: meta.checkHashtag !== false,
        hashtagStatus,
        countOnly: Boolean(meta.countOnly),
      });

      const mentions = [...userMap.keys()].filter((u) => !/@lid$/i.test(u));
      const mentionLine = mentions.length
        ? `\n🙋 UP oleh: ${mentions.map((u) => `@${jidUser(u)}`).join(', ')}`
        : '';
      const text = baseText + mentionLine;

      try {
        // Utamakan avatar profil seperti monitor ALYA MD; kalau gagal pakai
        // cover video, lalu fallback teks biasa.
        const imageUrl =
          (profile &&
            ((profile.profile && (profile.profile.avatarLarger ||
              profile.profile.avatarMedium ||
              profile.profile.avatarThumb)) ||
              profile.avatar)) ||
          video.cover;
        let sent = false;
        if (imageUrl) {
          try {
            const got = await downloadBytes(imageUrl, 8 * 1024 * 1024, 20000);
            if (/^image\//i.test(got.mime || '')) {
              await wa.sendImage(jid, got.data, text, null, got.mime, mentions);
              sent = true;
            }
          } catch (err) {
            log.debug(`[TIKTOK] avatar/cover ${video.id} gagal: ${shortError(err)}`);
          }
        }
        if (!sent) await wa.sendText(jid, text, null, mentions);
        this.rememberNotified(dedupeKey);
        this.notifyCount += 1;
      } catch (err) {
        // Jangan log.error: kegagalan kirim bisa memicu alert owner berulang
        // dan justru menambah risiko pembatasan WhatsApp.
        log.warn(`[TIKTOK] notif ke ${jid} gagal: ${shortError(err)}`);
      }
    }
  }

  rememberNotified(key) {
    this.notified.add(key);
    if (this.notified.size <= 1000) return;
    // Set hanya menyimpan penanda terbaru; 400 entri pertama dibuang.
    const drop = this.notified.size - 600;
    let i = 0;
    for (const item of this.notified) {
      this.notified.delete(item);
      if (++i >= drop) break;
    }
  }
}

module.exports = {
  TikTokMonitor,
  fetchUserVideos,
  buildVideoData,
  formatDetectorMessage,
  formatArchiveAlert,
  hashtagStatusFor,
  requiredHashtagsFor,
  captionHasHashtag,
  nicknameMatchesCn,
};
