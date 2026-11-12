'use strict';

const log = require('./logger');
const wa = require('./wa');
const { sleep, downloadBytes, isGroupJid, jidUser } = require('./util');
const { shortError } = require('./logfmt');
const {
  desktopHeaders,
  tiktokFetch,
  readViaJina,
  isWafError,
  hasConfiguredPostsApi,
  fetchUserPostsApi,
} = require('./tiktokapi');
const {
  dayKey,
  normalizeAccount,
  normalizeCn,
  normalizeCnText,
  normalizeHashtag,
  formatClock,
} = require('./verifstore');
const { fetchProfileEmbed } = require('./tiktoklocal');

const START_DELAY_MS = 15000;
const ACCOUNT_DELAY_MIN_MS = 2000;
const ACCOUNT_DELAY_MAX_MS = 5000;
const CAPTION_MAX = 180;
// Error yang sama tidak perlu ditulis tiap 3 menit; cukup sekali per 10 menit.
const ERROR_LOG_EVERY_MS = 10 * 60 * 1000;

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

async function fetchUserVideos(account, cfg = {}) {
  const unique = normalizeAccount(account);
  if (!unique) return [];

  const errors = [];
  let waf = false;

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
  const tryHtml = () => fetchProfileHtml(unique, cfg);

  // Mode "auto" (default): lokal dulu, lalu cadangan yang dikonfigurasi.
  // Mode "local": wajib lokal. Mode "api": langsung API/Jina seperti dulu.
  const mode = String(cfg.tiktokScraperMode || 'auto').toLowerCase();
  const steps = [];
  if (mode !== 'api') steps.push(['Local', tryLocal]);
  if (hasConfiguredPostsApi(cfg)) steps.push(['API', tryApi]);
  if (mode !== 'local') steps.push(['Jina', tryJina]);
  // Mode local tetap boleh memakai Jina saat embed benar-benar diblokir WAF,
  // supaya detector tidak mati total hanya karena IP panel sedang diblokir.
  else steps.push(['Jina (cadangan WAF)', tryJina, 'onWaf']);
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
      errors.push(`${name}: ${err && err.message ? err.message : err}`);
    }
  }

  const finalError = new Error(errors.join(' | ') || 'gagal mengambil video TikTok');
  finalError.waf = waf;
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

class TikTokMonitor {
  constructor(cfg, store, isReady, accountsStore) {
    this.cfg = cfg || {};
    this.store = store;
    this.accountsStore = accountsStore || null;
    this.ready = typeof isReady === 'function' ? isReady : () => Boolean(isReady);
    this.intervalMs = Math.max(1, Number(this.cfg.tiktokCheckMin) || 3) * 60 * 1000;
    this.timer = null;
    this.startTimer = null;
    this.ticking = false;
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
    this.lastCheckAt = 0;
    this.lastOkAt = 0;
    this.lastError = '';
  }

  health() {
    return {
      enabled: this.isEnabled(),
      scraper: this.cfg.tiktokScraperMode || 'auto',
      localEnabled: this.cfg.tiktokLocalEnabled !== false,
      lastCheckAt: this.lastCheckAt,
      lastOkAt: this.lastOkAt,
      lastError: this.lastError,
      cooldownUntil: this.wafUntil,
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

  clearWafCooldown() {
    this.wafUntil = 0;
    this.wafLogged = false;
  }

  logCheckError(account, err) {
    const now = Date.now();
    this.lastError = shortError(err);
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
        this.intervalMs / 60000
      )} menit | scraper ${this.cfg.tiktokScraperMode || 'auto'}` +
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
    if (Date.now() < this.wafUntil) return;
    if (this.wafUntil) {
      // Cooldown selesai: coba lagi dan izinkan satu log baru kalau masih WAF.
      this.wafUntil = 0;
      this.wafLogged = false;
    }
    this.ticking = true;
    this.lastCheckAt = Date.now();
    try {
      const accounts = this.getAccounts();
      for (let i = 0; i < accounts.length; i += 1) {
        // Cek satu per satu; beri jeda acak 2-5 detik agar tidak menyerbu WAF.
        if (i > 0) {
          await sleep(
            ACCOUNT_DELAY_MIN_MS +
              Math.floor(Math.random() * (ACCOUNT_DELAY_MAX_MS - ACCOUNT_DELAY_MIN_MS + 1))
          );
        }
        if (Date.now() < this.wafUntil) break;

        const account = accounts[i];
        try {
          await this.checkAccount(account);
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
          this.logCheckError(account, err);
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  async checkAccount(account) {
    const videos = await fetchUserVideos(account, this.cfg);
    this.missingAccounts.delete(account);
    this.errorLogAt.delete(account);
    this.clearWafCooldown();
    this.lastOkAt = Date.now();
    this.lastError = '';
    if (!videos.length) return;

    const state = this.store.getSeenState(account);
    const currentIds = videos.map((v) => v.id);

    // Pertama kali berjalan: jangan kirim notifikasi untuk video lama, tapi
    // simpan video hari ini supaya /siapaup langsung ada isinya.
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
      await this.notify(data);
      log.info(
        `[TIKTOK] UP ${data.username} (${data.nickname || '-'}) | ${formatClock(
          data.timestamp,
          this.cfg.timezone
        )} | ${data.hashtagStatus === 'Ada' ? 'hashtag ok' : 'hashtag -'} | ${
          data.cnStatus === 'Cocok' ? 'CN ok' : 'CN -'
        }`
      );
    }

    await this.store.markSeen(account, currentIds, true);
  }

  async notify(video) {
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

    const baseText = formatDetectorMessage(video, this.cfg);
    for (const [jid, userMap] of targets) {
      const mentions = [...userMap.keys()].filter((u) => !/@lid$/i.test(u));
      const mentionLine = mentions.length
        ? `\n🙋 UP oleh: ${mentions.map((u) => `@${jidUser(u)}`).join(', ')}`
        : '';
      const text = baseText + mentionLine;
      try {
        // Kirim cover sebagai preview supaya notifikasi terlihat seperti post
        // TikTok, bukan cuma teks. Kalau cover gagal diunduh, fallback teks.
        let sent = false;
        if (video.cover) {
          try {
            const got = await downloadBytes(video.cover, 8 * 1024 * 1024, 20000);
            if (/^image\//i.test(got.mime || '')) {
              await wa.sendImage(jid, got.data, text, null, got.mime, mentions);
              sent = true;
            }
          } catch (err) {
            log.debug(`[TIKTOK] cover ${video.id} gagal: ${shortError(err)}`);
          }
        }
        if (!sent) await wa.sendText(jid, text, null, mentions);
      } catch (err) {
        log.error(`[TIKTOK] notif ke ${jid} gagal: ${shortError(err)}`);
      }
    }
  }
}

module.exports = {
  TikTokMonitor,
  fetchUserVideos,
  buildVideoData,
  formatDetectorMessage,
  captionHasHashtag,
  nicknameMatchesCn,
};
