'use strict';

const log = require('./logger');
const { fetchWithTimeout } = require('./util');
const { fetchVideoInfoEmbed } = require('./tiktoklocal');

// UA desktop dipakai semua request TikTok supaya tidak langsung dicurigai bot.
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_COUNT = 12;
const TIKWM_HOSTS = ['https://www.tikwm.com', 'https://tikwm.com'];
const TIKHUB_BASE = 'https://api.tikhub.io/api/v1/tiktok';
// Jina Reader dipakai sebagai "jembatan" untuk membaca halaman profil TikTok.
// Server Jina yang mengambil halaman, jadi IP bot tidak langsung kena WAF.
const JINA_READER_BASE = 'https://r.jina.ai/';
const DEFAULT_API23_URL =
  'https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id={username}&count={count}';
const DEFAULT_API23_HOST = 'tiktok-api23.p.rapidapi.com';
const TIKLYDOWN_URL = 'https://api.tiklydown.eu.org/api/download?url={url}';

// ---------- endpoint dari ALYA MD ----------
// Scraper profil & daftar upload memakai endpoint yang dipakai fitur TikTok
// ALYA MD. Kunci ini publik di source-nya dan tidak butuh env tambahan.
const TIKWM_API_BASE = 'https://api.tikwmapi.com';
const TIKWM_API_KEY = 'f124edb9b3a77fdf420f3b40f19dc773';
const ARCHIVE_STALK_URL = 'https://api.saipulanuar.eu.org/api/stalk/tiktok';
const NEXRAY_BASE = 'https://api.nexray.web.id/';
// Kunci bawaan ALYA MD bisa kehabisan kuota. Setelah 429, jangan panggil
// endpoint itu tiap akun/tiap tick; beri cooldown supaya monitor tetap cepat.
const ARCHIVE_QUOTA_COOLDOWN_MS = 10 * 60 * 1000;
const ARCHIVE_QUOTA_COOLDOWN_MAX_MS = 60 * 60 * 1000;
const PROVIDER_COOLDOWN_MS = 10 * 60 * 1000;
const PROVIDER_COOLDOWN_MAX_MS = 60 * 60 * 1000;
// Kredensial ditolak (API key salah / belum subscribe) bukan masalah sementara:
// jangan retry tiap tick, nonaktifkan provider cukup lama sampai key diperbaiki.
const PROVIDER_AUTH_COOLDOWN_MS = 60 * 60 * 1000;
// Tanda khas halaman challenge/WAF TikTok. Dipakai untuk membedakan 403 WAF
// dari 403 "API key ditolak" milik provider pihak ketiga.
const WAF_SIGNATURE_RE =
  /WAF|cloudflare|just a moment|slardarClientWAF|access denied|performing security verification|ratelimit triggered|_wafchallengeid|please wait\.\.\./i;
// Frasa khas 401/403 dari provider API berbayar. Sengaja tidak memakai "403"
// saja supaya WAF TikTok (HTML challenge) tidak ikut terdeteksi sebagai auth.
const AUTH_ERROR_RE =
  /not subscribed to this api|invalid api key|invalid key|invalid subscription|subscription (?:expired|required|not found|inactive)|api key (?:is )?(?:invalid|missing|required|expired|not found)|unauthorized|not authorized|you (?:are|do) not have access|permission denied/i;
let archivePostsBlockedUntil = 0;
let archiveQuotaStrikes = 0;
const providerBlockedUntil = new Map();
const providerStrikes = new Map();
const authWarned = new Set();

/** Deteksi error kuota/rate-limit supaya tidak dianggap error fatal. */
function isRateLimitError(err) {
  if (!err) return false;
  if (err.rateLimited) return true;
  if (Number(err.status) === 429) return true;
  return /kuota|quota|rate.?limit|too many requests|limit exceeded|cooldown sementara/i.test(
    String(err.message || err)
  );
}

/** Deteksi API key/langganan ditolak (permanen sampai key diperbaiki). */
function isAuthError(err) {
  if (!err) return false;
  const text = String(err.message || err);
  // Pesan gabungan yang juga mengandung tanda WAF tetap dianggap WAF.
  if (WAF_SIGNATURE_RE.test(text)) return false;
  if (Number(err.status) === 401) return true;
  return AUTH_ERROR_RE.test(text);
}

function warnAuthOnce(name, err, waitMs) {
  if (authWarned.has(name)) return;
  authWarned.add(name);
  const detail = String((err && err.message) || err || '').slice(0, 160);
  log.warn(
    `[TIKTOK] ${name} menolak API key/langganan, provider dimatikan ` +
      `${Math.round(waitMs / 60000)} menit. Periksa key/subscription: ${detail}`
  );
}

