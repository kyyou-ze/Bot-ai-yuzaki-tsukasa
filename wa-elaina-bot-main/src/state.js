'use strict';

const { atomicWriteJson, safeReadJson } = require('./util');

const WARN_LIMIT = 5;
// Mode dewasa otomatis berakhir setelah 30 menit tanpa pemicu baru.
const ADULT_TTL_MS = 30 * 60 * 1000;

function normalizePersona(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'tsukasa2' || v === '2' ? 'tsukasa2' : 'tsukasa1';
}

/**
 * State store (pengganti SQLite `STATE_DB` di versi Go).
 * Datanya kecil, jadi cukup JSON satu file + write atomic.
 */
class Store {
  constructor(file) {
    this.file = file;
    const raw = safeReadJson(file, null) || {};
    this.data = {
      chatState: raw.chatState || {},
      peraturan: raw.peraturan || {},
      warns: raw.warns || {},
      animeChannel: raw.animeChannel || {},
      reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    };
    this._writing = Promise.resolve();
  }

  _save() {
    const snapshot = this.data;
    this._writing = this._writing
      .then(() => atomicWriteJson(this.file, snapshot))
      .catch((err) => console.error('[STORE] gagal menyimpan state:', err.message));
    return this._writing;
  }

  get(jid) {
    const st = this.data.chatState[jid];
    const adultUntil = Number(st && st.adultUntil) || 0;
    return {
      persona: normalizePersona(st && st.persona),
      pro: Boolean(st && st.pro),
      adult: adultUntil > Date.now(),
      adultUntil,
      updated: (st && st.updated) || 0,
    };
  }

  setPersona(jid, persona) {
    const normalized = normalizePersona(persona);
    if (normalized !== 'tsukasa1' && normalized !== 'tsukasa2') {
      return Promise.reject(new Error('invalid persona'));
    }
    const cur = this.data.chatState[jid] || { pro: false };
    this.data.chatState[jid] = {
      persona: normalized,
      pro: Boolean(cur.pro),
      adultUntil: Number(cur.adultUntil) || 0,
      updated: Date.now(),
    };
    return this._save();
  }

  setPro(jid, pro) {
    const cur = this.data.chatState[jid] || { persona: 'tsukasa1' };
    this.data.chatState[jid] = {
      persona: normalizePersona(cur.persona),
      pro: Boolean(pro),
      adultUntil: Number(cur.adultUntil) || 0,
      updated: Date.now(),
    };
    return this._save();
  }

  // Mode dewasa khusus owner. Disimpan per chat dengan masa berlaku agar
  // otomatis kembali normal setelah 30 menit tanpa pemicu baru.
  setAdult(jid, adult) {
    const cur = this.data.chatState[jid] || { persona: 'tsukasa1' };
    this.data.chatState[jid] = {
      persona: normalizePersona(cur.persona),
      pro: Boolean(cur.pro),
      adultUntil: adult ? Date.now() + ADULT_TTL_MS : 0,
      updated: Date.now(),
    };
    return this._save();
  }

  getPeraturanState(group) {
    const p = this.data.peraturan[group];
    return {
      enabled: Boolean(p && p.enabled),
      rules: (p && p.rules) || '',
      updated: (p && p.updated) || 0,
    };
  }

  setPeraturanState(group, enabled, rules) {
    this.data.peraturan[group] = {
      enabled: Boolean(enabled),
      rules: String(rules || ''),
      updated: Date.now(),
    };
    return this._save();
  }

  _warnKey(group, user) {
    return `${group}|${user}`;
  }

  getWarn(group, user) {
    const key = this._warnKey(group, user);
    const w = this.data.warns[key];
    return {
      group,
      user,
      count: (w && w.count) || 0,
      lastReason: (w && w.lastReason) || '',
      updated: (w && w.updated) || 0,
    };
  }

  addWarn(group, user, reason) {
    const key = this._warnKey(group, user);
    const w = this.data.warns[key] || { count: 0 };
    const rec = {
      group,
      user,
      count: w.count + 1,
      lastReason: String(reason || ''),
      updated: Date.now(),
    };
    this.data.warns[key] = rec;
    this._save();
    return Promise.resolve(rec);
  }

  decrementWarn(group, user) {
    const key = this._warnKey(group, user);
    const w = this.data.warns[key];
    if (!w) {
      return Promise.resolve({ group, user, count: 0, lastReason: '', updated: Date.now() });
    }
    const count = w.count <= 1 ? 0 : w.count - 1;
    if (count <= 0) {
      delete this.data.warns[key];
      this._save();
      return Promise.resolve({ group, user, count: 0, lastReason: '', updated: Date.now() });
    }
    const rec = {
      group,
      user,
      count,
      lastReason: w.lastReason || '',
      updated: Date.now(),
    };
    this.data.warns[key] = rec;
    this._save();
    return Promise.resolve(rec);
  }

  clearWarns(group, user) {
    delete this.data.warns[this._warnKey(group, user)];
    return this._save();
  }

