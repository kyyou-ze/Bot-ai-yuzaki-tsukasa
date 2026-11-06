'use strict';

const log = require('../logger');
const wa = require('../wa');
const newsfeeds = require('../newsfeeds');
const instagram = require('../instagram');
const settings = require('../settings');
const { canonicalTitle } = require('../util');
const { downloadImage } = require('../imageutil');

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_NEWS_ITEMS = 5;

function repostTtlMs() {
  const raw = process.env.NEWS_REPOST_TTL_MIN;
  const minutes = raw === undefined ? 12 * 60 : Number(raw);
  return Math.max(5, Number.isFinite(minutes) ? minutes : 12 * 60) * 60 * 1000;
}

class NewsFeature {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.news = this.cfg.news || {};
    // Anti-repost per chat: link/judul yang baru dikirim tidak langsung
    // dikirim lagi saat user memanggil !news berulang kali.
    this.recent = new Map();
    this.gachaCounter = new Map();
  }

  _recent(chat) {
    const now = Date.now();
    const ttl = repostTtlMs();
    let bucket = this.recent.get(chat);
    if (!bucket) {
      bucket = new Map();
      this.recent.set(chat, bucket);
    }
    for (const [key, at] of bucket) {
      if (now - at > ttl) bucket.delete(key);
    }
    if (bucket.size > 500) {
      const oldest = [...bucket.entries()].sort((a, b) => a[1] - b[1]);
      for (const [key] of oldest.slice(0, bucket.size - 400)) bucket.delete(key);
    }
    return bucket;
  }

  _keysOf(item) {
    const keys = [];
    if (item.link) keys.push(`u:${item.link}`);
    if (item.id) keys.push(`i:${item.id}`);
    const title = canonicalTitle(item.title);
    if (title) keys.push(`t:${title}`);
    for (const link of item.xLinks || []) keys.push(`x:${link}`);
    return keys.filter(Boolean);
  }

  _isRecent(chat, item) {
    const bucket = this._recent(chat);
    return this._keysOf(item).some((key) => bucket.has(key));
  }

  _markRecent(chat, item) {
    const bucket = this._recent(chat);
    const now = Date.now();
    for (const key of this._keysOf(item)) bucket.set(key, now);
  }

  static isCommand(name) {
    return ['news', 'berita', 'cosplay'].includes(String(name || '').toLowerCase());
  }

  get sources() {
    return this.news.sources || 'ann,animecorner,gematsu,siliconera';
  }

  get perSource() {
    return Math.max(1, Math.min(20, Number(this.news.perSource) || 8));
  }

  get xRss() {
    return Array.isArray(this.news.xRss) ? this.news.xRss : [];
  }

  reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  helpMessage() {
    return [
      '*Menu Berita & Cosplay*',
      '!news                - berita anime/manga/gacha terbaru + gambar',
      '!news gacha          - khusus update gacha (Azur Lane, Nikke, dll)',
      '!news cosplay        - berita/cosplay terbaru',
      '!news manga          - berita manga/manhwa',
      '*!cosplay <link IG>* - ambil semua foto dari satu post Instagram',
      '',
      '*Kelola cosplay (owner):*',
      '!cosplay add <link>  - simpan post untuk auto-post channel',
      '!cosplay del <link>  - hapus dari daftar',
      '!cosplay list        - lihat daftar & status',
      '!cosplay on|off      - aktifkan/nonaktifkan auto-post',
      '!cosplay every 4     - selipkan cosplay tiap N post',
      '',
      'Contoh:',
      '!cosplay https://www.instagram.com/p/DePI-QHlEhR/',
      '!news gacha',
    ].join('\n');
  }

  async handle(sock, m, cmd, rest, isOwner = false) {
    const name = String(cmd || '').toLowerCase();
    try {
      if (name === 'cosplay') return await this.handleCosplay(m, rest, isOwner);
      return await this.handleNews(m, name, rest);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      log.warn('[NEWS] gagal:', msg);
      await this.reply(m, `❌ Gagal mengambil konten: ${msg}`);
      return true;
    }
  }

  async handleNews(m, cmd, rest) {
    const args = String(rest || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const topic = (args[0] || '').toLowerCase();
    const limit = Math.max(1, Math.min(MAX_NEWS_ITEMS, Number(this.news.items) || 2));

    if (topic === 'help' || topic === 'bantuan') {
      await this.reply(m, this.helpMessage());
      return true;
    }

    const { items, errors, skippedRecent } = await this.pickItems(
      m.key.remoteJid,
      topic,
      limit
    );
    if (!items.length) {
      const detail = errors.length ? `\nSumber gagal: ${errors.map((e) => e.source).join(', ')}` : '';
      const reason = skippedRecent
        ? 'Semua berita terbaru sudah dikirim di chat ini. Coba lagi beberapa saat lagi.'
        : `Belum ada berita bergambar${topic ? ` untuk topik *${topic}*` : ''}. Coba lagi nanti.`;
      await this.reply(m, `ℹ️ ${reason}${detail}`);
      return true;
    }

    const chat = m.key.remoteJid;
    for (const item of items) {
      try {
        await wa.sendImage(chat, item._imageData, newsfeeds.formatNewsCaption(item), m, item._imageMime);
        this._markRecent(chat, item);
      } catch (err) {
        log.warn('[NEWS] gagal kirim item:', err.message);
      }
    }
    return true;
  }

  async handleCosplay(m, rest, isOwner = false) {
    const text = String(rest || '').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || '').toLowerCase();
    const configSubs = [
      'add', 'tambah', 'simpan',
      'del', 'remove', 'hapus',
      'list', 'daftar',
      'on', 'off', 'aktif', 'mati',
      'every', 'interval',
    ];
    if (configSubs.includes(sub)) {
      if (!isOwner) {
        await this.reply(m, '⚙️ Pengaturan cosplay hanya bisa diubah owner.');
        return true;
      }
      return this.handleCosplayConfig(m, sub, parts.slice(1));
    }

    const { url, meta } = instagram.parseArgs(rest);
    if (!url) {
      await this.reply(m, this.helpMessage());
      return true;
    }

    const chat = m.key.remoteJid;
    await this.reply(m, '🔎 Mengambil foto dari post Instagram...');

    const post = await instagram.fetchPost(url);
    const caption = instagram.formatCaption(post, meta);

    const sent = [];
    for (let i = 0; i < post.images.length; i++) {
      try {
        const got = await downloadImage(post.images[i], {
          maxBytes: MAX_IMAGE_BYTES,
          timeoutMs: 30000,
        });
        sent.push({ data: got.data, mime: got.mime });
      } catch (err) {
        log.warn(`[COSPLAY] foto ${i + 1} gagal diunduh:`, err.message);
      }
    }

    if (!sent.length) {
      throw new Error('Semua foto gagal diunduh dari Instagram.');
    }

    for (let i = 0; i < sent.length; i++) {
      const imageCaption = i === 0 ? caption : `📸 ${i + 1}/${sent.length}`;
      await wa.sendImage(chat, sent[i].data, imageCaption, m, sent[i].mime);
    }

    log.info(
      `[COSPLAY] ${post.username || post.author || 'post'} -> ${sent.length} foto (${post.character} / ${post.anime})`
    );
    return true;
  }

  async handleCosplayConfig(m, sub, args) {
    if (sub === 'list' || sub === 'daftar') {
      const posts = settings.describe('COSPLAY_POSTS');
      const rss = settings.describe('COSPLAY_RSS');
      const enabled = settings.describe('COSPLAY_ENABLED');
      const every = settings.describe('ANIME_CHANNEL_COSPLAY_EVERY');
      const lines = [
        '*Pengaturan Cosplay*',
        `Auto-post : ${enabled.text}`,
        `Tiap      : ${every.text} post channel`,
        '',
        `*COSPLAY_POSTS* (${posts.value.length})`,
        ...(posts.value.length ? posts.value.map((u) => `• ${u}`) : ['• (kosong)']),
        '',
        `*COSPLAY_RSS* (${rss.value.length})`,
        ...(rss.value.length ? rss.value.map((u) => `• ${u}`) : ['• (kosong)']),
        '',
        '!cosplay add <link IG>',
        '!cosplay del <link IG>',
        '!cosplay on|off',
        '!cosplay every 4',
      ];
      await this.reply(m, lines.join('\n'));
      return true;
    }

    if (['on', 'off', 'aktif', 'mati'].includes(sub)) {
      const res = settings.set('COSPLAY_ENABLED', ['on', 'aktif'].includes(sub) ? 'on' : 'off');
      await this.reply(
        m,
        res.ok
          ? `✅ Auto-post cosplay: *${settings.describe('COSPLAY_ENABLED').text}*`
          : `❌ ${res.error}`
      );
      return true;
    }

    if (sub === 'every' || sub === 'interval') {
      const res = settings.set('ANIME_CHANNEL_COSPLAY_EVERY', args[0] || '');
      await this.reply(
        m,
        res.ok
          ? `✅ Cosplay diselipkan tiap *${settings.describe('ANIME_CHANNEL_COSPLAY_EVERY').text}* post channel.`
          : `❌ ${res.error}`
      );
      return true;
    }

    if (sub === 'del' || sub === 'remove' || sub === 'hapus') {
      const value = args.join(' ');
      const res = settings.remove('COSPLAY_POSTS', value);
      await this.reply(
        m,
        res.ok
          ? res.unchanged
            ? 'ℹ️ Link itu tidak ada di COSPLAY_POSTS.'
            : `🗑️ Dihapus. Sisa ${settings.describe('COSPLAY_POSTS').value.length} post cosplay.`
          : `❌ ${res.error}`
      );
      return true;
    }

    // add
    const value = args.join(' ');
    const res = settings.add('COSPLAY_POSTS', value);
    await this.reply(
      m,
      res.ok
        ? res.unchanged
          ? 'ℹ️ Link itu sudah ada di COSPLAY_POSTS.'
          : `✅ Ditambahkan. Total ${settings.describe('COSPLAY_POSTS').value.length} post cosplay.`
        : `❌ ${res.error}\nContoh: !cosplay add https://www.instagram.com/p/xxxx/`
    );
    return true;
  }

  async pickItems(chat, topic, limit) {
    const { items, errors } = await newsfeeds.fetchAll(this.sources, {
      perSource: this.perSource,
      extraRss: this.xRss,
    });

    let candidates = newsfeeds.filterByTopic(items, topic);
    if (!candidates.length && topic) candidates = items;

    // Prioritas gacha: setiap N panggilan tanpa topik, dahulukan berita gacha
    // supaya update banner/event tidak tenggelam oleh berita anime biasa.
    if (!topic) {
      const every = Math.max(0, Number(this.news.gachaEvery) || 0);
      if (every > 0) {
        const count = (this.gachaCounter.get(chat) || 0) + 1;
        this.gachaCounter.set(chat, count % Math.max(every * 10, 100));
        if (count % every === 0) {
          const gacha = candidates.filter((it) => it.kind === 'Gacha');
          if (gacha.length) candidates = [...gacha, ...candidates];
        }
      }
    }

    const out = [];
    const seen = new Set();
    let skippedRecent = false;
    for (const item of candidates.slice(0, Math.max(60, limit * 12))) {
      const keys = this._keysOf(item);
      if (keys.some((key) => seen.has(key))) continue;
      if (this._isRecent(chat, item)) {
        skippedRecent = true;
        continue;
      }
      if (!item.image) await newsfeeds.enrichItem(item);
      if (!item.image) continue;

      try {
        const got = await downloadImage(item.image, {
          maxBytes: MAX_IMAGE_BYTES,
          timeoutMs: 20000,
        });
        out.push({ ...item, _imageData: got.data, _imageMime: got.mime });
        for (const key of keys) seen.add(key);
      } catch (err) {
        log.debug('[NEWS] gambar gagal diunduh:', err.message);
      }
      if (out.length >= limit) break;
    }

    return { items: out, errors, skippedRecent };
  }
}

module.exports = { NewsFeature };
