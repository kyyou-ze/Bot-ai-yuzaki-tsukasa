'use strict';

const fs = require('fs');
const path = require('path');
const wa = require('../wa');
const log = require('../logger');

// Alias mood -> nama folder pack. Pemetaan ini dipakai untuk command
// ".srandom lucu" maupun saat menebak mood dari teks.
const MOOD_ALIASES = {
  lucu: ['lucu', 'ngakak', 'wkwk', 'wkwkwk', 'haha', 'hehe', 'funny', 'ketawa'],
  sedih: ['sedih', 'nangis', 'sad', 'galau', 'kecewa'],
  marah: ['marah', 'kesal', 'emosi', 'angry', 'bt', 'bete', 'murka'],
  love: ['love', 'cinta', 'sayang', 'kangen', 'peluk', 'cium', 'baper'],
  ngantuk: ['ngantuk', 'mengantuk', 'tidur', 'capek', 'lelah', 'tired'],
  hai: ['hai', 'halo', 'hello', 'hi', 'pagi', 'siang', 'sore', 'malam'],
  kaget: ['kaget', 'wow', 'anjir', 'what', 'shock', 'kagum'],
};

const VALID_MOOD = /^[a-z0-9_-]{1,24}$/;
const DEFAULT_MOOD = 'lain';
const MAX_STICKER_BYTES = 5 * 1024 * 1024;
const MAX_SEEN = 500;

function sanitizeMood(value) {
  const mood = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (!mood) return '';
  return VALID_MOOD.test(mood) ? mood : '';
}

class StickerReplyFeature {
  constructor(cfg) {
    const conf = cfg || {};
    this.enabled = conf.stickerReplyEnabled !== false;
    this.chance = Math.max(0, Math.min(100, Number(conf.stickerReplyChance) || 0));
    this.cooldownMs = Math.max(5, Number(conf.stickerReplyCooldownSec) || 90) * 1000;
    this.dir = path.resolve(conf.stickerDir || 'assets/stickers');
    this.lastAuto = new Map();
    this.seen = new Set();
  }

  static isCommand(name) {
    return ['srandom', 'spack', 'sadd', 'slist', 'sdel'].includes(
      String(name || '').toLowerCase()
    );
  }

