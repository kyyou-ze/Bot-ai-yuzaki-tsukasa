'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./logger');
const wa = require('./wa');
const { isGroupJid } = require('./util');

// Promosi otomatis: setiap beberapa jam bot mengirim satu pesan promosi
// (web + nomor bot) ke grup yang diikuti. Pesan dikirim bergiliran dengan
// batas per putaran supaya tidak menembak semua grup sekaligus.
const MIN_INTERVAL_H = 1;
const STATE_FILE = path.resolve(process.env.PROMO_STATE_FILE || 'database/promo.json');

const DEFAULT_TEXT = [
  '*Tsukasa* — bot WhatsApp untuk grup',
  '',
  'Sticker, unduh video, game grup, RPG, dan moderasi.',
  'Semua dari satu nomor, tanpa instal aplikasi.',
  '',
  'Coba: {url}',
  'Atau simpan {number} lalu kirim .menu',
].join('\n');

function readState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    log.warn('[PROMO] gagal menyimpan state:', err && err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function displayNumber(digits) {
  const n = String(digits || '').replace(/\D+/g, '');
  if (!n) return '';
  if (n.length >= 12) return `+${n.slice(0, 2)} ${n.slice(2, 5)}-${n.slice(5, 9)}-${n.slice(9)}`;
  return `+${n}`;
}

class Promo {
  constructor(cfg) {
    this.cfg = cfg;
    this.opts = (cfg && cfg.promo) || {};
    this.timer = null;
    this.running = false;
    this.state = readState();
    this.lastResult = null;
  }

  get url() {
    return String(this.opts.url || '').trim() || 'https://tsukasabot-md.vercel.app';
  }

  get intervalMs() {
    const hours = Math.max(MIN_INTERVAL_H, Number(this.opts.intervalHours) || 6);
    return hours * 60 * 60 * 1000;
  }

  get enabled() {
    if (typeof this.state.enabled === 'boolean') return this.state.enabled;
    return Boolean(this.opts.enabled);
  }

  number() {
    const raw =
      this.opts.number ||
      (this.cfg && this.cfg.pairingNumber) ||
      process.env.PAIRING_NUMBER ||
      '';
    let digits = String(raw).replace(/\D+/g, '');
    if (!digits) {
      try {
        const sock = wa.getSock();
        const id = sock && sock.user && sock.user.id ? String(sock.user.id) : '';
        digits = id.split(':')[0].replace(/\D+/g, '');
      } catch {
        /* abaikan */
      }
    }
    return digits;
  }

  text() {
    const template = String(this.opts.message || '').trim() || DEFAULT_TEXT;
    const number = this.number();
    return template
      .replace(/\{url\}/g, this.url)
      .replace(/\{number\}/g, displayNumber(number) || 'nomor bot')
      .replace(/\{bot\}/g, (this.cfg && this.cfg.botName) || 'Tsukasa');
  }

  async listGroups() {
    const sock = wa.getSock();
    if (!sock || typeof sock.groupFetchAllParticipating !== 'function') return [];
    const map = await sock.groupFetchAllParticipating();
    return Object.keys(map || {}).filter((jid) => isGroupJid(jid));
  }

  async preview() {
    if (!this.opts.imageUrl) return null;
    try {
      const menuBanner = require('./menubanner');
      return await menuBanner.buildMenuPreview({
        imageUrl: this.opts.imageUrl,
        linkUrl: this.url,
        title: (this.cfg && this.cfg.botName) || 'Tsukasa',
        description: 'Sticker, unduhan, game grup, dan moderasi.',
      });
    } catch (err) {
      log.warn('[PROMO] banner dilewati:', err && err.message);
      return null;
    }
  }

  async run(reason = 'auto') {
    if (this.running) return { ok: false, reason: 'promosi sebelumnya masih berjalan' };
    this.running = true;
    const startedAt = Date.now();
    try {
      const groups = await this.listGroups();
      if (!groups.length) {
        this.lastResult = { ok: false, reason: 'belum ada grup', groups: 0 };
        return this.lastResult;
      }

      const maxPerRun = Math.max(1, Number(this.opts.maxPerRun) || 20);
      const cursor = Number(this.state.cursor) || 0;
      // Putar urutan supaya semua grup kebagian tanpa menembak semuanya
      // dalam satu putaran.
      const ordered = groups.slice(cursor).concat(groups.slice(0, cursor)).slice(0, maxPerRun);
      const text = this.text();
      const preview = await this.preview();
      const rawDelay = Number(this.opts.delaySec);
      const baseDelay = (Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 8) * 1000;

      let sent = 0;
      let failed = 0;
      for (let i = 0; i < ordered.length; i += 1) {
        const jid = ordered[i];
        try {
          await wa.sendText(jid, text, null, null, preview);
          sent += 1;
        } catch (err) {
          failed += 1;
          log.warn('[PROMO] gagal kirim ke', jid, err && err.message);
        }
        if (i < ordered.length - 1 && baseDelay > 0) {
          await sleep(baseDelay + Math.floor(Math.random() * 4000));
        }
      }

      this.state = {
        ...this.state,
        lastAt: Date.now(),
        cursor: (cursor + ordered.length) % groups.length,
        lastSent: sent,
        lastFailed: failed,
        lastGroups: groups.length,
        lastReason: reason,
      };
      writeState(this.state);
      this.lastResult = {
        ok: sent > 0,
        sent,
        failed,
        groups: groups.length,
        durationMs: Date.now() - startedAt,
      };
      log.info(
        `[PROMO] ${sent} terkirim, ${failed} gagal dari ${groups.length} grup (${reason})`
      );
      return this.lastResult;
    } catch (err) {
      this.lastResult = { ok: false, reason: err && err.message };
      log.warn('[PROMO] putaran gagal:', err && err.message);
      return this.lastResult;
    } finally {
      this.running = false;
    }
  }

  nextDelay() {
    const elapsed = Date.now() - (Number(this.state.lastAt) || 0);
    const remaining = this.intervalMs - elapsed;
    if (remaining > 0) return remaining;
    return Math.max(0, Number(this.opts.startDelaySec) || 120) * 1000;
  }

  schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.timer = null;
      if (this.enabled) await this.run('auto');
      if (this.enabled) this.schedule();
    }, this.nextDelay());
    if (this.timer.unref) this.timer.unref();
  }

  start() {
    if (!this.enabled || this.timer) return;
    this.schedule();
    const next = new Date(Date.now() + this.nextDelay());
    log.info(`[PROMO] aktif, promosi berikutnya ${next.toISOString()}`);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  setEnabled(value) {
    this.state = { ...this.state, enabled: Boolean(value) };
    writeState(this.state);
    if (this.enabled) this.start();
    else this.stop();
    return this.enabled;
  }

  status() {
    return {
      enabled: this.enabled,
      intervalH: this.intervalMs / 3600000,
      url: this.url,
      lastAt: Number(this.state.lastAt) || 0,
      cursor: Number(this.state.cursor) || 0,
      lastSent: Number(this.state.lastSent) || 0,
      lastFailed: Number(this.state.lastFailed) || 0,
      lastGroups: Number(this.state.lastGroups) || 0,
      running: this.running,
      scheduled: Boolean(this.timer),
      lastResult: this.lastResult,
    };
  }
}

module.exports = { Promo, STATE_FILE };
