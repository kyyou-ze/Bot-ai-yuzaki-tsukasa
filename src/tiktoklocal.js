'use strict';

const log = require('./logger');
const { fetchWithTimeout } = require('./util');

/**
 * Scraper TikTok lokal (jalan di proses bot / panel Pterodactyl).
 *
 * Halaman profil biasa (https://www.tiktok.com/@user) hampir selalu diblokir
 * WAF Slardar dari IP datacenter. Halaman embed creator TIDAK:
 *
 *   https://www.tiktok.com/embed/@username
 *
 * Halaman itu di-render di server TikTok dan menyimpan JSON
 * `__FRONTITY_CONNECT_STATE__` berisi userInfo (nickname, bio, avatar) dan
 * videoList (id, caption/desc, cover, URL video). Tidak perlu API key, tidak
 * perlu signature X-Bogus, dan tidak kena challenge "Please wait...".
 *
 * Modul ini sengaja tidak mengimpor tiktokapi.js supaya tidak ada circular
 * dependency. Pemanggil bisa mengoper `request` (mis. tiktokFetch) agar
 * rotasi proxy tetap dipakai.
 */

const EMBED_BASE = 'https://www.tiktok.com/embed/@';
// www.tiktok.com kadang gagal resolve/403 dari IP panel, sedangkan
// m.tiktok.com justru sering lolos WAF. Coba beberapa host sebelum menyerah.
const DEFAULT_EMBED_HOSTS = ['https://www.tiktok.com', 'https://m.tiktok.com'];
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

// Cache singkat: detector bisa memanggil akun yang sama berkali-kali ketika
// ada beberapa video baru. Cukup satu request embed per beberapa detik.
const PROFILE_CACHE_TTL_MS = 30 * 1000;
const profileCache = new Map();

// Host yang baru saja kena WAF dilewati sementara supaya permintaan berikutnya
// tidak membentur tembok yang sama terus.
const HOST_COOLDOWN_MS = 90 * 1000;
const hostState = new Map();
let preferredHost = '';

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, ms));
    if (typeof timer.unref === 'function') timer.unref();
  });
}

function embedHosts(cfg = {}) {
  const configured = Array.isArray(cfg && cfg.tiktokEmbedHosts)
    ? cfg.tiktokEmbedHosts
    : [];
  const source = configured.length ? configured : DEFAULT_EMBED_HOSTS;
  const out = [];
  for (const item of source) {
    let base = String(item || '').trim().replace(/\/+$/, '');
    if (!base) continue;
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    // Terima juga host yang sudah mengandung /embed.
    base = base.replace(/\/embed(\/.*)?$/i, '');
    if (!out.includes(base)) out.push(base);
  }
  if (!out.length) out.push(...DEFAULT_EMBED_HOSTS);
  // Host yang terakhir berhasil didahulukan agar request berikutnya cepat.
  if (preferredHost && out.includes(preferredHost)) {
    return [preferredHost, ...out.filter((h) => h !== preferredHost)];
  }
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url || '');
  }
}

function stripAt(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[/?#].*$/, '');
}

function uniqueFromInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const url = raw.match(
    /tiktok\.com\/@([A-Za-z0-9._-]+)/i
  );
  if (url) return url[1];
  return stripAt(raw);
}

function videoIdFromInput(input) {
  const raw = String(input || '');
  const m = raw.match(/\/(?:video|photo)\/(\d{6,})/i);
  return m ? m[1] : '';
}

/** ID video TikTok adalah snowflake; 32 bit atas = Unix detik. */
function timestampFromVideoId(id) {
  try {
    const seconds = Number(BigInt(String(id)) >> 32n);
    if (seconds > 1000000000 && seconds < 4102444800) return seconds;
  } catch {
    /* bukan angka */
  }
  return 0;
}

function requestHeaders(cfg = {}, extra = {}) {
  const headers = {
    'User-Agent': DESKTOP_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    Referer: 'https://www.tiktok.com/',
    // Halaman embed dimuat di dalam iframe; header ini membuat request terlihat
    // seperti embed asli, bukan bot yang mengambil halaman profil.
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...extra,
  };
  // Cookie opsional (TIKTOK_COOKIE). Embed biasanya tetap jalan tanpa cookie.
  if (cfg && cfg.tiktokCookie) headers.Cookie = cfg.tiktokCookie;
  return headers;
}

function isChallenge(html) {
  return /slardarClientWAF|Please wait\.\.\.|id="_wafchallengeid"|(?:verify|captcha).{0,30}(?:human|robot)|access denied/i.test(
    String(html || '')
  );
}

function retryAfterMs(res) {
  try {
    const raw = res && res.headers && res.headers.get
      ? res.headers.get('retry-after')
      : '';
    if (!raw) return 0;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(30000, seconds * 1000);
    const at = Date.parse(raw);
    if (Number.isFinite(at)) return Math.min(30000, Math.max(0, at - Date.now()));
  } catch {
    /* abaikan header rusak */
  }
  return 0;
}