  resolveMood(text) {
    const low = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!low) return '';
    const words = low.split(' ');
    for (const [mood, aliases] of Object.entries(MOOD_ALIASES)) {
      if (words.includes(mood) || aliases.some((alias) => words.includes(alias))) return mood;
    }
    return '';
  }

  hasMedia(content) {
    if (!content) return false;
    if (content.imageMessage || content.videoMessage) return true;
    const quoted = wa.quotedContent(wa.contextInfoOf(content));
    return Boolean(quoted && (quoted.imageMessage || quoted.videoMessage));
  }

  async moods() {
    let entries;
    try {
      entries = await fs.promises.readdir(this.dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const rows = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const files = await this.files(entry.name);
      if (files.length > 0) rows.push({ mood: entry.name, count: files.length });
    }
    rows.sort((a, b) => a.mood.localeCompare(b.mood));
    return rows;
  }

  async files(mood) {
    const folder = path.join(this.dir, mood);
    try {
      const names = await fs.promises.readdir(folder);
      return names.filter((name) => /\.webp$/i.test(name)).sort();
    } catch {
      return [];
    }
  }

  async pick(mood) {
    const list = await this.files(mood);
    if (list.length === 0) return '';
    const name = list[Math.floor(Math.random() * list.length)];
    return path.join(this.dir, mood, name);
  }

  async sendFile(chat, m, file) {
    try {
      const stat = await fs.promises.stat(file);
      if (stat.size > MAX_STICKER_BYTES) {
        log.warn(`[STICKER] ${file} terlalu besar (${stat.size} bytes), dilewati`);
        return false;
      }
      const buf = await fs.promises.readFile(file);
      await wa.sendSticker(chat, buf, m);
      return true;
    } catch (err) {
      log.error(`[STICKER] gagal kirim ${file}: ${err.message}`);
      return false;
    }
  }

  async sendRandom(chat, m, mood) {
    let target = mood;
    if (!target) {
      const rows = await this.moods();
      if (rows.length === 0) return false;
      target = rows[Math.floor(Math.random() * rows.length)].mood;
    }
    const file = await this.pick(target);
    if (!file) return false;
    return this.sendFile(chat, m, file);
  }

  canAuto(chat) {
    const last = this.lastAuto.get(chat) || 0;
    return Date.now() - last >= this.cooldownMs;
  }

  markAuto(chat) {
    this.lastAuto.set(chat, Date.now());
  }

  remember(id) {
    if (!id) return true;
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    if (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value);
    return true;
  }

  /**
   * Balas sticker yang dikirim user dengan sticker acak dari pack, sambil
   * meng-quote pesan sticker tersebut. Dibatasi probabilitas + cooldown agar
   * tidak spam.
   */
  async handleAuto(sock, m, content) {
    if (!this.enabled || this.chance <= 0) return false;
    if (!content || !content.stickerMessage) return false;
    const chat = m.key.remoteJid;
    if (!chat || (m.key && m.key.fromMe)) return false;
    if (!this.canAuto(chat)) return false;
    if (Math.random() * 100 >= this.chance) return false;

    const rows = await this.moods();
    if (rows.length === 0) return false;
    if (!this.remember(String(m.key.id || ''))) return false;

    const mood = rows[Math.floor(Math.random() * rows.length)].mood;
    const sent = await this.sendRandom(chat, m, mood);
    if (sent) this.markAuto(chat);
    return sent;
  }

  async extractSticker(content, m, chat) {
    let media = content && content.stickerMessage;
    let quotedContent = null;
    if (!media) {
      quotedContent = wa.quotedContent(wa.contextInfoOf(content));
      if (quotedContent && quotedContent.stickerMessage) media = quotedContent.stickerMessage;
    }
    if (!media) return null;

    let buf;
    if (quotedContent && quotedContent.stickerMessage) {
      buf = await wa.downloadQuoted(quotedContent, chat, m.key.participant || chat);
    } else {
      buf = await wa.downloadMedia({ key: m.key, message: content });
    }
    if (!buf || buf.length === 0) return null;
    if (buf.length > MAX_STICKER_BYTES) {
      throw new Error('Sticker terlalu besar (maksimal 5 MB)');
    }
    return buf;
  }

  async addSticker(m, content, mood) {
    const chat = m.key.remoteJid;
    const safe = sanitizeMood(mood) || DEFAULT_MOOD;
    let buf = null;
    try {
      buf = await this.extractSticker(content, m, chat);
    } catch (err) {
      await wa.sendText(chat, `Gagal mengambil sticker: ${err.message}`, m).catch(() => {});
      return;
    }
    if (!buf) {
      await wa
        .sendText(chat, 'Kirim sticker atau reply sticker, lalu tulis *.sadd <mood>*.', m)
        .catch(() => {});
      return;
    }

    const folder = path.join(this.dir, safe);
    await fs.promises.mkdir(folder, { recursive: true });
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const file = path.join(folder, `${stamp}-${rand}.webp`);
    await fs.promises.writeFile(file, buf);
    const total = (await this.files(safe)).length;
    await wa
      .sendText(
        chat,
        `✅ Sticker disimpan ke pack *${safe}*.\nTotal pack: *${total}* sticker.\n\nLihat: .slist\nAmbil: .srandom ${safe}`,
        m
      )
      .catch(() => {});
  }

  async listPacks(m) {
    const chat = m.key.remoteJid;
    const rows = await this.moods();
    if (rows.length === 0) {
      await wa
        .sendText(
          chat,
          '🎨 *Sticker Pack* masih kosong.\n\nCara isi:\n1. Kirim/reply sticker\n2. Ketik *.sadd lucu*\n\nMood contoh: lucu, sedih, marah, love, ngantuk, hai, kaget',
          m
        )
        .catch(() => {});
      return;
    }
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const lines = [
      '🎨 *Sticker Pack*',
      ...rows.map((row) => `• *${row.mood}* — ${row.count} sticker`),
      '',
      `Total: *${total}* sticker`,
      '',
      'Ambil: .srandom <mood>',
      'Tambah: reply sticker lalu .sadd <mood>',
      'Hapus: .sdel <mood> <nomor>',
    ];
    await wa.sendText(chat, lines.join('\n'), m).catch(() => {});
  }

  async deleteSticker(m, rest) {
    const chat = m.key.remoteJid;
    const parts = String(rest || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const mood = sanitizeMood(parts.shift() || '');
    if (!mood) {
      await wa.sendText(chat, 'Gunakan: *.sdel <mood> <nomor>*\nContoh: .sdel lucu 2', m).catch(
        () => {}
      );
      return;
    }
    const list = await this.files(mood);
    if (list.length === 0) {
      await wa.sendText(chat, `Pack *${mood}* kosong atau tidak ditemukan.`, m).catch(() => {});
      return;
    }

    const target = parts.join(' ').trim();
    let name = '';
    if (/^\d+$/.test(target)) {
      const idx = Number(target) - 1;
      name = list[idx] || '';
    } else if (target) {
      name = list.includes(target) ? target : '';
    }
    if (!name) {
      const lines = [
        `Hapus sticker dari pack *${mood}*:`,
        ...list.slice(0, 20).map((file, i) => `${i + 1}. ${file}`),
        '',
        `Contoh: .sdel ${mood} 1`,
      ];
      await wa.sendText(chat, lines.join('\n'), m).catch(() => {});
      return;
    }

    try {
      await fs.promises.unlink(path.join(this.dir, mood, name));
    } catch (err) {
      await wa
        .sendText(chat, `Gagal menghapus sticker: ${err.message}`, m)
        .catch(() => {});
      return;
    }
    await wa
      .sendText(chat, `🗑️ Sticker *${name}* dihapus dari pack *${mood}*.`, m)
      .catch(() => {});
  }

  async handleCommand(sock, m, content, cmd, rest) {
    const name = String(cmd || '').toLowerCase();
    const chat = m.key.remoteJid;
    if (!chat) return false;

    if (name === 'slist') {
      await this.listPacks(m);
      return true;
    }

    if (name === 'sadd') {
      await this.addSticker(m, content, rest);
      return true;
    }

    if (name === 'sdel') {
      await this.deleteSticker(m, rest);
      return true;
    }

    if (name === 'srandom' || name === 'spack') {
      const arg = String(rest || '').trim();
      const mood = this.resolveMood(arg) || sanitizeMood(arg) || '';
      if (arg && !mood) {
        await wa.sendText(chat, `Nama mood tidak valid: *${arg}*`, m).catch(() => {});
        return true;
      }
      const sent = await this.sendRandom(chat, m, mood);
      if (!sent) {
        const rows = await this.moods();
        const hint =
          rows.length > 0 ? `Mood tersedia: ${rows.map((row) => row.mood).join(', ')}` : '';
        await wa
          .sendText(
            chat,
            `Belum ada sticker${mood ? ` untuk mood *${mood}*` : ''}.\n${hint}${
              hint ? '\n\n' : ''
            }Tambah dulu dengan reply sticker lalu *.sadd <mood>*.`,
            m
          )
          .catch(() => {});
      }
      return true;
    }

    if (name === 's') {
      // ".s <mood>" = kirim sticker random. Kalau ada gambar/video, biarkan
      // StickerFeature yang mengonversi media tersebut.
      if (this.hasMedia(content)) return false;
      const mood = this.resolveMood(rest);
      if (!mood) return false;
      const sent = await this.sendRandom(chat, m, mood);
      if (!sent) {
        await wa
          .sendText(chat, `Pack *${mood}* belum ada. Tambah dengan .sadd ${mood}`, m)
          .catch(() => {});
      }
      return true;
    }

    return false;
  }
}

module.exports = { StickerReplyFeature, MOOD_ALIASES, sanitizeMood };
