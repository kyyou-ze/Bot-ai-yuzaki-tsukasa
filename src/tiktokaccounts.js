'use strict';

const log = require('./logger');
const { atomicWriteJson, safeReadJson } = require('./util');

const USERNAME_RE = /^[a-zA-Z0-9._]{2,24}$/;

/**
 * Ubah input user jadi username TikTok yang konsisten: "@user". Menerima
 * "@user", "user", atau link "https://www.tiktok.com/@user/video/123".
 */
function normalizeTikTokAccount(value) {
  const raw = String(value || '').trim();
  // Terima link profil/video TikTok, atau username biasa.
  const url = raw.match(/^https?:\/\/(?:www\.)?tiktok\.com\/@?([^/?#\s]+)/i);
  const name = url ? url[1] : raw.replace(/^@+/, '');
  if (!USERNAME_RE.test(name)) return '';
  return '@' + name;
}

function normalizeAccountList(list) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const acc = normalizeTikTokAccount(item);
    if (!acc) continue;
    const key = acc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(acc);
  }
  return out;
}

/**
 * Daftar akun TikTok yang dipantau. Bisa diubah dari WhatsApp lewat command
 * /addakun, /delakun, /listakun, dan /detector tanpa mengedit .env.
 *
 * Sumber awal:
 * - Kalau data/tiktok/accounts.json belum berisi `accounts`, pakai
 *   TIKTOK_ACCOUNTS dari .env/panel.
 * - Setelah ada perubahan dari command, nilai di file JSON yang dipakai.
 */
class TikTokAccounts {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.file = this.cfg.tiktokAccountsDb || './data/tiktok/accounts.json';
    this.envAccounts = normalizeAccountList(this.cfg.tiktokAccounts);
    this.envEnabled = this.cfg.tiktokMonitorEnabled !== false;

    const raw = safeReadJson(this.file, null);
    this.accounts = null;
    this.enabled = this.envEnabled;

    if (Array.isArray(raw)) {
      this.accounts = normalizeAccountList(raw);
    } else if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.accounts)) this.accounts = normalizeAccountList(raw.accounts);
      if (typeof raw.enabled === 'boolean') this.enabled = raw.enabled;
    }

    this._writing = Promise.resolve();
  }

  /** Daftar akun aktif (array baru, aman untuk diubah pemanggil). */
  list() {
    return (this.accounts === null ? this.envAccounts : this.accounts).slice();
  }

  /** "env" kalau masih ikut .env, "file" kalau sudah diubah via command. */
  source() {
    return this.accounts === null ? 'env' : 'file';
  }

  isEnabled() {
    return Boolean(this.enabled);
  }

  has(account) {
    const acc = normalizeTikTokAccount(account);
    if (!acc) return false;
    return this.list().some((x) => x.toLowerCase() === acc.toLowerCase());
  }

  async add(account) {
    const acc = normalizeTikTokAccount(account);
    if (!acc) return { ok: false, reason: 'invalid' };

    const list = this.list();
    if (list.some((x) => x.toLowerCase() === acc.toLowerCase())) {
      return { ok: false, reason: 'exists', account: acc, total: list.length };
    }

    list.push(acc);
    this.accounts = list;
    await this._save();
    return { ok: true, account: acc, total: list.length };
  }

  async remove(account) {
    const acc = normalizeTikTokAccount(account);
    if (!acc) return { ok: false, reason: 'invalid' };

    const list = this.list();
    const next = list.filter((x) => x.toLowerCase() !== acc.toLowerCase());
    if (next.length === list.length) {
      return { ok: false, reason: 'missing', account: acc, total: list.length };
    }

    this.accounts = next;
    await this._save();
    return { ok: true, account: acc, total: next.length };
  }

  async setEnabled(value) {
    this.enabled = Boolean(value);
    await this._save();
    return this.enabled;
  }

  _save() {
    const payload = {
      accounts: this.accounts === null ? this.envAccounts : this.accounts,
      enabled: this.enabled,
    };
    this._writing = this._writing
      .then(() => atomicWriteJson(this.file, payload))
      .catch((err) => log.error('[TIKTOK] gagal menyimpan daftar akun:', err.message));
    return this._writing;
  }
}

module.exports = {
  TikTokAccounts,
  normalizeTikTokAccount,
  normalizeAccountList,
};
