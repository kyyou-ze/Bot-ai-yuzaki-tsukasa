'use strict';

const log = require('./logger');
const { atomicWriteJson, safeReadJson } = require('./util');

const HISTORY_MAX = 5000;
const UP_TODAY_MAX_PER_DAY = 1000;
const UP_TODAY_KEEP_DAYS = 30;
const SEEN_MAX = 500;

function dayKey(ts, tzOffset) {
  const offset = Number.isFinite(Number(tzOffset)) ? Number(tzOffset) : 7;
  const d = new Date((Number(ts) || Date.now()) + offset * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function normalizeAccount(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '');
}

function normalizeCn(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * Normalisasi teks untuk pencocokan CN. Nickname TikTok sering memakai huruf
 * Unicode bergaya (mis. "𝙀𝘾𝙉") plus hiasan seperti "〆" atau "ft". NFKC
 * mengubah huruf bergaya itu jadi ASCII, lalu semua non-alfanumerik dibuang
 * agar "𝙀𝘾𝙉", "〆ECN", dan "ft ECN" sama-sama cocok dengan "ECN".
 */
function normalizeCnText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function normalizeHashtag(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return v.startsWith('#') ? v : '#' + v;
}

function formatClock(ts, timezone) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone || 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toTimeString().slice(0, 5);
  }
}

function formatDate(ts, timezone) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone || 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function validEntry(e) {
  return Boolean(e && e.gcId && e.accName);
}

function bareJid(value) {
  return String(value || '')
    .replace(/:\d+@/, '@')
    .trim();
}

/**
 * Ambil digit nomor telepon dari JID. JID @lid bukan nomor telepon, jadi
 * jangan dipakai untuk pencocokan supaya tidak salah orang.
 */
function phoneDigits(value) {
  const jid = bareJid(value);
  if (!jid || /@lid$/i.test(jid)) return '';
  const digits = jid.split('@')[0].replace(/\D+/g, '');
  return digits.length >= 8 ? digits : '';
}

/**
 * Penyimpanan JSON untuk verif ACC, riwayat UP, hitungan harian, dan cache
 * video yang sudah pernah dilihat detector.
 */
class VerifStore {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.timezone = String(this.cfg.timezone || 'Asia/Jakarta');
    this.tzOffset = Number.isFinite(Number(this.cfg.tzOffset)) ? Number(this.cfg.tzOffset) : 7;

    this.file = this.cfg.verifDb;
    this.historyFile = this.cfg.historyUpDb;
    this.upTodayFile = this.cfg.upTodayDb;
    this.seenFile = this.cfg.seenVideosDb;

    const rawVerif = safeReadJson(this.file, []);
    const entries = Array.isArray(rawVerif)
      ? rawVerif
      : rawVerif && Array.isArray(rawVerif.entries)
        ? rawVerif.entries
        : [];
    this.entries = entries.filter(validEntry).map((e) => this._cleanEntry(e));

    const rawHistory = safeReadJson(this.historyFile, []);
    this.history = (Array.isArray(rawHistory) ? rawHistory : []).filter(
      (v) => v && v.id && v.username
    );

    const rawToday = safeReadJson(this.upTodayFile, {});
    const days =
      rawToday && rawToday.days && typeof rawToday.days === 'object'
        ? rawToday.days
        : rawToday && typeof rawToday === 'object' && !Array.isArray(rawToday)
          ? rawToday
          : {};
    this.upToday = {};
    for (const [day, list] of Object.entries(days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(list)) {
        this.upToday[day] = list.filter((v) => v && v.id && v.username);
      }
    }

    const rawSeen = safeReadJson(this.seenFile, {});
    this.seen =
      rawSeen && rawSeen.accounts && typeof rawSeen.accounts === 'object'
        ? rawSeen.accounts
        : rawSeen && typeof rawSeen === 'object' && !Array.isArray(rawSeen)
          ? rawSeen
          : {};

