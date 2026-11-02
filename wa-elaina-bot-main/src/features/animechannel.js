'use strict';

const feeds = require('../animefeeds');
const llm = require('../llm');
const wa = require('../wa');
const { downloadBytes, randomPick } = require('../util');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const CAPTION_LIMIT = 1000;

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function todayKey() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

function inviteCode(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/whatsapp\.com\/channel\/([^/?#\s]+)/i);
  if (m) s = m[1];
  s = s.replace(/^https?:\/\/\S+\//i, '');
  s = s.split(/[/?#]/)[0];
  return s.trim();
}

function channelJid(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('@')) return s;
  if (/^https?:\/\//i.test(s)) s = inviteCode(s);
  if (!s) return '';
  return `${s}@newsletter`;
}

function valueLine(label, value) {
  return value ? `${label}: ${value}` : '';
}

class AnimeChannelPoster {
  constructor(cfg, store, isReady) {
    this.cfg = cfg;
    this.store = store;
    this.ready = typeof isReady === 'function' ? isReady : () => true;

    this.timer = null;
    this.stopped = true;
    this.running = false;
    this.channelJid = '';
    this.channelName = '';
    this.lastError = '';
    this.lastResult = null;
    this.lastAttemptAt = 0;
  }

  get conf() {
    return (this.cfg && this.cfg.animeChannel) || {};
  }

  get enabled() {
    return Boolean(this.conf.enabled);
  }

  start() {
    if (!this.enabled) {
      console.log('[ANIME] Auto-post channel dimatikan (ANIME_CHANNEL_ENABLED=false).');
      return;
    }
    if (!this.stopped || this.timer) return;

    this.stopped = false;
    const delay = Math.max(0, Number(this.conf.startDelaySec) || 0) * 1000;
    console.log(
      `[ANIME] Auto-post channel aktif. Post pertama sekitar ${Math.round(delay / 1000)} detik lagi.`
    );
    this.timer = setTimeout(() => {
      this.timer = null;
      this._runOnce().finally(() => this._schedule());
    }, delay);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  _schedule() {
    if (this.stopped) return;
    const minutes = Math.max(5, Number(this.conf.intervalMin) || 180);
    const delay = minutes * 60 * 1000;
    this.timer = setTimeout(() => {
      this.timer = null;
      this._runOnce().finally(() => this._schedule());
    }, delay);
    if (this.timer.unref) this.timer.unref();
  }

  async _runOnce() {
    if (this.running || this.stopped) return;
    this.running = true;
    this.lastAttemptAt = Date.now();
    try {
      const res = await this.postOne({ reason: 'scheduler' });
      if (res.ok) {
        console.log(`[ANIME] Terkirim ke channel (${res.mode}): ${res.item.title}`);
      } else if (res.skipped) {
        console.log(`[ANIME] Skip: ${res.message}`);
      } else {
        console.warn(`[ANIME] Gagal: ${res.message}`);
      }
    } catch (err) {
      this.lastError = err && err.message ? err.message : String(err);
      console.error('[ANIME] Auto-post error:', this.lastError);
    } finally {
      this.running = false;
    }
  }

  async resolveChannel(force = false) {
    if (this.channelJid && !force) return this.channelJid;

    const direct = channelJid(this.conf.jid);
    if (direct) {
      this.channelJid = direct;
      console.log(`[ANIME] Memakai ANIME_CHANNEL_JID: ${direct}`);
      return direct;
    }

    const code = inviteCode(this.conf.invite);
    if (!code) {
      throw new Error(
        'ANIME_CHANNEL_INVITE / ANIME_CHANNEL_JID kosong. Isi invite channel di .env.'
      );
    }

    const sock = wa.getSock();
    if (!sock) throw new Error('WhatsApp belum terhubung');
    if (typeof sock.newsletterMetadata !== 'function') {
      throw new Error('Versi Baileys tidak mendukung channel. Gunakan @whiskeysockets/baileys 6.7.24+.');
    }

    const meta = await sock.newsletterMetadata('invite', code);
    const id = meta && (meta.id || (meta.result && meta.result.id));
    if (!id) throw new Error('Gagal resolve channel dari invite (metadata kosong)');

    this.channelJid = String(id).includes('@') ? String(id) : `${id}@newsletter`;
    this.channelName = String((meta && (meta.name || meta.thread_metadata?.name?.text)) || '');
    console.log(
      `[ANIME] Channel: ${this.channelName || '(tanpa nama)'} -> ${this.channelJid}`
    );
    return this.channelJid;
  }

  _isPosted(item, posted) {
    if (!item) return true;
    if (item.key && posted[item.key]) return true;
    const t = normalise(item.title);
    if (t && posted[`t:${t}`]) return true;
    return false;
  }

  async _translate(text) {
    if (!this.conf.translate || !text) return text;
    try {
      const out = await llm.askText(
        'Terjemahkan sinopsis anime berikut ke bahasa Indonesia yang natural dan ringkas. ' +
          'Balas hanya dengan terjemahannya, tanpa penjelasan.',
        text
      );
      const clean = String(out || '').trim();
      return clean || text;
    } catch (err) {
      console.warn('[ANIME] translate gagal:', err.message);
      return text;
    }
  }

  _caption(item, description) {
    const head = ['🎬 *INFO ANIME* 🎬', '', `*${item.title}*`];
    if (item.altTitle && normalise(item.altTitle) !== normalise(item.title)) {
      head.push(`_${item.altTitle}_`);
    }

    const meta = [
      valueLine('📺 Tipe', item.type),
      valueLine('🎞️ Episode', item.episodes ? String(item.episodes) : ''),
      valueLine('📅 Tahun', item.year ? String(item.year) : ''),
      valueLine('📡 Status', item.status),
      valueLine('⭐ Skor', item.score ? `${item.score}/100` : ''),
    ].filter(Boolean);

    const genres = Array.isArray(item.genres) && item.genres.length
      ? `🏷️ Genre: ${item.genres.slice(0, 6).join(', ')}`
      : '';

    const tail = [];
    if (item.extra) tail.push(item.extra);
    if (item.url) tail.push(`🔗 ${item.url}`);
    if (item.sourceLabel) tail.push(`📚 Sumber: ${item.sourceLabel}`);
    tail.push('', '*NimaCoRe - Latest Info*');

    let desc = String(description || '').trim();
    const build = (d) =>
      [...head, '', ...(meta.length ? [meta.join(' • ')] : []), genres, '', d]
        .filter((line) => line !== undefined && line !== null)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    let caption = `${build(desc)}\n\n${tail.join('\n')}`;
    if (caption.length > CAPTION_LIMIT && desc) {
      const excess = caption.length - CAPTION_LIMIT;
      desc = desc.slice(0, Math.max(120, desc.length - excess - 4)).trimEnd() + '…';
      caption = `${build(desc)}\n\n${tail.join('\n')}`;
    }
    return caption.slice(0, CAPTION_LIMIT);
  }

  async _sendWithFallback(sock, jid, item, caption) {
    let mode = '';

    if (this.conf.images !== false && item.image) {
      try {
        const got = await downloadBytes(item.image, MAX_IMAGE_BYTES, 20000);
        const mime = got.mime || 'image/jpeg';
        if (!/^image\//i.test(mime)) throw new Error(`bukan gambar (${mime})`);
        await sock.sendMessage(jid, { image: got.data, caption, mimetype: mime });
        mode = 'image';
      } catch (err) {
        console.warn('[ANIME] Gagal kirim gambar, fallback teks:', err.message);
      }
    }

    if (!mode) {
      try {
        await sock.sendMessage(jid, { text: caption });
        mode = 'text';
      } catch (err) {
        console.warn('[ANIME] Kirim teks gagal, coba raw newsletter:', err.message);
      }
    }

    if (!mode) {
      await this._sendRawText(sock, jid, caption);
      mode = 'raw-text';
    }

    return mode;
  }

  async _sendRawText(sock, jid, text) {
    const b = wa.getBaileys();
    if (!b || !b.proto || !b.proto.Message) {
      throw new Error('proto Baileys tidak tersedia untuk fallback raw');
    }
    const bytes = b.proto.Message.encode({ conversation: text }).finish();
    const id =
      typeof sock.generateMessageTag === 'function'
        ? sock.generateMessageTag()
        : `3EB0${Date.now().toString(16).toUpperCase()}`;
    const node = {
      tag: 'message',
      attrs: { to: jid, id, type: 'text' },
      content: [{ tag: 'plaintext', attrs: {}, content: bytes }],
    };
    await sock.query(node);
  }

  async postOne(options = {}) {
    const force = Boolean(options.force);
    const reason = options.reason || 'manual';

    if (!this.ready() && !force) {
      return { ok: false, skipped: true, message: 'WhatsApp belum terhubung' };
    }

    const sock = wa.getSock();
    if (!sock) {
      return { ok: false, skipped: true, message: 'WhatsApp belum terhubung' };
    }

    const state = this.store.getAnimeChannelState();
    const today = todayKey();
    const todayCount = state.day === today ? state.dayCount : 0;
    const maxPerDay = Math.max(1, Number(this.conf.maxPerDay) || 8);

    if (!force && todayCount >= maxPerDay) {
      return {
        ok: false,
        skipped: true,
        message: `batas harian tercapai (${todayCount}/${maxPerDay})`,
      };
    }

    const jid = await this.resolveChannel();

    const sources = feeds.normalizeSources(this.conf.sources);
    const perSource = Math.max(1, Math.min(20, Number(this.conf.perSource) || 8));
    const result = await feeds.fetchAll(sources, perSource);

    if (result.errors.length) {
      for (const e of result.errors) {
        console.warn(`[ANIME] Sumber ${e.source} gagal: ${e.error}`);
      }
    }

    const eligible = result.items.filter((it) => !this._isPosted(it, state.posted));
    if (eligible.length === 0) {
      this.lastError = '';
      return {
        ok: false,
        skipped: true,
        message: 'tidak ada anime baru yang belum pernah diposting',
        sourceErrors: result.errors,
      };
    }

    // Pilih acak dari beberapa kandidat teratas supaya feed tidak monoton.
    const pool = eligible.slice(0, 8);
    const item = randomPick(pool) || pool[0];

    const description = await this._translate(item.description);
    const caption = this._caption(item, description);

    this.lastAttemptAt = Date.now();
    this.lastResult = null;

    let mode;
    try {
      mode = await this._sendWithFallback(sock, jid, item, caption);
    } catch (err) {
      this.lastError = err && err.message ? err.message : String(err);
      this.lastResult = { ok: false, message: this.lastError, item: item.title, at: Date.now() };
      throw new Error(
        `${this.lastError}. Pastikan bot sudah menjadi admin channel dan ANIME_CHANNEL_INVITE benar.`
      );
    }

    const titleKey = normalise(item.title);
    const keys = [item.key];
    if (titleKey) keys.push(`t:${titleKey}`);
    await this.store.recordAnimeChannelPost(keys, today);

    this.lastError = '';
    this.lastResult = {
      ok: true,
      mode,
      reason,
      item: item.title,
      source: item.sourceLabel,
      channelJid: jid,
      at: Date.now(),
    };
    return { ok: true, mode, item, channelJid: jid, sourceErrors: result.errors };
  }

  status() {
    const state = this.store.getAnimeChannelState();
    const today = todayKey();
    return {
      enabled: this.enabled,
      running: !this.stopped,
      posting: this.running,
      channelJid: this.channelJid || channelJid(this.conf.jid),
      channelName: this.channelName,
      invite: inviteCode(this.conf.invite),
      intervalMin: Math.max(5, Number(this.conf.intervalMin) || 180),
      maxPerDay: Math.max(1, Number(this.conf.maxPerDay) || 8),
      todayCount: state.day === today ? state.dayCount : 0,
      lastPostAt: state.lastPostAt,
      postedCount: Object.keys(state.posted).length,
      sources: feeds.normalizeSources(this.conf.sources),
      images: this.conf.images !== false,
      translate: Boolean(this.conf.translate),
      lastAttemptAt: this.lastAttemptAt,
      lastError: this.lastError,
      lastResult: this.lastResult,
    };
  }

  formatStatus() {
    const s = this.status();
    const lines = [
      '📡 *Status Auto-Post Anime*',
      '',
      `• Aktif        : ${s.enabled ? 'ya' : 'tidak'}`,
      `• Scheduler    : ${s.running ? 'berjalan' : 'berhenti'}${s.posting ? ' (sedang posting)' : ''}`,
      `• Channel      : ${s.channelName || '(belum resolve)'} ${s.channelJid || ''}`.trim(),
      `• Interval     : ${s.intervalMin} menit`,
      `• Batas/hari   : ${s.todayCount}/${s.maxPerDay}`,
      `• Total posted : ${s.postedCount}`,
      `• Post terakhir: ${formatDate(s.lastPostAt)}`,
      `• Sumber       : ${s.sources.join(', ')}`,
      `• Gambar       : ${s.images ? 'ya' : 'tidak'} | Terjemah: ${s.translate ? 'ya' : 'tidak'}`,
    ];
    if (s.lastResult && s.lastResult.ok) {
      lines.push(`• Terakhir     : ${s.lastResult.item} (${s.lastResult.mode})`);
    }
    if (s.lastError) lines.push(`• Error        : ${s.lastError}`);
    if (s.invite) lines.push('', `Invite: https://whatsapp.com/channel/${s.invite}`);
    return lines.join('\n');
  }
}

module.exports = { AnimeChannelPoster };
