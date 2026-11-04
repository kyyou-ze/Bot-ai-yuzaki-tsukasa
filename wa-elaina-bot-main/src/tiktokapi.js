'use strict';

const { fetchWithTimeout } = require('./util');

// UA desktop dipakai semua request TikTok supaya tidak langsung dicurigai bot.
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_COUNT = 12;
const TIKWM_HOSTS = ['https://www.tikwm.com', 'https://tikwm.com'];
const TIKHUB_BASE = 'https://api.tikhub.io/api/v1/tiktok';
const DEFAULT_API23_URL =
  'https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id={username}&count={count}';
const DEFAULT_API23_HOST = 'tiktok-api23.p.rapidapi.com';
const TIKLYDOWN_URL = 'https://api.tiklydown.eu.org/api/download?url={url}';

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
      console.warn(
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
  return /(?:\b403\b|WAF|cloudflare|just a moment|slardarClientWAF|access denied)/i.test(text);
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

/**
 * Ambil daftar upload dari beberapa API. Provider yang tidak dikonfigurasi
 * (mengembalikan null) dilewati. Error 403/WAF di satu provider tidak
 * menghentikan provider berikutnya.
 */
async function fetchUserPostsApi(unique, cfg = {}) {
  const providers = [
    ['custom', postsCustom],
    ['tikhub', postsTikHub],
    ['tiktok-api23', postsApi23],
    ['ensig', postsEnsig],
    ['tikwm', postsTikwm],
  ];

  const errors = [];
  let waf = false;

  for (const [name, fn] of providers) {
    try {
      const items = await fn(cfg, unique);
      if (items === null) continue;
      return { items, provider: name };
    } catch (err) {
      if (isWafError(err)) waf = true;
      errors.push(`${name}: ${err.message}`);
    }
  }

  const err = new Error(errors.join(' | ') || 'gagal mengambil video TikTok');
  err.waf = waf;
  throw err;
}

// ---------- provider info video (download) ----------
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

async function infoTikwm(cfg, link) {
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
  const providers = [
    ['custom', infoCustom],
    ['tikhub', infoTikHub],
    ['tiktok-api23', infoApi23],
    ['ensig', infoEnsig],
    ['tiklydown', infoTiklydown],
    ['tikwm', infoTikwm],
  ];

  const errors = [];
  let waf = false;

  for (const [name, fn] of providers) {
    try {
      const media = await fn(cfg, link);
      if (media === null) continue;
      if (!media.video && !media.images.length) {
        throw new Error(`${name}: tidak ada URL media di respons`);
      }
      return media;
    } catch (err) {
      if (isWafError(err)) waf = true;
      errors.push(`${name}: ${err.message}`);
    }
  }

  const err = new Error(errors.join(' | ') || 'gagal mengambil media TikTok');
  err.waf = waf;
  throw err;
}

module.exports = {
  DESKTOP_UA,
  desktopHeaders,
  tiktokFetch,
  fillTemplate,
  isWafError,
  extractVideoArray,
  extractMedia,
  fetchUserPostsApi,
  fetchVideoInfoApi,
};