  listWarns(group) {
    return Object.values(this.data.warns)
      .filter((w) => w.group === group && w.count > 0)
      .sort((a, b) => b.count - a.count || b.updated - a.updated)
      .map((w) => ({ ...w }));
  }

  // ---------- Pengingat (reminder) ----------

  addReminder(rec) {
    const list = Array.isArray(this.data.reminders) ? this.data.reminders.slice() : [];
    const item = {
      id: String((rec && rec.id) || '').trim(),
      chat: String((rec && rec.chat) || '').trim(),
      by: String((rec && rec.by) || '').trim(),
      text: String((rec && rec.text) || '').trim(),
      dueAt: Number(rec && rec.dueAt) || 0,
      createdAt: Number(rec && rec.createdAt) || Date.now(),
    };
    if (!item.id || !item.chat || !item.dueAt || !item.text) {
      return Promise.reject(new Error('invalid reminder'));
    }

    list.push(item);
    // Buang pengingat yang sudah lewat lebih dari 7 hari agar state tidak
    // membengkak, lalu batasi total entri.
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.data.reminders = list
      .filter((r) => r && Number(r.dueAt) > cutoff)
      .slice(-1000);
    return this._save().then(() => item);
  }

  listReminders(chat) {
    return (this.data.reminders || [])
      .filter((r) => r && r.chat === chat)
      .sort((a, b) => Number(a.dueAt) - Number(b.dueAt))
      .map((r) => ({ ...r }));
  }

  dueReminders(now = Date.now()) {
    return (this.data.reminders || [])
      .filter((r) => r && Number(r.dueAt) > 0 && Number(r.dueAt) <= now)
      .sort((a, b) => Number(a.dueAt) - Number(b.dueAt))
      .map((r) => ({ ...r }));
  }

  removeReminderById(id) {
    const target = String(id || '').trim();
    if (!target) return Promise.resolve(false);
    const before = (this.data.reminders || []).length;
    this.data.reminders = (this.data.reminders || []).filter((r) => r && r.id !== target);
    if (this.data.reminders.length === before) return Promise.resolve(false);
    return this._save().then(() => true);
  }

  removeReminder(chat, id) {
    const target = String(id || '').trim();
    if (!target) return Promise.resolve(false);
    const before = (this.data.reminders || []).length;
    this.data.reminders = (this.data.reminders || []).filter(
      (r) => !(r && r.chat === chat && r.id === target)
    );
    if (this.data.reminders.length === before) return Promise.resolve(false);
    return this._save().then(() => true);
  }

  // ---------- Anime channel auto-post ----------

  getAnimeChannelState() {
    const st = this.data.animeChannel || {};
    return {
      posted: (st && st.posted) || {},
      lastPostAt: Number(st && st.lastPostAt) || 0,
      day: (st && st.day) || '',
      dayCount: Number(st && st.dayCount) || 0,
    };
  }

  /**
   * Cek apakah salah satu key sudah pernah diposting. Dipakai untuk dedupe
   * judul/fingerprint sebelum bot mengirim ke channel.
   */
  hasAnimeChannelPost(keys) {
    const st = this.data.animeChannel || {};
    const posted = (st && st.posted) || {};
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const k = String(key || '').trim();
      if (k && posted[k]) return { posted: true, key: k, at: Number(posted[k]) || 0 };
    }
    return { posted: false, key: '', at: 0 };
  }

  /**
   * Tandai satu post anime channel. `keys` boleh string atau array agar
   * dedupe bisa memakai id sumber sekaligus judul yang sudah dinormalisasi.
   *
   * options.maxAgeDays: 0/kosong = simpan permanen (default).
   * options.maxEntries: batas jumlah entri riwayat (default 5000).
   */
  recordAnimeChannelPost(keys, day, options = {}) {
    const st = this.data.animeChannel || {};
    const posted = { ...(st.posted || {}) };
    const now = Date.now();
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const k = String(key || '').trim();
      if (k) posted[k] = now;
    }

    // Default permanen supaya anime yang sama tidak diposting ulang.
    const maxAgeDays = Number(options.maxAgeDays) || 0;
    if (maxAgeDays > 0) {
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      for (const [key, ts] of Object.entries(posted)) {
        if (!ts || now - Number(ts) > maxAge) delete posted[key];
      }
    }
    const maxEntries = Math.max(100, Number(options.maxEntries) || 5000);
    const entries = Object.entries(posted);
    if (entries.length > maxEntries) {
      entries
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .slice(0, entries.length - maxEntries)
        .forEach(([key]) => delete posted[key]);
    }

    const today = day || new Date().toISOString().slice(0, 10);
    let dayCount = Number(st.dayCount) || 0;
    if (st.day !== today) dayCount = 0;

    this.data.animeChannel = {
      posted,
      lastPostAt: now,
      day: today,
      dayCount: dayCount + 1,
    };
    return this._save();
  }
}

module.exports = { Store, WARN_LIMIT };