function providerBlocked(name, now = Date.now()) {
  return (providerBlockedUntil.get(name) || 0) > now;
}

function blockProvider(name, ms = PROVIDER_COOLDOWN_MS) {
  const strikes = (providerStrikes.get(name) || 0) + 1;
  providerStrikes.set(name, strikes);
  const wait = Math.min(
    PROVIDER_COOLDOWN_MAX_MS,
    Math.max(ms, ms * 2 ** Math.min(3, strikes - 1))
  );
  providerBlockedUntil.set(name, Date.now() + wait);
  return wait;
}

function clearProviderBlock(name) {
  providerBlockedUntil.delete(name);
  providerStrikes.delete(name);
  // Provider sudah berhasil lagi (mis. key diperbaiki): izinkan peringatan
  // baru kalau nanti ditolak lagi.
  authWarned.delete(name);
}

function isArchivePostsBlocked(now = Date.now()) {
  return archivePostsBlockedUntil > now;
}

function blockArchivePosts(ms = ARCHIVE_QUOTA_COOLDOWN_MS) {
  archiveQuotaStrikes += 1;
  const wait = Math.min(
    ARCHIVE_QUOTA_COOLDOWN_MAX_MS,
    Math.max(ms, ms * 2 ** Math.min(3, archiveQuotaStrikes - 1))
  );
  archivePostsBlockedUntil = Date.now() + wait;
  return wait;
}

// ---------- proxy rotation ----------
// Proxy memakai ProxyAgent dari paket undici. Paket undici bersifat opsional:
// kalau belum terpasang, request tetap jalan langsung tanpa proxy.
let undiciModule;
let proxyWarned = false;
let proxyCursor = 0;
const proxyAgents = new Map();

function loadUndici() {
  if (undiciModule !== undefined) return undiciModule;
  try {
    undiciModule = require('undici');
  } catch {
    undiciModule = null;
  }
  return undiciModule;
}

function nextProxy(cfg) {
  const urls = Array.isArray(cfg && cfg.tiktokProxyUrls)
    ? cfg.tiktokProxyUrls.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  if (!urls.length) return null;

  const mod = loadUndici();
  if (!mod || typeof mod.ProxyAgent !== 'function') {
    if (!proxyWarned) {
      log.warn(
        '[TIKTOK] TIKTOK_PROXY_URLS diisi tapi paket "undici" belum terpasang; proxy dilewati.'
      );
      proxyWarned = true;
    }
    return null;
  }

  const url = urls[proxyCursor % urls.length];
  proxyCursor += 1;
  return url;
}

function agentFor(mod, proxyUrl) {
  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    agent = new mod.ProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
  }
  return agent;
}

async function tiktokFetch(url, options = {}, timeoutMs = 30000, cfg = {}) {
  const proxy = nextProxy(cfg);
  if (!proxy) return fetchWithTimeout(url, options, timeoutMs);

  const mod = loadUndici();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();

  return mod.fetch(url, {
    ...options,
    signal: controller.signal,
    dispatcher: agentFor(mod, proxy),
  });
}

/**
 * Baca halaman lewat Jina Reader (https://r.jina.ai). Dipakai untuk profil
 * TikTok karena halaman langsung sering diblokir Cloudflare/WAF. Jina
 * mengembalikan teks/markdown, bukan HTML mentah.
 */
async function readViaJina(targetUrl, cfg = {}, timeoutMs = 45000, format = 'markdown') {
  const base = String((cfg && cfg.tiktokJinaBase) || JINA_READER_BASE).trim();
  const readerUrl = base.replace(/\/?$/, '/') + String(targetUrl || '');
  const headers = {
    Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.8',
    'User-Agent': DESKTOP_UA,
    'X-Return-Format': format || 'markdown',
    // Wajib: tanpa ini Jina bisa mengembalikan halaman cache lama sehingga
    // video baru tidak terdeteksi.
    'X-No-Cache': 'true',
    'X-Timeout': '30',
  };
  const key = String((cfg && cfg.tiktokJinaKey) || '').trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetchWithTimeout(
    readerUrl,
    { headers, redirect: 'follow' },
    Math.max(10000, Number(timeoutMs) || 45000)
  );
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 180);
    const err = new Error(`Jina HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`);
    err.status = res.status;
    throw err;
  }
  if (!text.trim()) throw new Error('Jina: respons kosong');
  return text;
}

