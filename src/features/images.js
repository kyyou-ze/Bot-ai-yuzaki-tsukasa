'use strict';

const log = require('../logger');
const fs = require('fs');
const path = require('path');

const wa = require('../wa');
const { downloadBytes, fetchWithTimeout, publicPath, randomPick } = require('../util');

// ---------------- Blue Archive ----------------
class BaImageFeature {
  constructor(cfg, reTrigger) {
    this.index = {};
    this.reTrigger = reTrigger || null;
    this.reBA = /^ba(?:\s+(?:random|img|gambar|foto))?\s*$/i;
    this.reNat = /\b(kirim|minta|tolong|please).*(blue\s*archive)|\bblue\s*archive\b/i;
    this.loadIndex(cfg.baLinksLocal, cfg.baLinksUrl);
  }

  normalizeText(text) {
    let low = String(text || '').trim().toLowerCase();
    if (this.reTrigger) low = low.replace(this.reTrigger, ' ');
    // Buang tanda "!" di awal supaya "!ba" dan "tsukasa !ba" sama-sama dikenali.
    low = low.replace(/^\s*!\s*/, '').replace(/\s+/g, ' ').trim();
    return low;
  }

  loadIndex(local, remote) {
    if (local) {
      try {
        this.parse(fs.readFileSync(publicPath(local)));
        if (Object.keys(this.index).length) return;
      } catch {
        /* ignore */
      }
    }
    if (remote) {
      fetchWithTimeout(remote, {}, 30000)
        .then((r) => r.arrayBuffer())
        .then((b) => this.parse(Buffer.from(b)))
        .catch(() => {});
    }
  }

  parse(buf) {
    const text = buf.toString('utf8');
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      return;
    }

    if (Array.isArray(obj)) {
      if (obj.length && typeof obj[0] === 'string') {
        this.index = { __all__: obj.filter((u) => /^https?:\/\//i.test(String(u).trim())) };
        return;
      }
      if (obj.length && typeof obj[0] === 'object') {
        const out = {};
        for (const it of obj) {
          const key = String(it.name || '').trim().toLowerCase();
          if (!key || !Array.isArray(it.urls)) continue;
          out[key] = it.urls.filter((u) => /^https?:\/\//i.test(String(u).trim()));
        }
        this.index = out;
        return;
      }
    }

    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        const key = String(k).trim().toLowerCase();
        if (!key || !Array.isArray(v)) continue;
        out[key] = v.filter((u) => /^https?:\/\//i.test(String(u).trim()));
      }
      this.index = out;
    }
  }

  flattenAll() {
    if (this.index.__all__ && this.index.__all__.length) return this.index.__all__;
    return Object.values(this.index).flat();
  }

  async sendImage(chat, m, url, caption) {
    try {
      const { data, mime } = await downloadBytes(url, 20 * 1024 * 1024, 30000);
      await wa.sendImage(chat, data, caption, m, mime || 'image/jpeg');
      return true;
    } catch (err) {
      log.error('[BA] gagal kirim gambar:', err.message);
      return false;
    }
  }

  async sendRandom(chat, m) {
    const urls = this.flattenAll();
    if (urls.length === 0) {
      await wa.sendText(chat, 'Index Blue Archive kosong / gagal dimuat.', m).catch(() => {});
      return true;
    }
    const picked = [];
    const pool = [...urls];
    for (let i = 0; i < 2 && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    for (const url of picked) {
      await this.sendImage(chat, m, url, 'Blue Archive 💙');
    }
    return true;
  }

  async sendByName(chat, m, name) {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return false;
    const urls = this.index[key] || [];
    if (urls.length === 0) {
      await wa.sendText(chat, 'Maaf, karakter itu belum ada di index BA-ku.', m).catch(() => {});
      return true;
    }
    for (const url of urls.slice(0, 3)) {
      await this.sendImage(chat, m, url, `BA: ${key}`);
    }
    return true;
  }

  async handle(chat, m, content, text) {
    const low = this.normalizeText(text || wa.extractText(content));
    if (this.reBA.test(low)) return this.sendRandom(chat, m);
    if (this.reNat.test(low) || low.includes('blue archive')) return this.sendRandom(chat, m);
    if (low.startsWith('ba:')) return this.sendByName(chat, m, low.slice(3));
    return false;
  }
}

// ---------------- Pap ----------------
class PapFeature {
  constructor(cfg) {
    this.urls = [];
    this.rePap = /\bpap\b/i;
    this.caption = `Pap dari ${cfg.botName || 'Bot'}`;
    try {
      const raw = JSON.parse(fs.readFileSync(publicPath(cfg.papLinksPath), 'utf8'));
      this.urls = (Array.isArray(raw) ? raw : [])
        .map((u) => String(u || '').trim())
        .filter((u) => /^https?:\/\//i.test(u));
    } catch (err) {
      log.error(`[PAP] gagal memuat ${cfg.papLinksPath}:`, err.message);
    }
  }

  async handle(chat, m, content, text) {
    if (this.urls.length === 0) return false;
    const raw = String(text || wa.extractText(content) || '');
    if (!this.rePap.test(raw)) return false;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.urls.length === 0) break;
      const idx = Math.floor(Math.random() * this.urls.length);
      const url = this.urls[idx];
      try {
        const { data, mime } = await downloadBytes(url, 25 * 1024 * 1024, 30000);
        await wa.sendImage(chat, data, this.caption, m, mime || 'image/jpeg');
        return true;
      } catch (err) {
        log.error(`[PAP] gagal ${url}:`, err.message);
        this.urls.splice(idx, 1);
      }
    }
    await wa.sendText(chat, 'Maaf, aku belum bisa kirim pap sekarang.', m).catch(() => {});
    return true;
  }
}

module.exports = { BaImageFeature, PapFeature, randomPick, path };