    this._writing = Promise.resolve();
  }

  _cleanEntry(e) {
    return {
      gcId: String(e.gcId || '').trim(),
      accName: normalizeAccount(e.accName),
      cnKeyword: normalizeCn(e.cnKeyword),
      hashtag: normalizeHashtag(e.hashtag),
      gcName: String(e.gcName || '').trim(),
      // Penautan akun TikTok ke nomor WhatsApp peng-verif. `userJid` dipakai
      // untuk mention/tag saat detector menemukan video baru, `userName`
      // disimpan sebagai fallback tampilan.
      userJid: bareJid(e.userJid),
      userPn: bareJid(e.userPn),
      userName: String(e.userName || '').trim().slice(0, 80),
      createdAt: Number(e.createdAt) || Date.now(),
    };
  }

  _queue(file, data) {
    this._writing = this._writing
      .then(() => atomicWriteJson(file, data))
      .catch((err) => log.error('[VERIF] gagal menyimpan:', err.message));
    return this._writing;
  }

  saveVerif() {
    return this._queue(this.file, this.entries);
  }

  saveHistory() {
    return this._queue(this.historyFile, this.history);
  }

  saveUpToday() {
    return this._queue(this.upTodayFile, { days: this.upToday });
  }

  saveSeen() {
    return this._queue(this.seenFile, { accounts: this.seen });
  }

  // ---------- Verif per grup ----------

  list(group) {
    const gc = String(group || '').trim();
    return this.entries
      .filter((e) => e.gcId === gc)
      .sort((a, b) => a.accName.localeCompare(b.accName))
      .map((e) => ({ ...e }));
  }

  find(group, accName) {
    const gc = String(group || '').trim();
    const acc = normalizeAccount(accName).toLowerCase();
    return this.entries.find(
      (e) => e.gcId === gc && normalizeAccount(e.accName).toLowerCase() === acc
    );
  }

  async add(entry) {
    const clean = this._cleanEntry(entry);
    if (!clean.gcId || !clean.accName) throw new Error('data verif tidak lengkap');
    const existing = this.find(clean.gcId, clean.accName);
    if (existing) {
      // Akun lama mungkin belum tertaut ke nomor WhatsApp. Saat user verif
      // ulang, lengkapi penautannya tanpa membuat duplikat.
      let changed = false;
      for (const key of ['userJid', 'userPn', 'userName']) {
        if (clean[key] && existing[key] !== clean[key]) {
          existing[key] = clean[key];
          changed = true;
        }
      }
      if (changed) await this.saveVerif();
      return { added: false, updated: changed, entry: { ...existing } };
    }
    this.entries.push(clean);
    await this.saveVerif();
    return { added: true, entry: { ...clean } };
  }

  async remove(group, accName) {
    const gc = String(group || '').trim();
    const acc = normalizeAccount(accName).toLowerCase();
    const before = this.entries.length;
    this.entries = this.entries.filter(
      (e) => !(e.gcId === gc && normalizeAccount(e.accName).toLowerCase() === acc)
    );
    if (this.entries.length === before) return false;
    await this.saveVerif();
    return true;
  }

  /**
   * Grup yang perlu menerima notifikasi untuk sebuah video. Cocokkan username
   * dengan accName, atau CN video dengan cnKeyword yang diverifikasi di grup.
   *
   * Hasilnya menyertakan JID peng-verif per grup supaya detector bisa
   * men-tag orang yang UP ("UP oleh: @nomor").
   */
  notifyTargets(video) {
    const username = normalizeAccount(video && video.username).toLowerCase();
    const cn = normalizeCn(video && video.cn);
    const targets = new Map();

    for (const e of this.entries) {
      const acc = normalizeAccount(e.accName).toLowerCase();
      const ecn = normalizeCn(e.cnKeyword);
      const byAccount = Boolean(username && acc === username);
      const byCn = Boolean(cn && ecn && ecn === cn);
      if (!byAccount && !byCn) continue;

      const gcId = String(e.gcId || '').trim();
      if (!gcId) continue;
      let target = targets.get(gcId);
      if (!target) {
        target = { gcId, users: new Map() };
        targets.set(gcId, target);
      }
      // Untuk mention, nomor telepon lebih andal daripada JID @lid.
      const jid = bareJid(e.userPn || e.userJid);
      if (jid) target.users.set(jid, String(e.userName || '').trim());
    }

    return [...targets.values()].map((target) => ({
      gcId: target.gcId,
      users: [...target.users.entries()].map(([jid, name]) => ({ jid, name })),
    }));
  }

  /** Semua entri verif yang tertaut ke salah satu JID WhatsApp user. */
  entriesForUser(jids, group) {
    const list = Array.isArray(jids) ? jids : [jids];
    const wanted = new Set();
    const wantedDigits = new Set();
    for (const value of list) {
      const jid = bareJid(value);
      if (!jid) continue;
      wanted.add(jid.toLowerCase());
      const digits = phoneDigits(jid);
      if (digits) wantedDigits.add(digits);
    }
    if (!wanted.size && !wantedDigits.size) return [];

    const gc = String(group || '').trim();
    return this.entries
      .filter((e) => {
        if (gc && e.gcId !== gc) return false;
        // Cocokkan ke dua bentuk identitas: nomor telepon (userPn) dan JID
        // asli (userJid). JID @lid tidak punya digit nomor, jadi jangan
        // sampai salah satu bentuk gagal dicocokkan.
        const linked = [e.userPn, e.userJid].map(bareJid).filter(Boolean);
        for (const value of linked) {
          if (wanted.has(value.toLowerCase())) return true;
          const digits = phoneDigits(value);
          if (digits && wantedDigits.has(digits)) return true;
        }
        return false;
      })
      .sort((a, b) => a.accName.localeCompare(b.accName))
      .map((e) => ({ ...e }));
  }

  /** Cari entri berdasarkan username TikTok tanpa terikat grup. */
  entriesByAccount(accName) {
    const acc = normalizeAccount(accName).toLowerCase();
    if (!acc) return [];
    return this.entries
      .filter((e) => normalizeAccount(e.accName).toLowerCase() === acc)
      .map((e) => ({ ...e }));
  }

  // ---------- Cache video terlihat ----------

  getSeenState(account) {
    const key = String(account || '').trim().toLowerCase();
    const raw = this.seen[key];
    if (!raw) return { ids: new Set(), initialized: false };
    if (Array.isArray(raw)) return { ids: new Set(raw.map(String)), initialized: true };
    const ids = Array.isArray(raw.ids) ? raw.ids.map(String) : [];
    return { ids: new Set(ids), initialized: Boolean(raw.initialized) };
  }

  async markSeen(account, ids, initialized) {
    const key = String(account || '').trim().toLowerCase();
    if (!key) return;
    const prev = this.getSeenState(account);
    for (const id of ids || []) {
      if (id) prev.ids.add(String(id));
    }
    let list = [...prev.ids];
    if (list.length > SEEN_MAX) list = list.slice(list.length - SEEN_MAX);
    this.seen[key] = {
      ids: list,
      initialized: initialized === undefined ? prev.initialized : Boolean(initialized),
      lastCheck: Date.now(),
    };
    await this.saveSeen();
  }

  // ---------- Riwayat UP ----------

  async recordVideo(video) {
    const ts = Number(video && video.timestamp) || Date.now();
    const item = {
      id: String(video.id || '').trim(),
      username: String(video.username || '').trim(),
      nickname: String(video.nickname || '').trim(),
      cn: normalizeCn(video.cn),
      caption: String(video.caption || ''),
      hashtagStatus: String(video.hashtagStatus || 'Tidak Ada'),
      cnStatus: String(video.cnStatus || 'Tidak Cocok'),
      link: String(video.link || '').trim(),
      timestamp: ts,
    };
    if (!item.id || !item.username) return false;

    if (!this.history.some((v) => v.id === item.id && v.username === item.username)) {
      this.history.push(item);
      if (this.history.length > HISTORY_MAX) {
        this.history.splice(0, this.history.length - HISTORY_MAX);
      }
    }

    const day = dayKey(ts, this.tzOffset);
    const list = Array.isArray(this.upToday[day]) ? this.upToday[day] : [];
    if (!list.some((v) => v.id === item.id && v.username === item.username)) {
      list.push(item);
      if (list.length > UP_TODAY_MAX_PER_DAY) {
        list.splice(0, list.length - UP_TODAY_MAX_PER_DAY);
      }
      this.upToday[day] = list;
    }

    // Buang hari yang terlalu lama agar file tidak membengkak.
    const cutoff = new Date(Date.now() - UP_TODAY_KEEP_DAYS * 24 * 60 * 60 * 1000);
    const minDay = dayKey(cutoff.getTime(), this.tzOffset);
    for (const d of Object.keys(this.upToday)) {
      if (d < minDay) delete this.upToday[d];
    }

    await this.saveHistory();
    await this.saveUpToday();
    return true;
  }

  videosForDay(day, cn) {
    const list = Array.isArray(this.upToday[day]) ? this.upToday[day].slice() : [];
    const target = normalizeCn(cn);
    return list
      .filter((v) => {
        if (!target) return true;
        return normalizeCn(v.cn) === target && String(v.cnStatus).toLowerCase() === 'cocok';
      })
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  }

  todayVideos(cn) {
    return this.videosForDay(dayKey(Date.now(), this.tzOffset), cn);
  }

  /**
   * Ambil video terbaru per akun untuk hari ini (atau N hari terakhir).
   */
  latestPerAccount(days, cn) {
    const limit = Math.max(1, Number(days) || 1);
    const target = normalizeCn(cn);
    const now = Date.now();
    const map = new Map();
    for (let i = 0; i < limit; i++) {
      const day = dayKey(now - i * 24 * 60 * 60 * 1000, this.tzOffset);
      for (const v of this.videosForDay(day, target)) {
        const key = normalizeAccount(v.username).toLowerCase();
        const cur = map.get(key);
        if (!cur || Number(v.timestamp) > Number(cur.timestamp)) map.set(key, v);
      }
    }
    return [...map.values()].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  }

  historySummary(days, cn) {
    const limit = Math.max(1, Number(days) || 7);
    const target = normalizeCn(cn);
    const since = dayKey(Date.now() - (limit - 1) * 24 * 60 * 60 * 1000, this.tzOffset);
    const map = new Map();

    for (const [day, list] of Object.entries(this.upToday)) {
      if (day < since) continue;
      for (const v of list) {
        if (!v || !v.username) continue;
        if (target && normalizeCn(v.cn) !== target) continue;
        const key = normalizeAccount(v.username).toLowerCase();
        const cur =
          map.get(key) || {
            username: v.username,
            nickname: v.nickname,
            cn: v.cn,
            days: new Set(),
            total: 0,
            lastAt: 0,
          };
        cur.days.add(day);
        cur.total += 1;
        cur.lastAt = Math.max(cur.lastAt, Number(v.timestamp) || 0);
        if (v.nickname) cur.nickname = v.nickname;
        if (v.cn) cur.cn = v.cn;
        map.set(key, cur);
      }
    }

    return [...map.values()]
      .map((x) => ({
        username: x.username,
        nickname: x.nickname,
        cn: x.cn,
        activeDays: x.days.size,
        total: x.total,
        lastAt: x.lastAt,
      }))
      .sort((a, b) => b.activeDays - a.activeDays || b.total - a.total || b.lastAt - a.lastAt);
  }
}

module.exports = {
  VerifStore,
  dayKey,
  normalizeAccount,
  normalizeCn,
  normalizeCnText,
  normalizeHashtag,
  formatClock,
  formatDate,
};
