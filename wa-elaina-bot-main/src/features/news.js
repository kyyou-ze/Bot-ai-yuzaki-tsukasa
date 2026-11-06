'use strict';

const log = require('../logger');
const wa = require('../wa');
const newsfeeds = require('../newsfeeds');
const instagram = require('../instagram');
const { downloadBytes } = require('../util');

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_NEWS_ITEMS = 5;

class NewsFeature {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.news = this.cfg.news || {};
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
      'Contoh:',
      '!cosplay https://www.instagram.com/p/DePI-QHlEhR/',
      '!news gacha',
    ].join('\n');
  }

  async handle(sock, m, cmd, rest) {
    const name = String(cmd || '').toLowerCase();
    try {
      if (name === 'cosplay') return await this.handleCosplay(m, rest);
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

    const { items, errors } = await this.pickItems(topic, limit);
    if (!items.length) {
      const detail = errors.length ? `\nSumber gagal: ${errors.map((e) => e.source).join(', ')}` : '';
      await this.reply(
        m,
        `ℹ️ Belum ada berita bergambar${topic ? ` untuk topik *${topic}*` : ''}. Coba lagi nanti.${detail}`
      );
      return true;
    }

    const chat = m.key.remoteJid;
    for (const item of items) {
      try {
        await wa.sendImage(chat, item._imageData, newsfeeds.formatNewsCaption(item), m, item._imageMime);
      } catch (err) {
        log.warn('[NEWS] gagal kirim item:', err.message);
      }
    }
    return true;
  }

  async handleCosplay(m, rest) {
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
        const got = await downloadBytes(post.images[i], MAX_IMAGE_BYTES, 30000);
        if (!/^image\//i.test(got.mime || '')) throw new Error(`bukan gambar (${got.mime || '?'})`);
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

  async pickItems(topic, limit) {
    const { items, errors } = await newsfeeds.fetchAll(this.sources, {
      perSource: this.perSource,
      extraRss: this.xRss,
    });

    let candidates = newsfeeds.filterByTopic(items, topic);
    if (!candidates.length && topic) candidates = items;

    const out = [];
    for (const item of candidates.slice(0, Math.max(24, limit * 8))) {
      if (!item.image) await newsfeeds.enrichItem(item);
      if (!item.image) continue;

      try {
        const got = await downloadBytes(item.image, MAX_IMAGE_BYTES, 20000);
        if (!/^image\//i.test(got.mime || '')) continue;
        out.push({ ...item, _imageData: got.data, _imageMime: got.mime });
      } catch (err) {
        log.debug('[NEWS] gambar gagal diunduh:', err.message);
      }
      if (out.length >= limit) break;
    }

    return { items: out, errors };
  }
}

module.exports = { NewsFeature };