// ---------- header & helper ----------
function desktopHeaders(cfg, extra = {}) {
  const headers = {
    'User-Agent': DESKTOP_UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    Referer: 'https://www.tiktok.com/',
    Origin: 'https://www.tiktok.com',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    ...extra,
  };
  if (cfg && cfg.tiktokCookie) headers.Cookie = cfg.tiktokCookie;
  return headers;
}

function fillTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] === undefined ? match : encodeURIComponent(String(vars[key]))
  );
}

function isWafError(err) {
  const text = String((err && err.message) || err || '');
  if (WAF_SIGNATURE_RE.test(text)) return true;
  // 403 biasa tetap dianggap WAF (perilaku lama), kecuali jelas error auth
  // provider seperti "You are not subscribed to this API".
  return /\b403\b/.test(text) && !isAuthError(err);
}

function assertApiOk(json, label) {
  if (!json || typeof json !== 'object') throw new Error(`${label}: respons kosong`);
  if (json.error) {
    const msg =
      typeof json.error === 'string'
        ? json.error
        : json.error.message || json.error.msg || JSON.stringify(json.error).slice(0, 160);
    throw new Error(`${label}: ${msg}`);
  }
  const code = json.code ?? json.status_code;
  if (typeof code === 'number' && code !== 0 && code !== 200) {
    throw new Error(`${label}: ${json.msg || json.message || `code ${code}`}`);
  }
}