function isNotFoundPage(html) {
  return /couldn.?t find this account|could not find this account|user not found|doesn.t exist|account is private/i.test(
    String(html || '')
  );
}

function wafError(message) {
  const err = new Error(message);
  err.waf = true;
  return err;
}


/**
 * Ambil JSON state embed. Kalau struktur berubah, cari `videoList` secara
 * rekursif supaya scraper tetap hidup.
 */
function parseEmbedState(html) {
  const text = String(html || '');
  const match = text.match(
    /<script[^>]*id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/i
  );

  let state = null;
  if (match) {
    try {
      state = JSON.parse(match[1]);
    } catch {
      state = null;
    }
  }
  if (!state) return null;

  const sources =
    state &&
    state.source &&
    state.source.data &&
    typeof state.source.data === 'object'
      ? state.source.data
      : null;

  if (sources) {
    for (const value of Object.values(sources)) {
      if (
        value &&
        typeof value === 'object' &&
        Array.isArray(value.videoList)
      ) {
        return value;
      }
    }
  }

  // Fallback: telusuri seluruh state.
  const stack = [state];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node.videoList)) return node;
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return null;
}

function profileFromEmbed(data, unique) {
  const info = (data && data.userInfo) || {};
  return {
    uniqueId: stripAt(info.uniqueId || unique),
    nickname: String(info.nickname || '').trim(),
    signature: String(info.signature || '').trim(),
    avatar: String(info.avatarThumbUrl || '').trim(),
    verified: Boolean(info.verified),
    privateAccount: Boolean(info.privateAccount),
    followers: Number(info.followerCount || 0),
  };
}

/**
 * Ubah videoList embed menjadi bentuk yang dipahami normalizeVideo() di
 * tiktokmonitor.js (aweme_id, author, desc, cover, link).
 */
function videosFromEmbed(data, unique) {
  const acc = stripAt(unique);
  const profile = profileFromEmbed(data, acc);
  const out = [];
  const seen = new Set();

  for (const item of Array.isArray(data && data.videoList) ? data.videoList : []) {
    const id = String((item && item.id) || '').trim();
    if (!/^\d{6,}$/.test(id) || seen.has(id)) continue;
    seen.add(id);

    const desc = String(item.desc || '').trim();
    const cover =
      item.originCoverUrl || item.coverUrl || item.dynamicCoverUrl || '';
    out.push({
      video_id: id,
      author: {
        unique_id: stripAt(item.authorUniqueId) || acc,
        nickname: profile.nickname,
      },
      desc,
      create_time: timestampFromVideoId(id),
      cover,
      // URL video langsung dari player embed. Foto post tidak punya playAddr.
      play_addr: String(item.playAddr || ''),
      is_photo: !item.playAddr,
      link: `https://www.tiktok.com/@${acc}/video/${id}`,
    });
  }
  return { profile, items: out };
}

function cacheGet(key) {
  const hit = profileCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  profileCache.set(key, { at: Date.now(), value });
  // Batasi cache supaya RAM panel tidak naik terus.
  if (profileCache.size > 100) {
    const oldest = profileCache.keys().next().value;
    profileCache.delete(oldest);
  }
}

/**
 * Ambil profil + daftar video lewat halaman embed (tanpa WAF).
 *
 * Beberapa host dicoba bergantian (www + m.tiktok.com) dengan retry singkat.
 * Ini penting karena dari IP panel kadang `www.tiktok.com` gagal DNS/403
 * padahal `m.tiktok.com` masih menyajikan JSON yang sama.
 *
 * @returns {{profile: object, items: object[]}}
 */
