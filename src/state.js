'use strict';

const log = require('./logger');
const emotion = require('./emotion');
const { atomicWriteJson, safeReadJson } = require('./util');

const WARN_LIMIT = 5;
// Peringatan otomatis dianggap basi setelah 7 hari tanpa pelanggaran baru.
const WARN_RESET_MS = 7 * 24 * 60 * 60 * 1000;
// Mode dewasa otomatis berakhir setelah 30 menit tanpa pemicu baru.
const ADULT_TTL_MS = 30 * 60 * 1000;
// Statistik top-aktif: simpan maksimal 90 hari dan 200 anggota per grup.
const ACTIVITY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ACTIVITY_MAX_PER_CHAT = 200;
const ACTIVITY_SAVE_INTERVAL_MS = 30 * 1000;

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
      groupGuard: raw.groupGuard || {},
      groupReplyMode: raw.groupReplyMode || {},
      // Fitur yang dinonaktifkan per grup: { [chat]: { brat: false, qc: false } }.
      // Hanya fitur yang dimatikan yang disimpan, jadi default-nya selalu aktif.
      groupFeatures: raw.groupFeatures || {},
      // Suasana hati Tsukasa per chat: { [chat]: { mood, intensity, reason, updated } }.
      emotions: raw.emotions || {},
      // Waktu terakhir Tsukasa mengobrol per chat, dipakai untuk mendeteksi
      // user yang lama pergi (memicu ngambek manja).
      lastSeen: raw.lastSeen || {},
      // Statistik anggota paling aktif per grup:
      // { [chat]: { [sender]: { name, count, lastAt } } }.
      activity: raw.activity || {},
      // Pesan sambutan & perpisahan per grup:
      // { [chat]: { welcome: { enabled, text }, goodbye: { enabled, text } } }.
      // Hanya nilai yang diubah yang disimpan; sisanya ikut default env.
      greetings: raw.greetings || {},
      // Catatan waktu tidur Tsukasa: { bedtimeAt, debtMinutes, debtDate, updated }.
      sleep: raw.sleep || {},
      afk: raw.afk || {},
    };
    this._writing = Promise.resolve();
  }

  _save() {
    const snapshot = this.data;
    this._writing = this._writing
      .then(() => atomicWriteJson(this.file, snapshot))
      .catch((err) => log.error('[STORE] gagal menyimpan state:', err.message));
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

  /**
   * Perpanjang masa aktif mode dewasa saat owner masih aktif mengobrol.
   * Hanya menulis disk jika sisa waktunya sudah di bawah 25 menit.
   */
  refreshAdult(jid) {
    const st = this.data.chatState[jid];
    const until = Number(st && st.adultUntil) || 0;
    if (until <= Date.now()) return Promise.resolve(false);
    if (until - Date.now() > ADULT_TTL_MS - 5 * 60 * 1000) return Promise.resolve(true);
    st.adultUntil = Date.now() + ADULT_TTL_MS;
    st.updated = Date.now();
    return this._save().then(() => true);
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

  // ---------- Mode balasan per grup ----------
  //
  // all   : balas semua pesan
  // reply : balas hanya jika pesan yang di-reply + menyebut trigger
  // call  : balas hanya jika trigger dipanggil (default)
  static normalizeGroupMode(value) {
    const m = String(value || '').trim().toLowerCase();
    return m === 'all' || m === 'reply' || m === 'call' ? m : 'call';
  }

  getGroupMode(chat) {
    const modes = this.data.groupReplyMode || {};
    return Store.normalizeGroupMode(modes[chat]);
  }

  setGroupMode(chat, mode) {
    const m = Store.normalizeGroupMode(mode);
    this.data.groupReplyMode = {
      ...(this.data.groupReplyMode || {}),
      [chat]: m,
    };
    return this._save().then(() => m);
  }

  // ---------- Pesan sambutan & perpisahan per grup ----------

  /**
   * Konfigurasi greeting untuk satu grup. Nilai yang tidak pernah diubah
   * dibiarkan kosong supaya pemanggil bisa memakai default dari env.
   */
  getGreeting(chat) {
    const g = this.data.greetings[chat] || {};
    const pick = (kind) => {
      const row = g[kind];
      return {
        enabled: row && typeof row.enabled === 'boolean' ? row.enabled : null,
        text: row && typeof row.text === 'string' ? row.text : '',
        updated: (row && Number(row.updated)) || 0,
      };
    };
    return { welcome: pick('welcome'), goodbye: pick('goodbye') };
  }

  setGreeting(chat, kind, patch = {}) {
    const target = String(chat || '').trim();
    const type = kind === 'goodbye' ? 'goodbye' : 'welcome';
    if (!target) return Promise.reject(new Error('invalid chat for greeting'));
    const all = this.data.greetings[target] || {};
    const cur = all[type] || {};
    const next = {
      enabled:
        typeof patch.enabled === 'boolean' ? patch.enabled : Boolean(cur.enabled),
      text: typeof patch.text === 'string' ? patch.text : String(cur.text || ''),
      updated: Date.now(),
    };
    all[type] = next;
    this.data.greetings[target] = all;
    return this._save().then(() => next);
  }

  resetGreeting(chat, kind) {
    const target = String(chat || '').trim();
    const type = kind === 'goodbye' ? 'goodbye' : 'welcome';
    const all = this.data.greetings[target];
    if (!target || !all || !all[type]) return Promise.resolve(false);
    delete all[type];
    if (!Object.keys(all).length) delete this.data.greetings[target];
    else this.data.greetings[target] = all;
    return this._save().then(() => true);
  }

  // ---------- Fitur per grup ----------
  //
  // Fitur default aktif. Admin grup bisa mematikan mis. `brat` dan `qc`;
  // perintahnya otomatis ditolak dan barisnya hilang dari menu di grup itu.

  getGroupFeatures(chat) {
    const g = this.data.groupFeatures[chat];
    return g && typeof g === 'object' ? { ...g } : {};
  }

  listDisabledFeatures(chat) {
    return Object.keys(this.getGroupFeatures(chat)).filter(
      (key) => !key.startsWith('cmd:') && this.data.groupFeatures[chat][key] === false
    );
  }

  isFeatureEnabled(chat, key) {
    const g = this.data.groupFeatures[chat];
    if (!g || typeof g !== 'object') return true;
    return g[key] !== false;
  }

  /** Override per perintah, terpisah dari override per fitur/kelompok. */
  isCommandEnabled(chat, command) {
    const name = String(command || '')
      .trim()
      .toLowerCase()
      .replace(/^[#./!]+/, '');
    if (!name) return true;
    const g = this.data.groupFeatures[chat];
    if (!g || typeof g !== 'object') return true;
    return g[`cmd:${name}`] !== false;
  }

  listDisabledCommands(chat) {
    const g = this.getGroupFeatures(chat);
    return Object.keys(g)
      .filter((key) => key.startsWith('cmd:') && g[key] === false)
      .map((key) => key.slice(4))
      .sort();
  }

  setCommandEnabled(chat, command, enabled) {
    const target = String(chat || '').trim();
    const name = String(command || '')
      .trim()
      .toLowerCase()
      .replace(/^[#./!]+/, '');
    if (!target || !name) return Promise.reject(new Error('invalid group command'));
    const cur = this.getGroupFeatures(target);
    const key = `cmd:${name}`;
    if (enabled) delete cur[key];
    else cur[key] = false;
    if (Object.keys(cur).length) this.data.groupFeatures[target] = cur;
    else delete this.data.groupFeatures[target];
    return this._save().then(() => Boolean(enabled));
  }

  setFeatureEnabled(chat, key, enabled) {
    const target = String(chat || '').trim();
    const name = String(key || '').trim().toLowerCase();
    if (!target || !name) return Promise.reject(new Error('invalid group feature'));
    const cur = this.getGroupFeatures(target);
    if (enabled) delete cur[name];
    else cur[name] = false;
    if (Object.keys(cur).length) this.data.groupFeatures[target] = cur;
    else delete this.data.groupFeatures[target];
    return this._save().then(() => Boolean(enabled));
  }

  clearGroupFeatures(chat) {
    const target = String(chat || '').trim();
    if (!target || !this.data.groupFeatures[target]) return Promise.resolve(false);
    delete this.data.groupFeatures[target];
    return this._save().then(() => true);
  }

  // ---------- Suasana hati (emosi) ----------

  getEmotion(chat) {
    return emotion.normalizeState(this.data.emotions[chat]);
  }

  setEmotion(chat, mood, intensity, reason) {
    const target = String(chat || '').trim();
    if (!target) return Promise.reject(new Error('invalid chat for emotion'));
    const key = emotion.normalizeMood(mood);
    if (key === 'netral') {
      delete this.data.emotions[target];
    } else {
      this.data.emotions[target] = {
        mood: key,
        intensity: Math.max(0, Math.min(1, Number(intensity) || 0.5)),
        reason: String(reason || '').slice(0, 120),
        updated: Date.now(),
      };
    }
    return this._save().then(() => this.getEmotion(target));
  }

  clearEmotion(chat) {
    const target = String(chat || '').trim();
    if (!target || !this.data.emotions[target]) return Promise.resolve(false);
    delete this.data.emotions[target];
    return this._save().then(() => true);
  }

  /**
   * Catat waktu terakhir chat dan kembalikan waktu sebelumnya. Penulisan disk
   * dibatasi sekali per menit supaya tidak menambah beban di setiap pesan.
   */
  touchSeen(chat, now = Date.now()) {
    const target = String(chat || '').trim();
    if (!target) return 0;
    const at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const prev = Number(this.data.lastSeen[target]) || 0;
    this.data.lastSeen[target] = at;
    if (!this._lastSeenSaveAt || at - this._lastSeenSaveAt >= 60 * 1000) {
      this._lastSeenSaveAt = at;
      const cutoff = at - 7 * 24 * 60 * 60 * 1000;
      for (const [key, value] of Object.entries(this.data.lastSeen)) {
        if (Number(value) < cutoff) delete this.data.lastSeen[key];
      }
      this._save().catch(() => {});
    }
    return prev;
  }

  // ---------- Statistik top-aktif ----------

  recordActivity(chat, sender, name, now = Date.now()) {
    const target = String(chat || '').trim();
    const who = String(sender || '').trim();
    if (!target || !who) return 0;
    const at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const bucket = this.data.activity[target] || {};
    const row = bucket[who] || { name: '', count: 0, lastAt: 0 };
    row.count = (Number(row.count) || 0) + 1;
    row.lastAt = at;
    const cleanName = String(name || '').trim().slice(0, 60);
    if (cleanName) row.name = cleanName;
    bucket[who] = row;
    this.data.activity[target] = bucket;

    // Hemat disk: tulis maksimal sekali per 30 detik, sekaligus rapikan data
    // lama. Anggota yang tidak aktif 90 hari atau di luar top 200 dibuang.
    if (!this._activitySaveAt || at - this._activitySaveAt >= ACTIVITY_SAVE_INTERVAL_MS) {
      this._activitySaveAt = at;
      const cutoff = at - ACTIVITY_RETENTION_MS;
      for (const [gc, rows] of Object.entries(this.data.activity)) {
        const entries = Object.entries(rows || {}).filter(
          ([, value]) => Number(value && value.lastAt) >= cutoff
        );
        entries.sort((a, b) => (Number(b[1].count) || 0) - (Number(a[1].count) || 0));
        this.data.activity[gc] = Object.fromEntries(entries.slice(0, ACTIVITY_MAX_PER_CHAT));
      }
      this._save().catch(() => {});
    }
    return row.count;
  }

  getTopActivity(chat, limit = 10) {
    const target = String(chat || '').trim();
    const rows = Object.entries(this.data.activity[target] || {});
    const max = Math.max(1, Math.min(50, Number(limit) || 10));
    return rows
      .map(([jid, value]) => ({
        jid,
        name: String((value && value.name) || ''),
        count: Number(value && value.count) || 0,
        lastAt: Number(value && value.lastAt) || 0,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.lastAt - a.lastAt ||
          String(a.jid).localeCompare(String(b.jid))
      )
      .slice(0, max);
  }

  totalActivity(chat) {
    const rows = Object.values(this.data.activity[String(chat || '').trim()] || {});
    return rows.reduce((sum, row) => sum + (Number(row && row.count) || 0), 0);
  }

  resetActivity(chat) {
    const target = String(chat || '').trim();
    if (!target || !this.data.activity[target]) return Promise.resolve(false);
    delete this.data.activity[target];
    return this._save().then(() => true);
  }

  // ---------- Waktu tidur Tsukasa ----------

  getSleep() {
    return { ...(this.data.sleep || {}) };
  }

  setSleep(value) {
    const next = value && typeof value === 'object' ? { ...value } : {};
    this.data.sleep = next;
    return this._save().then(() => this.getSleep());
  }

  getGroupGuard(chat) {
    const g = this.data.groupGuard[chat] || {};
    return {
      schedule: {
        enabled: Boolean(g.schedule && g.schedule.enabled),
        open: (g.schedule && g.schedule.open) || '',
        close: (g.schedule && g.schedule.close) || '',
        weekendOnly: Boolean(g.schedule && g.schedule.weekendOnly),
      },
      antilink: Boolean(g.antilink),
      antispam: Boolean(g.antispam),
      linkAllow: Array.isArray(g.linkAllow) ? g.linkAllow.slice() : [],
      mutes: g.mutes && typeof g.mutes === 'object' ? { ...g.mutes } : {},
      warnLimit: Math.max(1, Number(g.warnLimit) || WARN_LIMIT),
      muteMinutes: Math.max(1, Number(g.muteMinutes) || 10),
      events: g.events || {},
      updated: Number(g.updated) || 0,
    };
  }

  setGroupGuard(chat, patch) {
    const cur = this.data.groupGuard[chat] || {};
    this.data.groupGuard[chat] = {
      ...cur,
      ...(patch || {}),
      updated: Date.now(),
    };
    return this._save();
  }

  listGroupGuards() {
    return Object.entries(this.data.groupGuard || {}).map(([chat, g]) => [
      chat,
      {
        schedule: {
          enabled: Boolean(g.schedule && g.schedule.enabled),
          open: (g.schedule && g.schedule.open) || '',
          close: (g.schedule && g.schedule.close) || '',
          weekendOnly: Boolean(g.schedule && g.schedule.weekendOnly),
        },
        antilink: Boolean(g.antilink),
        antispam: Boolean(g.antispam),
        linkAllow: Array.isArray(g.linkAllow) ? g.linkAllow.slice() : [],
        mutes: g.mutes && typeof g.mutes === 'object' ? { ...g.mutes } : {},
        warnLimit: Math.max(1, Number(g.warnLimit) || WARN_LIMIT),
        muteMinutes: Math.max(1, Number(g.muteMinutes) || 10),
        events: g.events || {},
        updated: Number(g.updated) || 0,
      },
    ]);
  }

  getGroupMute(chat, user) {
    const g = this.data.groupGuard[chat] || {};
    const until = Number((g.mutes || {})[user]) || 0;
    if (!until) return { muted: false, until: 0 };
    if (until <= Date.now()) {
      this.clearGroupMute(chat, user);
      return { muted: false, until: 0 };
    }
    return { muted: true, until };
  }

  muteGroupUser(chat, user, until) {
    const cur = this.data.groupGuard[chat] || {};
    const mutes = { ...(cur.mutes || {}), [user]: Number(until) || 0 };
    this.data.groupGuard[chat] = { ...cur, mutes, updated: Date.now() };
    return this._save();
  }

  clearGroupMute(chat, user) {
    const cur = this.data.groupGuard[chat] || {};
    if (!cur.mutes || !cur.mutes[user]) return Promise.resolve(false);
    const mutes = { ...cur.mutes };
    delete mutes[user];
    this.data.groupGuard[chat] = { ...cur, mutes, updated: Date.now() };
    return this._save().then(() => true);
  }

  markGroupGuardEvent(chat, action, token) {
    const cur = this.data.groupGuard[chat] || {};
    const events = { ...(cur.events || {}), [action]: String(token || '') };
    this.data.groupGuard[chat] = { ...cur, events, updated: Date.now() };
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
    let w = this.data.warns[key] || { count: 0 };
    if (w.updated && Date.now() - Number(w.updated) > WARN_RESET_MS) {
      w = { count: 0 };
    }
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

  // ---------- AFK ----------

  getAfk(user) {
    const a = (this.data.afk || {})[user];
    if (!a) return null;
    return {
      user,
      reason: String(a.reason || ''),
      chat: String(a.chat || ''),
      since: Number(a.since) || 0,
      updated: Number(a.updated) || 0,
    };
  }

  setAfk(user, reason, chat) {
    const key = String(user || '').trim();
    if (!key) return Promise.reject(new Error('invalid afk user'));
    const now = Date.now();
    this.data.afk = {
      ...(this.data.afk || {}),
      [key]: {
        reason: String(reason || '').slice(0, 200),
        chat: String(chat || ''),
        since: now,
        updated: now,
      },
    };
    return this._save();
  }

  clearAfk(user) {
    const key = String(user || '').trim();
    if (!key || !(this.data.afk || {})[key]) return Promise.resolve(false);
    const next = { ...(this.data.afk || {}) };
    delete next[key];
    this.data.afk = next;
    return this._save().then(() => true);
  }

  listAfkForChat(chat) {
    return Object.entries(this.data.afk || {})
      .filter(([, a]) => a && a.chat === chat)
      .map(([user, a]) => ({ user, ...a }))
      .sort((a, b) => Number(b.since) - Number(a.since));
  }

  // ---------- Anime channel auto-post ----------

  getAnimeChannelState() {
    const st = this.data.animeChannel || {};
    return {
      posted: (st && st.posted) || {},
      lastPostAt: Number(st && st.lastPostAt) || 0,
      day: (st && st.day) || '',
      dayCount: Number(st && st.dayCount) || 0,
      newsCount: Number(st && st.newsCount) || 0,
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

    const newsCount = (Number(st.newsCount) || 0) + (options.news ? 1 : 0);

    this.data.animeChannel = {
      posted,
      lastPostAt: now,
      day: today,
      dayCount: dayCount + 1,
      newsCount,
    };
    return this._save();
  }
}

module.exports = { Store, WARN_LIMIT };