async function requestJson(url, cfg, extraHeaders, label) {
  const res = await tiktokFetch(
    url,
    { headers: desktopHeaders(cfg, extraHeaders), redirect: 'follow' },
    30000,
    cfg
  );
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 180);
    const err = new Error(`${label} HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`);
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: respons bukan JSON`);
  }
}

function hasVideoShape(o) {
  if (!o || typeof o !== 'object') return false;
  const id = o.id || o.video_id || o.aweme_id || o.item_id;
  const hasCaption =
    o.desc !== undefined || o.title !== undefined || o.caption !== undefined;
  const hasAuthor =
    o.author || o.authorInfo || o.user || o.author_user || o.unique_id || o.uniqueId;
  return Boolean(id && hasCaption && hasAuthor);
}

function extractVideoArray(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;

  const roots = [json, json.data, json.result];
  for (const root of roots) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
    const candidates = [
      root.videos,
      root.itemList,
      root.item_list,
      root.items,
      root.posts,
      root.user_posts,
      root.aweme_list,
      root.awemeList,
      root.data,
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
  }

  // Sebagian API membungkus hasil dua kali (data.data.item_list).
  if (json.data && typeof json.data === 'object') {
    for (const key of ['videos', 'itemList', 'item_list', 'items', 'posts', 'user_posts', 'aweme_list']) {
      if (Array.isArray(json.data[key])) return json.data[key];
    }
  }
  return [];
}

function extractAwemeId(link) {
  const m = String(link || '').match(/\/video\/(\d{6,})/);
  return m ? m[1] : '';
}

function normalizeAccountish(value) {
  return String(value || '').trim().replace(/^@+/, '');
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstUrl(item);
      if (url) return url;
    }
    return '';
  }
  if (typeof value === 'object') {
    return firstUrl(value.url_list || value.urlList || value.url || value.play || value.download);
  }
  return '';
}

/**
 * Ambil URL media dari berbagai bentuk respons API TikTok.
 * Dipakai untuk download video/foto, bukan untuk daftar upload.
 */
function extractMedia(json) {
  if (!json || typeof json !== 'object') return { video: '', audio: '', images: [] };
  let data = json.data && typeof json.data === 'object' ? json.data : json;
  // Sebagian provider membungkus lagi: { data: { data: { ... } } }.
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    data = data.data;
  }
  const item =
    data.aweme_detail || data.aweme || data.item_info || data.item || data.video_info || data;

  const video = firstString(
    item.play,
    item.video_url,
    item.videoUrl,
    item.download_url,
    item.downloadUrl,
    item.hdplay,
    item.wmplay,
    firstUrl(item.play_addr),
    firstUrl(item.playAddr),
    firstUrl(item.download_addr),
    firstUrl(item.video && item.video.play_addr),
    firstUrl(item.video && item.video.playAddr),
    firstUrl(item.video && item.video.downloadAddr),
    firstUrl(item.video && item.video.download_addr),
    firstUrl(data.video && data.video.play),
    firstUrl(data.video && data.video.noWatermark),
    firstUrl(data.video && data.video.no_watermark),
    firstUrl(data.video && data.video.watermark)
  );

  const audio = firstString(
    item.music,
    item.music_url,
    item.musicUrl,
    firstUrl(item.music_info && item.music_info.play_url),
    firstUrl(item.music && item.music.play_url),
    firstUrl(item.music && item.music.playUrl),
    firstUrl(data.music && data.music.play),
    firstUrl(data.music && data.music.play_url),
    firstUrl(data.music && data.music.url)
  );

  const images = [];
  const imageCandidates = [
    item.images,
    item.image_list,
    item.imageList,
    item.image_post_info && item.image_post_info.images,
    data.images,
    data.image_list,
    data.imageList,
    data.image_post_info && data.image_post_info.images,
  ];
  for (const list of imageCandidates) {
    if (!Array.isArray(list)) continue;
    for (const img of list) {
      const url = firstUrl(
        img && (img.display_image || img.displayImage || img.image || img.url || img)
      );
      if (url && !images.includes(url)) images.push(url);
    }
    if (images.length) break;
  }

  return { video: video || '', audio: audio || '', images };
}

// ---------- provider daftar upload ----------
async function postsCustom(cfg, unique) {
  const template = String((cfg && cfg.tiktokApiUrl) || '').trim();
  if (!template) return null;
  const url = fillTemplate(template, { username: unique, count: DEFAULT_COUNT });
  const headers = {};
  if (cfg.tiktokApiKey) {
    headers['x-api-key'] = cfg.tiktokApiKey;
    headers.Authorization = `Bearer ${cfg.tiktokApiKey}`;
  }
  const json = await requestJson(url, cfg, headers, 'API custom');
  assertApiOk(json, 'API custom');
  return extractVideoArray(json);
}

async function postsTikHub(cfg, unique) {
  const key = String((cfg && cfg.tikhubApiKey) || '').trim();
  if (!key) return null;
  const url =
    `${TIKHUB_BASE}/app/v3/fetch_user_post_videos?unique_id=` +
    `${encodeURIComponent(unique)}&count=${DEFAULT_COUNT}`;
  const json = await requestJson(url, cfg, { Authorization: `Bearer ${key}` }, 'TikHub');
  assertApiOk(json, 'TikHub');
  return extractVideoArray(json);
}

async function postsApi23(cfg, unique) {
  const key = String((cfg && cfg.tiktokApi23Key) || '').trim();
  if (!key) return null;
  const template = String((cfg && cfg.tiktokApi23Url) || DEFAULT_API23_URL).trim();
  const url = fillTemplate(template, { username: unique, count: DEFAULT_COUNT });
  const headers = {
    'x-rapidapi-key': key,
    'x-rapidapi-host': (cfg && cfg.tiktokApi23Host) || DEFAULT_API23_HOST,
  };
  const json = await requestJson(url, cfg, headers, 'tiktok-api23');
  assertApiOk(json, 'tiktok-api23');
  return extractVideoArray(json);
}

async function postsEnsig(cfg, unique) {
  const template = String((cfg && cfg.ensigApiUrl) || '').trim();
  if (!template) return null;
  const url = fillTemplate(template, { username: unique, count: DEFAULT_COUNT });
  const key = String((cfg && cfg.ensigApiKey) || '').trim();
  const headers = {};
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['x-api-key'] = key;
  }
  const json = await requestJson(url, cfg, headers, 'Ensig');
  assertApiOk(json, 'Ensig');
  return extractVideoArray(json);
}

/**
 * Daftar upload dari api.tikwmapi.com (endpoint ALYA MD). Endpoint yang sama
 * dipakai monitor untuk mengambil video terbaru, jadi hanya butuh satu sumber
 * saat scraper lokal/Jina sedang diblokir.
 */
async function postsTikwmApiCom(cfg, unique, count = DEFAULT_COUNT) {
  if (isArchivePostsBlocked()) {
    const err = new Error('tikwmapi: kuota habis, tunggu cooldown');
    err.rateLimited = true;
    throw err;
  }
  const key = String((cfg && cfg.tiktokTikwmApiKey) || TIKWM_API_KEY).trim();
  const url =
    `${TIKWM_API_BASE}/user/posts?unique_id=${encodeURIComponent(unique)}` +
    `&count=${Math.max(1, Number(count) || DEFAULT_COUNT)}&cursor=0`;
  const res = await tiktokFetch(
    url,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': DESKTOP_UA,
        'x-tikwmapi-key': key,
      },
      redirect: 'follow',
    },
    30000,
    cfg
  );
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    if (res.status === 429 || /quota|kuota/i.test(text)) {
      blockArchivePosts();
    }
    const snippet = text.replace(/\s+/g, ' ').slice(0, 180);
    const err = new Error(`tikwmapi HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`);
    if (res.status === 429) err.status = 429;
    throw err;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('tikwmapi: respons bukan JSON');
  }
  if (!json || json.code !== 0) {
    const msg = (json && (json.msg || json.message)) || 'respons tidak valid';
    if (/quota|kuota|limit/i.test(msg)) blockArchivePosts();
    const err = new Error(`tikwmapi: ${msg}`);
    if (/quota|kuota|limit/i.test(msg)) err.rateLimited = true;
    throw err;
  }
  archiveQuotaStrikes = 0;
  return extractVideoArray(json);
}

/**
 * Video terbaru dalam bentuk yang dipakai alert ALYA MD. Mengembalikan null
 * bila API tidak memberi video, supaya monitor bisa jatuh ke jalur lain.
 */
async function fetchTikwmApiComLatest(unique, cfg = {}) {
  const items = await postsTikwmApiCom(cfg, unique, 1);
  if (!items.length) return null;
  const v = items[0] || {};
  const id = String(v.video_id || v.aweme_id || v.id || '').trim();
  if (!id) return null;
  const author = v.author || {};
  const username = normalizeAccountish(author.unique_id || author.uniqueId || unique);
  const title = String(v.title || v.desc || v.caption || '').trim();
  const createTime = Number(v.create_time || v.createTime || 0);
  const hashtags = (title.match(/#[\w\u0590-\u05ff]+/g) || []).map((tag) => tag.toLowerCase());
  return {
    id,
    title,
    url: `https://www.tiktok.com/@${username}/video/${id}`,
    cover: v.cover || v.origin_cover || v.dynamic_cover || null,
    createTime,
    takenAt: createTime
      ? new Date(createTime * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : null,
    views: String(v.play_count || 0),
    likes: String(v.digg_count || 0),
    hashtags,
  };
}

