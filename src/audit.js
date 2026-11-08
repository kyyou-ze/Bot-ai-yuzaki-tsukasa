'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./logger');

const SENSITIVE = new Set([
  'geminikey',
  'gkey',
  'config',
  'setting',
  'pengaturan',
  'set',
  'isi',
]);

class AuditLog {
  constructor(cfg) {
    this.writing = Promise.resolve();
    this.configure(cfg);
  }

  /** Terapkan ulang konfigurasi (dipakai saat setting diubah lewat chat). */
  configure(cfg) {
    const conf = cfg || {};
    this.enabled = conf.auditLogEnabled !== false;
    this.file = path.resolve(conf.auditLogPath || './database/audit.log');
    this.maxBytes = Math.max(64 * 1024, Number(conf.auditLogMaxBytes) || 512 * 1024);
    return this;
  }

  record(entry) {
    if (!this.enabled) return Promise.resolve(false);
    const e = entry || {};
    const command = String(e.command || '').trim().toLowerCase();
    if (!command) return Promise.resolve(false);
    const rest = SENSITIVE.has(command) ? '[redacted]' : String(e.rest || '').slice(0, 500);
    const row = {
      at: new Date().toISOString(),
      chat: String(e.chat || ''),
      sender: String(e.sender || ''),
      command,
      rest,
    };
    this.writing = this.writing
      .then(async () => {
        await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
        const stat = await fs.promises.stat(this.file).catch(() => null);
        if (stat && stat.size > this.maxBytes) {
          await fs.promises.rename(this.file, `${this.file}.1`).catch(() => {});
        }
        await fs.promises.appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8');
        return true;
      })
      .catch((err) => {
        log.warn(`[AUDIT] gagal menulis: ${err.message}`);
        return false;
      });
    return this.writing;
  }

  async recent(limit = 10) {
    if (!this.enabled) return [];
    const n = Math.max(1, Math.min(200, Number(limit) || 10));
    const raw = await fs.promises.readFile(this.file, 'utf8').catch(() => '');
    if (!raw) return [];
    return raw
      .split('\n')
      .filter(Boolean)
      .slice(-n)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  }

  async clear() {
    if (!this.enabled) return false;
    await fs.promises.rm(this.file, { force: true });
    await fs.promises.rm(`${this.file}.1`, { force: true });
    return true;
  }

  status() {
    return { enabled: this.enabled, file: this.file };
  }
}

module.exports = { AuditLog };