async function fetchProfileEmbed(unique, cfg = {}, request = null) {
  const acc = uniqueFromInput(unique);
  if (!acc) throw new Error('username TikTok tidak valid');

  const cached = cacheGet(`profile:${acc.toLowerCase()}`);
  if (cached) return cached;

  const doRequest = typeof request === 'function' ? request : fetchWithTimeout;
  const timeoutMs = Math.max(10000, Number(cfg && cfg.tiktokLocalTimeoutMs) || 30000);
  const hosts = embedHosts(cfg);
  const failures = [];
  let anyWaf = false;
  let notFound = false;

  for (const host of hosts) {
    const state = hostState.get(host) || { blockedUntil: 0, fails: 0 };
    // Host yang baru kena WAF dilewati, tapi kalau semua host sedang cooldown
    // tetap dicoba sekali supaya bot tidak diam total.
    const cooling = state.blockedUntil > Date.now();
    const isLast = host === hosts[hosts.length - 1];
    if (cooling && !isLast) {
      failures.push(`${hostOf(host)}: cooldown WAF`);
      continue;
    }

    const mobile = /(^|\.)m\.tiktok\.com$/i.test(hostOf(host));
    let hostError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const suffix = attempt === 1 ? '' : `?lang=en&_cb=${Date.now()}`;
      const url = `${host}/embed/@${encodeURIComponent(acc)}${suffix}`;
      try {
        const headers = requestHeaders(cfg, {
          'User-Agent': mobile ? MOBILE_UA : DESKTOP_UA,
          Referer: `${host}/`,
        });
        const res = await doRequest(url, { headers, redirect: 'follow' }, timeoutMs);
        const html = await res.text().catch(() => '');

        if (res.status === 429) {
          state.blockedUntil = Date.now() + retryAfterMs(res) + HOST_COOLDOWN_MS;
          hostState.set(host, state);
          throw wafError(`embed TikTok HTTP 429 (${hostOf(host)})`);
        }

        if (!res.ok) {
          if (isNotFoundPage(html)) {
            notFound = true;
            const err = new Error(`akun @${acc} tidak ditemukan`);
            err.notFound = true;
            throw err;
          }
          const err = new Error(`embed TikTok HTTP ${res.status} (${hostOf(host)})`);
          err.status = res.status;
          if (res.status === 403 || res.status === 429 || isChallenge(html)) err.waf = true;
          throw err;
        }

        const data = parseEmbedState(html);
        if (!data) {
          if (isChallenge(html)) throw wafError(`embed TikTok diblokir WAF (${hostOf(host)})`);
          if (isNotFoundPage(html)) {
            notFound = true;
            const err = new Error(`akun @${acc} tidak ditemukan`);
            err.notFound = true;
            throw err;
          }
          // Embed 400 untuk akun yang tidak ada/private/rename.
          const err = new Error(`profil embed @${acc} tidak bisa dibaca (${hostOf(host)})`);
          err.notFound = /not found|private/i.test(html);
          if (err.notFound) notFound = true;
          throw err;
        }

        const profile = profileFromEmbed(data, acc);
        if (!profile.uniqueId) {
          notFound = true;
          const err = new Error(`akun @${acc} tidak ditemukan`);
          err.notFound = true;
          throw err;
        }

        // Host ini sehat: simpan sebagai prioritas berikutnya.
        state.fails = 0;
        state.blockedUntil = 0;
        hostState.set(host, state);
        preferredHost = host;

        const result = videosFromEmbed(data, acc);
        // Profil valid tanpa video tetap dianggap sukses (bukan error WAF).
        cacheSet(`profile:${acc.toLowerCase()}`, result);
        return result;
      } catch (err) {
        hostError = err;
        if (err && err.waf) {
          anyWaf = true;
          state.fails += 1;
          state.blockedUntil = Date.now() + HOST_COOLDOWN_MS;
          hostState.set(host, state);
          // Coba host lain daripada mengulang host yang jelas diblokir.
          break;
        }
        if (err && err.notFound) {
          notFound = true;
          break;
        }
        // Error jaringan/timeout: beri jeda pendek lalu ulangi host yang sama.
        if (attempt < 2) await sleep(400 + Math.floor(Math.random() * 500));
      }
    }

    if (hostError) {
      failures.push(
        `${hostOf(host)}: ${hostError && hostError.message ? hostError.message : hostError}`
      );
    }
    // Akun memang tidak ada: tidak perlu mencoba host lain.
    if (notFound) break;
  }

  const err = new Error(
    failures.length
      ? `gagal membaca embed TikTok (${failures.join(' | ')})`
      : `gagal membaca embed TikTok @${acc}`
  );
  err.waf = anyWaf;
  if (notFound) {
    err.message = `akun @${acc} tidak ditemukan`;
    err.notFound = true;
  }
  throw err;
}

/**
 * Info media satu video/foto lewat embed creator. Foto post hanya memberi
 * cover pertama, jadi hasilnya ditandai `partial` supaya pemanggil bisa
 * mencoba sumber lain (mis. API/TikWM) untuk carousel lengkap.
 */
async function fetchVideoInfoEmbed(link, cfg = {}, request = null) {
  const acc = uniqueFromInput(link);
  const id = videoIdFromInput(link);
  if (!acc || !id) return null;

  const { items } = await fetchProfileEmbed(acc, cfg, request);
  const item = items.find((v) => v.video_id === id);
  if (!item) return null;

  const media = {
    video: item.play_addr || '',
    audio: '',
    images: [],
    partial: false,
  };

  if (!media.video) {
    // Foto/carousel: embed hanya menyediakan cover slide pertama.
    if (item.cover) media.images.push(item.cover);
    media.partial = media.images.length > 0;
  }

  return media;
}

/** Diagnostik untuk panel/log: cek apakah embed masih bisa dibaca. */
async function probeLocal(unique, cfg = {}, request = null) {
  const started = Date.now();
  try {
    const result = await fetchProfileEmbed(unique || 'kang_zenith', cfg, request);
    return {
      ok: true,
      ms: Date.now() - started,
      videos: result.items.length,
      nickname: result.profile.nickname,
    };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: err && err.message ? err.message : String(err),
    };
  }
}

module.exports = {
  EMBED_BASE,
  DESKTOP_UA,
  parseEmbedState,
  profileFromEmbed,
  videosFromEmbed,
  fetchProfileEmbed,
  fetchVideoInfoEmbed,
  probeLocal,
  timestampFromVideoId,
  uniqueFromInput,
  videoIdFromInput,
};