async function postsTikwm(cfg, unique) {
  let lastError = null;
  for (const host of TIKWM_HOSTS) {
    const url = `${host}/api/user/posts?unique_id=${encodeURIComponent(
      unique
    )}&count=${DEFAULT_COUNT}`;
    try {
      const json = await requestJson(url, cfg, {}, 'tikwm');
      assertApiOk(json, 'tikwm');
      return extractVideoArray(json);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('tikwm gagal');
}

/** Apakah user sudah mengisi API berbayar/custom untuk daftar upload? */
function hasConfiguredPostsApi(cfg = {}) {
  // Jangan hitung kunci bawaan tikwmapi: kunci publik itu sering kehabisan
  // kuota dan justru membuat monitor mengirim request sia-sia tiap tick.
  // Tanpa konfigurasi eksplisit, archive hanya dipakai sebagai cadangan
  // setelah scraper lokal/Jina gagal.
  return Boolean(
    String((cfg && cfg.tiktokTikwmApiKey) || '').trim() ||
      cfg.tiktokApiUrl ||
      cfg.tikhubApiKey ||
      cfg.tiktokApi23Key ||
      cfg.ensigApiUrl
  );
}

/**
 * Ambil daftar upload dari beberapa API. Provider yang tidak dikonfigurasi
 * (mengembalikan null) dilewati. Error 403/WAF di satu provider tidak
 * menghentikan provider berikutnya. Provider yang kena kuota/429 dilewati
 * selama cooldown supaya tidak membanjiri API dan memicu blokir.
 */
async function fetchUserPostsApi(unique, cfg = {}) {
  const allProviders = [
    ['tikwmapi', postsTikwmApiCom],
    ['custom', postsCustom],
    ['tikhub', postsTikHub],
    ['tiktok-api23', postsApi23],
    ['ensig', postsEnsig],
    ['tikwm', postsTikwm],
  ];
  const providers = allProviders.filter(([name]) => !providerBlocked(name));

  if (!providers.length) {
    const err = new Error('semua sumber daftar video sedang cooldown');
    err.rateLimited = true;
    throw err;
  }
  const blockedCount = allProviders.length - providers.length;

  const errors = [];
  let waf = false;
  let limited = 0;
  let authFailures = 0;
  let attempted = 0;

  for (const [name, fn] of providers) {
    try {
      const items = await fn(cfg, unique);
      if (items === null) continue;
      attempted += 1;
      clearProviderBlock(name);
      return { items, provider: name };
    } catch (err) {
      attempted += 1;
      if (isAuthError(err)) {
        err.auth = true;
        authFailures += 1;
        const wait = blockProvider(name, PROVIDER_AUTH_COOLDOWN_MS);
        warnAuthOnce(name, err, wait);
      } else {
        if (isWafError(err)) waf = true;
        if (isRateLimitError(err)) {
          limited += 1;
          blockProvider(name);
        }
      }
      errors.push(`${name}: ${err.message}`);
    }
  }

  const err = new Error(errors.join(' | ') || 'gagal mengambil video TikTok');
  err.waf = waf;
  if (!errors.length && blockedCount) {
    // Semua provider yang tersisa tidak dikonfigurasi, sementara yang lain
    // sedang cooldown (kuota/auth). Jangan dilaporkan sebagai error TikTok.
    err.message = 'semua sumber daftar video sedang cooldown';
    err.rateLimited = true;
  }
  // Semua provider yang dicoba kena kuota/rate-limit: jangan diperlakukan
  // sebagai error fatal oleh monitor.
  if (limited && limited === attempted) err.rateLimited = true;
  // Semua provider yang benar-benar dipanggil menolak key/langganan: ini
  // masalah konfigurasi, bukan gangguan TikTok, jadi jangan spam alert owner.
  if (authFailures && authFailures === attempted) err.auth = true;
  throw err;
}

// ---------- profil, pencarian, dan tikwm (ALYA MD) ----------
async function archiveRequestJson(url, cfg, label, extraHeaders = {}, timeoutMs = 10000) {
  const res = await tiktokFetch(
    url,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': DESKTOP_UA,
        ...extraHeaders,
      },
      redirect: 'follow',
    },
    timeoutMs,
    cfg
  );
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
  return res.json().catch(() => {
    throw new Error(`${label}: respons bukan JSON`);
  });
}

