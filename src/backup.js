'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./logger');
const { localParts, formatDateTime } = require('./util');

function stamp(date = new Date(), timezone = 'Asia/Jakarta') {
  const p = localParts(date instanceof Date ? date.getTime() : date, timezone);
  return `${p.year}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}-` +
    `${String(p.hour).padStart(2, '0')}${String(p.minute).padStart(2, '0')}${String(
      p.second
    ).padStart(2, '0')}`;
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

class SessionBackup {
  constructor(cfg) {
    this.timer = null;
    this.running = false;
    this.last = null;
    this.lastError = '';
    this.configure(cfg);
  }

  /** Terapkan ulang konfigurasi (dipakai saat setting diubah lewat chat). */
  configure(cfg) {
    const conf = cfg || {};
    this.timezone = conf.timezone || 'Asia/Jakarta';
    this.enabled = conf.sessionBackupEnabled !== false;
    this.sessionDir = path.resolve(conf.sessionDir || './session');
    this.dir = path.resolve(conf.sessionBackupDir || './backups/session');
    this.intervalMs =
      Math.max(1, Number(conf.sessionBackupIntervalH) || 6) * 60 * 60 * 1000;
    this.keep = Math.max(1, Math.min(100, Number(conf.sessionBackupKeep) || 7));
    this.lastError = '';

    if (inside(this.dir, this.sessionDir)) {
      this.enabled = false;
      this.lastError = 'folder backup tidak boleh berada di dalam session';
      log.warn(`[BACKUP] ${this.lastError}. Fitur backup dimatikan.`);
    }
    return this;
  }

  start() {
    if (!this.enabled || this.timer) return;
    this.runNow().catch(() => {});
    this.timer = setInterval(() => {
      this.runNow().catch(() => {});
    }, this.intervalMs);
    if (this.timer.unref) this.timer.unref();
    log.info(`[BACKUP] aktif | folder ${this.dir} | tiap ${Math.round(this.intervalMs / 3600000)} jam`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      intervalH: Math.round(this.intervalMs / 3600000),
      keep: this.keep,
      running: this.running,
      last: this.last ? { ...this.last } : null,
      lastError: this.lastError,
    };
  }

  statusText() {
    if (!this.enabled) return this.lastError ? `nonaktif (${this.lastError})` : 'nonaktif';
    if (this.running) return 'sedang berjalan...';
    if (!this.last) return `aktif, belum ada backup (tiap ${Math.round(this.intervalMs / 3600000)} jam)`;
    const when = formatDateTime(this.last.at, this.timezone);
    return `${this.last.files} file, ${when}`;
  }

  async _prune() {
    const entries = await fs.promises.readdir(this.dir, { withFileTypes: true }).catch(() => []);
    const dirs = entries
      .filter((entry) => entry.isDirectory() && /^session-/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    const remove = dirs.slice(0, Math.max(0, dirs.length - this.keep));
    for (const name of remove) {
      await fs.promises
        .rm(path.join(this.dir, name), { recursive: true, force: true })
        .catch((err) => log.warn(`[BACKUP] gagal hapus ${name}: ${err.message}`));
    }
  }

  async _countFiles(dir) {
    let total = 0;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) total += await this._countFiles(path.join(dir, entry.name));
      else total += 1;
    }
    return total;
  }

  async runNow() {
    if (!this.enabled) return { ok: false, reason: 'nonaktif' };
    if (this.running) return { ok: false, reason: 'backup sedang berjalan' };

    this.running = true;
    const started = Date.now();
    try {
      const stat = await fs.promises.stat(this.sessionDir).catch(() => null);
      if (!stat || !stat.isDirectory()) {
        this.lastError = 'folder session belum ada';
        return { ok: false, reason: this.lastError };
      }

      await fs.promises.mkdir(this.dir, { recursive: true });
      const name = `session-${stamp(Date.now(), this.timezone)}`;
      const dest = path.join(this.dir, name);
      await fs.promises.cp(this.sessionDir, dest, { recursive: true, force: true });
      const files = await this._countFiles(dest);
      await this._prune();

      this.last = {
        at: Date.now(),
        path: dest,
        files,
        durationMs: Date.now() - started,
      };
      this.lastError = '';
      log.info(`[BACKUP] sesi tersimpan: ${dest} (${files} file)`);
      return { ok: true, ...this.last };
    } catch (err) {
      this.lastError = err.message;
      log.error(`[BACKUP] gagal: ${err.message}`);
      return { ok: false, reason: err.message };
    } finally {
      this.running = false;
    }
  }
}

module.exports = { SessionBackup };
