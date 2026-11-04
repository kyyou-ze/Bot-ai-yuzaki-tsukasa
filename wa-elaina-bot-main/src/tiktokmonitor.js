'use strict';

const wa = require('./wa');
const { sleep } = require('./util');
const {
  desktopHeaders,
  tiktokFetch,
  isWafError,
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

const START_DELAY_MS = 15000;
const ACCOUNT_DELAY_MIN_MS = 2000;
const ACCOUNT_DELAY_MAX_MS = 5000;
const CAPTION_MAX = 180;

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
  const createTime = normalizeCreateTime(
    v.create_time || v.createTime || v.create_time_ms || v.createTimeMs || v.ctime || v.timestamp || 0
  );

  return {
    id,
    username: '@' + uniqueId,
    nickname,
    caption,
    createTime,
    link: `https://www.tiktok.com/@${uniqueId}/video/${id}`,
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

async function fetchUserVideos(account, cfg = {}) {
  const unique = normalizeAccount(account);
  if (!unique) return [];

  const errors = [];
  let waf = false;

  // 1) Rantai API: custom -> TikHub -> tiktok-api23 -> Ensig -> TikWM.
  //    Provider yang tidak dikonfigurasi otomatis dilewati.
  try {
    const { items } = await fetchUserPostsApi(unique, cfg);
    return normalizeList(items, unique);
  } catch (err) {
    waf = Boolean(err.waf);
    errors.push(err.message);
  }

  // 2) Scraping halaman profil TikTok sebagai upaya terakhir.
  try {
    return await fetchProfileHtml(unique, cfg);
  } catch (err) {
    if (isWafError(err)) waf = true;
    errors.push(err.message);
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
    timestamp: video.createTime ? video.createTime * 1000 : Date.now(),
  };
}

function formatDetectorMessage(video, cfg) {
  const cn = normalizeCn((cfg && cfg.tiktokCnKeyword) || 'ECN');
  const hashtag = normalizeHashtag((cfg && cfg.tiktokHashtag) || '#margaecn');
  const nick = video.nickname ? ` (${video.nickname})` : '';
  return [
    '🎬 *Tsukasa Detector*',
    `👤 UP: ${video.username}${nick}`,
    `ACC: ${video.cn || cn}`,
    `📌 ${hashtag} - ${video.hashtagStatus} ${video.hashtagStatus === 'Ada' ? '✅' : '❌'}`,
    `📌 CN ${cn} - ${video.cnStatus} ${video.cnStatus === 'Cocok' ? '✅' : '❌'}`,
    `📝 Caption: ${truncate(video.caption, CAPTION_MAX) || '-'}`,
    `🔗 ${video.link}`,
  ].join('\n');
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
    // Cooldown WAF global: kalau semua sumber 403, berhenti sebentar supaya
    // tidak makin dicurigai. Log hanya sekali per cooldown.
    this.wafUntil = 0;
    this.wafLogged = false;
    this.wafCooldownMs =
      Math.max(1, Number(this.cfg.tiktokWafCooldownMin) || 10) * 60 * 1000;
  }

  enterWafCooldown() {
    this.wafUntil = Date.now() + this.wafCooldownMs;
    if (!this.wafLogged) {
      const minutes = Math.max(1, Math.round(this.wafCooldownMs / 60000));
      console.warn(`[TIKTOK] WAF block, retry ${minutes} menit`);
      this.wafLogged = true;
    }
  }

  clearWafCooldown() {
    this.wafUntil = 0;
    this.wafLogged = false;
  }

  /** Daftar akun aktif: dari database/accounts.json bila sudah diubah. */
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
      console.log('[TIKTOK] Detector dimatikan.');
      return;
    }

    const accounts = this.getAccounts();
    if (!accounts.length) {
      this.stop();
      console.warn('[TIKTOK] Daftar akun kosong, detector berhenti sampai ada /addakun.');
      return;
    }

    if (this.timer) {
      console.log(`[TIKTOK] Daftar akun diperbarui: ${accounts.join(', ')}`);
      return;
    }

    this.start();
  }

  start() {
    if (!this.isEnabled()) return;
    const accounts = this.getAccounts();
    if (!accounts.length) {
      console.warn('[TIKTOK] Daftar akun kosong, detector tidak berjalan. Tambah via /addakun.');
      return;
    }
    if (this.timer) return;

    console.log(
      `[TIKTOK] Detector aktif: ${accounts.join(', ')} | cek tiap ${Math.round(
        this.intervalMs / 60000
      )} menit`
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
          console.error(`[TIKTOK] ${account} gagal dicek:`, err.message);
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  async checkAccount(account) {
    const videos = await fetchUserVideos(account, this.cfg);
    this.clearWafCooldown();
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
      console.log(`[TIKTOK] ${account}: baseline ${videos.length} video disimpan.`);
      return;
    }

    const fresh = videos
      .filter((v) => !state.ids.has(v.id))
      .sort((a, b) => a.createTime - b.createTime);

    for (const video of fresh) {
      const data = buildVideoData(video, this.cfg);
      await this.store.recordVideo(data);
      await this.notify(data);
      console.log(
        `[TIKTOK] UP ${data.username} (${data.nickname || '-'}) @ ${formatClock(
          data.timestamp,
          this.cfg.timezone
        )}`
      );
    }

    await this.store.markSeen(account, currentIds, true);
  }

  async notify(video) {
    const targets = new Set(this.store.notifyTargets(video));
    if (this.cfg.tiktokNotifyJid) targets.add(String(this.cfg.tiktokNotifyJid).trim());
    if (!targets.size) {
      console.log(`[TIKTOK] ${video.username} UP, tapi belum ada grup terverif untuk ACC ini.`);
      return;
    }

    const text = formatDetectorMessage(video, this.cfg);
    for (const jid of targets) {
      if (!jid) continue;
      try {
        await wa.sendText(jid, text);
      } catch (err) {
        console.error(`[TIKTOK] gagal kirim notif ke ${jid}:`, err.message);
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