/**
 * Profil TikTok lewat api.saipulanuar.eu.org dengan cadangan nexray. Bentuk
 * hasilnya sengaja disamakan dengan ALYA MD supaya monitor bisa memakai
 * videoCount, followers, likes, bio, dan avatar untuk alert.
 */
async function fetchTikTokUser(account, cfg = {}) {
  const username = normalizeAccountish(account);
  if (!username) throw new Error('username TikTok kosong');

  if (!providerBlocked('saipulanuar')) {
    try {
      const json = await archiveRequestJson(
        `${ARCHIVE_STALK_URL}?username=${encodeURIComponent(username)}`,
        cfg,
        'stalk TikTok'
      );
      if (json && json.status === true && json.result) {
        clearProviderBlock('saipulanuar');
        return json.result;
      }
    } catch (err) {
      if (isRateLimitError(err)) blockProvider('saipulanuar');
      /* lanjut ke cadangan nexray */
    }
  }

  if (providerBlocked('nexray')) {
    const err = new Error('profil TikTok: semua sumber sedang cooldown');
    err.rateLimited = true;
    throw err;
  }

  let json;
  try {
    json = await archiveRequestJson(
      `${NEXRAY_BASE}stalker/tiktok?username=${encodeURIComponent(username)}`,
      cfg,
      'nexray stalk TikTok'
    );
  } catch (err) {
    if (isRateLimitError(err)) blockProvider('nexray');
    throw err;
  }
  if (!json || !json.status || !json.result) {
    const err = new Error(`akun @${username} tidak ditemukan`);
    err.notFound = true;
    throw err;
  }
  clearProviderBlock('nexray');
  const r = json.result;
  const stats = r.stats || {};
  return {
    username: r.username || username,
    nickname: r.name || r.username || username,
    signature: r.bio || '-',
    createTime: r.create_time
      ? new Date(r.create_time * 1000).toLocaleString('id-ID')
      : '-',
    verified: r.verified || 'Unknown',
    privateAccount: r.private === 'Yes' ? 'Private Account' : 'Public Account',
    followers: stats.raw_followers ?? 0,
    followings: stats.raw_following ?? 0,
    hearts: stats.raw_likes ?? 0,
    heartsCount: stats.raw_likes ?? 0,
    videoCount: stats.raw_videos ?? 0,
    diggCount: 0,
    profile: {
      avatarLarger: r.avatar || null,
      avatarMedium: r.avatar || null,
      avatarThumb: r.avatar || null,
    },
  };
}

/** POST https://www.tikwm.com/api/ persis seperti scraper ALYA MD. */
async function tikwm(link, cfg = {}) {
  const res = await tiktokFetch(
    'https://www.tikwm.com/api/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://www.tikwm.com',
        Referer: 'https://www.tikwm.com/',
        'User-Agent': DESKTOP_UA,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({ url: String(link || ''), hd: '1' }),
    },
    30000,
    cfg
  );
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`tikwm HTTP ${res.status}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('tikwm: respons bukan JSON');
  }
  if (!json || json.code !== 0 || !json.data) {
    throw new Error(`tikwm: ${(json && (json.msg || json.message)) || 'gagal mengambil data'}`);
  }
  return json.data;
}

/** Pencarian TikTok lewat guaikei.com (fitur pencarian ALYA MD). */
async function tiktokSearch(keyword, cfg = {}) {
  const q = String(keyword || '').trim();
  if (!q) throw new Error('kata kunci kosong');
  const url =
    'https://www.guaikei.com/api/tiktok/search?keyword=' +
    encodeURIComponent(q) +
    '&sort=0&limit=10';
  const json = await archiveRequestJson(url, cfg, 'tiktok search', {}, 30000);
  const results = (json && (json.results || json.data)) || [];
  if (!Array.isArray(results) || !results.length) {
    throw new Error('tiktok search: tidak ada hasil');
  }
  return results;
}

// ---------- provider info video (download) ----------
async function infoLocal(cfg, link) {
  if (cfg && cfg.tiktokLocalEnabled === false) return null;
  return fetchVideoInfoEmbed(
    link,
    cfg,
    (url, options, timeoutMs) => tiktokFetch(url, options, timeoutMs, cfg)
  );
}

async function infoCustom(cfg, link) {
  const template = String((cfg && cfg.tiktokDlApiUrl) || '').trim();
  if (!template) return null;
  const url = fillTemplate(template, { url: link });
  const headers = {};
  if (cfg.tiktokDlApiKey) {
    headers['x-api-key'] = cfg.tiktokDlApiKey;
    headers.Authorization = `Bearer ${cfg.tiktokDlApiKey}`;
  }
  const json = await requestJson(url, cfg, headers, 'API download custom');
  assertApiOk(json, 'API download custom');
  return extractMedia(json);
}

async function infoTikHub(cfg, link) {
  const key = String((cfg && cfg.tikhubApiKey) || '').trim();
  if (!key) return null;
  const id = extractAwemeId(link);
  if (!id) return null;
  const url = `${TIKHUB_BASE}/app/v3/fetch_one_video?aweme_id=${encodeURIComponent(id)}`;
  const json = await requestJson(url, cfg, { Authorization: `Bearer ${key}` }, 'TikHub');
  assertApiOk(json, 'TikHub');
  return extractMedia(json);
}

async function infoApi23(cfg, link) {
  const key = String((cfg && cfg.tiktokApi23Key) || '').trim();
  if (!key) return null;
  const template = String(
    (cfg && cfg.tiktokApi23DlUrl) || 'https://tiktok-api23.p.rapidapi.com/api/post?url={url}'
  ).trim();
  const url = fillTemplate(template, { url: link });
  const headers = {
    'x-rapidapi-key': key,
    'x-rapidapi-host': (cfg && cfg.tiktokApi23Host) || DEFAULT_API23_HOST,
  };
  const json = await requestJson(url, cfg, headers, 'tiktok-api23');
  assertApiOk(json, 'tiktok-api23');
  return extractMedia(json);
}

async function infoEnsig(cfg, link) {
  const template = String((cfg && cfg.ensigDlUrl) || '').trim();
  if (!template) return null;
  const url = fillTemplate(template, { url: link, username: '', count: '' });
  const key = String((cfg && cfg.ensigApiKey) || '').trim();
  const headers = {};
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['x-api-key'] = key;
  }
  const json = await requestJson(url, cfg, headers, 'Ensig');
  assertApiOk(json, 'Ensig');
  return extractMedia(json);
}

async function infoTiklydown(cfg, link) {
  const url = fillTemplate(TIKLYDOWN_URL, { url: link });
  const json = await requestJson(url, cfg, {}, 'tiklydown');
  assertApiOk(json, 'tiklydown');
  return extractMedia(json);
}

/** Decode URL yang ditulis sebagai string JSON di dalam HTML. */
function decodeJsUrl(value) {
  return String(value || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u003F/gi, '?')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
}

/**
 * Ambil URL media dari HTML yang dikembalikan Jina Reader.
 *
 * Halaman video TikTok menyimpan JSON pemutar dengan `playAddr` /
 * `downloadAddr`. Karena HTML diambil oleh server Jina, IP panel tidak
 * menyentuh WAF TikTok sama sekali. Dipakai sebagai fallback terakhir saat
 * embed lokal dan API publik sama-sama diblokir.
 */
function extractJinaHtmlMedia(html) {
  const text = String(html || '');
  if (!text) return null;

  const pick = (re) => {
    const match = text.match(re);
    return match ? decodeJsUrl(match[1]) : '';
  };

  let video = pick(/"playAddr"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!video) video = pick(/"downloadAddr"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!video) {
    video = pick(
      /"play_addr"\s*:\s*\{[\s\S]{0,240}?"url_list"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/
    );
  }

  const images = [];
  const addImage = (value) => {
    const url = decodeJsUrl(value);
    if (url && /^https?:\/\//i.test(url) && !images.includes(url)) images.push(url);
  };

  for (const re of [
    /"imageURL"\s*:\s*\{\s*"urlList"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/g,
    /"displayImage"\s*:\s*\{\s*"urlList"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/g,
  ]) {
    let match;
    while ((match = re.exec(text)) && images.length < 20) addImage(match[1]);
  }

  if (!video && !images.length) return null;
  return {
    video,
    audio: '',
    images,
    partial: false,
  };
}

async function infoJina(cfg, link) {
  if (cfg && cfg.tiktokJinaEnabled === false) return null;
  if (!extractAwemeId(link)) return null;
  const html = await readViaJina(link, cfg, 60000, 'html');
  const media = extractJinaHtmlMedia(html);
  if (!media) {
    if (isWafError(html)) throw new Error('Jina HTML: halaman video diblokir WAF TikTok');
    throw new Error('Jina: media video tidak ditemukan di halaman');
  }
  return media;
}

async function infoTikwmPost(cfg, link) {
  const data = await tikwm(link, cfg);
  return extractMedia(data);
}

async function infoTikwmGet(cfg, link) {
  let lastError = null;
  for (const host of TIKWM_HOSTS) {
    try {
      const json = await requestJson(
        `${host}/api/?url=${encodeURIComponent(link)}`,
        cfg,
        {},
        'tikwm'
      );
      assertApiOk(json, 'tikwm');
      return extractMedia(json);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('tikwm gagal');
}

async function fetchVideoInfoApi(link, cfg = {}) {
  // TikWM diletakkan sebelum tiklydown karena endpoint tiklydown sering
  // mati/TLS error; kalau ditaruh duluan, download jadi lambat 30 detik
  // sebelum akhirnya jatuh ke TikWM.
  const allProviders = [
    ['local', infoLocal],
    // Scraper ALYA MD: POST tikwm.com/api/ (paling dekat dengan implementasi
    // archive), lalu provider custom/berbayar sebagai cadangan.
    ['tikwm', infoTikwmPost],
    ['custom', infoCustom],
    ['tikhub', infoTikHub],
    ['tiktok-api23', infoApi23],
    ['ensig', infoEnsig],
    ['tikwm-get', infoTikwmGet],
    ['tiklydown', infoTiklydown],
    // Fallback terakhir: halaman diambil server Jina, jadi bebas WAF IP panel.
    ['jina', infoJina],
  ];
  // Provider yang API key-nya ditolak (401/403 subscription) dilewati sampai
  // cooldown selesai, supaya tiap download tidak menunggu request sia-sia.
  const providers = allProviders.filter(([name]) => !providerBlocked(name));

  const errors = [];
  let waf = false;
  // Foto/carousel dari embed lokal hanya berisi cover pertama. Simpan sebagai
  // cadangan terakhir supaya carousel lengkap dari provider lain tetap dicoba.
  let partial = null;

  for (const [name, fn] of providers) {
    try {
      const media = await fn(cfg, link);
      if (media === null) continue;
      if (!media.video && !media.images.length) {
        throw new Error(`${name}: tidak ada URL media di respons`);
      }
      if (media.partial) {
        if (!partial) partial = media;
        continue;
      }
      clearProviderBlock(name);
      return media;
    } catch (err) {
      if (isAuthError(err)) {
        err.auth = true;
        const wait = blockProvider(name, PROVIDER_AUTH_COOLDOWN_MS);
        warnAuthOnce(name, err, wait);
      } else if (isWafError(err)) {
        waf = true;
      }
      errors.push(`${name}: ${err.message}`);
    }
  }

  if (partial) return partial;

  const err = new Error(errors.join(' | ') || 'gagal mengambil media TikTok');
  err.waf = waf;
  throw err;
}

module.exports = {
  DESKTOP_UA,
  desktopHeaders,
  tiktokFetch,
  readViaJina,
  fillTemplate,
  isWafError,
  isRateLimitError,
  isAuthError,
  isArchivePostsBlocked,
  hasConfiguredPostsApi,
  extractVideoArray,
  extractMedia,
  extractJinaHtmlMedia,
  infoJina,
  fetchUserPostsApi,
  fetchVideoInfoApi,
  postsTikwmApiCom,
  fetchTikwmApiComLatest,
  fetchTikTokUser,
  tikwm,
  tiktokSearch,
};
