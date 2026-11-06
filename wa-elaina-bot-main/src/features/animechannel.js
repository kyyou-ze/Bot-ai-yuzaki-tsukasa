'use strict';

const log = require('../logger');
const crypto = require('crypto');
const feeds = require('../animefeeds');
const animekita = require('../animekita');
const newsfeeds = require('../newsfeeds');
const llm = require('../llm');
const wa = require('../wa');
const { buildAnimeInfo, buildInfo } = require('../animeinfo');
const { downloadBytes, randomPick, normaliseTitle, canonicalTitle } = require('../util');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const CAPTION_LIMIT = 1000;

function hashKey(prefix, text) {
  const clean = normaliseTitle(text);
  if (!clean) return '';
  return `${prefix}:${crypto.createHash('sha1').update(clean).digest('hex')}`;
}

function titleKeys(title) {
  const out = [];
  const plain = normaliseTitle(title);
  const canonical = canonicalTitle(title);
  if (plain) out.push(`t:${plain}`);
  if (canonical) {
    out.push(`k:${canonical}`);
    out.push(hashKey('h', canonical));
  }
  return [...new Set(out)];
}

function yearNow() {
  return new Date().getFullYear();
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
      log.info('[ANIME] Auto-post channel dimatikan (ANIME_CHANNEL_ENABLED=false).');
      return;
    }
    if (!this.stopped || this.timer) return;

    this.stopped = false;
    const delay = Math.max(0, Number(this.conf.startDelaySec) || 0) * 1000;
    log.info(
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
        log.info(`[ANIME] Terkirim ke channel (${res.mode}): ${res.item.title}`);
      } else if (res.skipped) {
        log.info(`[ANIME] Skip: ${res.message}`);
      } else {
        log.warn(`[ANIME] Gagal: ${res.message}`);
      }
    } catch (err) {
      this.lastError = err && err.message ? err.message : String(err);
      log.error('[ANIME] Auto-post error:', this.lastError);
    } finally {
      this.running = false;
    }
  }

  async resolveChannel(force = false) {
    if (this.channelJid && !force) return this.channelJid;

    const direct = channelJid(this.conf.jid);
    if (direct) {
      this.channelJid = direct;
      log.info(`[ANIME] Memakai ANIME_CHANNEL_JID: ${direct}`);
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
    log.info(
      `[ANIME] Channel: ${this.channelName || '(tanpa nama)'} -> ${this.channelJid}`
    );
    return this.channelJid;
  }

  _dedupeKeys(item) {
    if (!item) return [];
    const keys = [];
    if (item.key) keys.push(String(item.key));
    keys.push(...titleKeys(item.title));
    if (item.altTitle) keys.push(...titleKeys(item.altTitle));
    // Fingerprint isi pesan (judul + ringkasan) untuk menangkap repost yang
    // judulnya sama persis walaupun key sumbernya berbeda.
    if (item.description) {
      keys.push(hashKey('m', `${canonicalTitle(item.title)}|${item.description}`));
    }
    return [...new Set(keys.filter(Boolean))];
  }

  _isPosted(item, posted) {
    if (!item) return true;
    const keys = this._dedupeKeys(item);
    if (keys.some((key) => Boolean(posted[key]))) return true;

    // Kompatibilitas dengan riwayat lama yang hanya menyimpan `t:` (judul
    // mentah). Bandingkan ulang secara kanonik supaya variasi season/tahun
    // tidak lolos sebagai post baru.
    const canonical = canonicalTitle(item.title);
    if (!canonical) return false;
    for (const key of Object.keys(posted || {})) {
      if (key.startsWith('k:') && key.slice(2) === canonical) return true;
      if (key.startsWith('t:') && canonicalTitle(key.slice(2)) === canonical) return true;
    }
    return false;
  }

  /**
   * Cek apakah sebuah judul sudah pernah diposting. Dipakai oleh perintah
   * `!animechannel check <judul>`.
   */
  checkTitle(title) {
    const keys = titleKeys(title);
    const hit = this.store.hasAnimeChannelPost(keys);
    if (hit.posted) return { ...hit, keys };

    const canonical = canonicalTitle(title);
    const posted = (this.store.getAnimeChannelState() || {}).posted || {};
    for (const [key, ts] of Object.entries(posted)) {
      if (key.startsWith('k:') && key.slice(2) === canonical) {
        return { posted: true, key, at: Number(ts) || 0, keys };
      }
      if (key.startsWith('t:') && canonicalTitle(key.slice(2)) === canonical) {
        return { posted: true, key, at: Number(ts) || 0, keys };
      }
    }
    return { ...hit, keys };
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
      log.warn('[ANIME] translate gagal:', err.message);
      return text;
    }
  }

  _parseJsonLoose(raw) {
    let out = String(raw || '').trim();
    if (out.startsWith('```')) {
      out = out.slice(3).trim();
      const nl = out.indexOf('\n');
      if (nl >= 0) out = out.slice(nl + 1).trim();
      const end = out.lastIndexOf('```');
      if (end >= 0) out = out.slice(0, end).trim();
    }
    const start = out.indexOf('{');
    const end = out.lastIndexOf('}');
    if (start >= 0 && end > start) out = out.slice(start, end + 1);
    try {
      return JSON.parse(out.trim());
    } catch {
      return null;
    }
  }

  /**
   * Buat satu info budaya/fakta Jejepangan lewat Gemini. Topik dirotasi dan
   * judul yang sudah pernah diposting dimasukkan ke daftar hindari.
   */
  async _generateJapanInfo(posted) {
    const topics = [
      'budaya dan tradisi Jepang',
      'fakta unik kehidupan di Jepang',
      'makanan khas dan kebiasaan makan orang Jepang',
      'festival dan perayaan musiman di Jepang',
      'etika sosial dan sopan santun orang Jepang',
      'teknologi dan transportasi di Jepang',
      'sejarah ringan Jepang',
      'dunia anime, manga, dan seiyuu',
      'kehidupan sehari-hari pelajar atau pekerja Jepang',
      'tempat menarik dan wisata di Jepang',
    ];
    const system = `Kamu penulis konten "Info Jejepangan" untuk channel WhatsApp.
Tulis informasi ringkas, menarik, dan faktual dalam Bahasa Indonesia tentang budaya Jepang, fakta unik, anime/manga, atau kehidupan sehari-hari di Jepang.
Jangan mengarang angka, tanggal, atau nama yang tidak kamu yakini.
Balas HANYA dengan JSON valid tanpa markdown:
{"judul":"...","kategori":"...","ringkasan":"...","fakta":["...","..."],"tag":["..."]}
Aturan:
- "judul" singkat dan spesifik (maks 90 karakter).
- "kategori" contoh: Budaya Jepang, Fakta Unik, Anime & Manga, Makanan, Tradisi, Teknologi.
- "ringkasan" 2-4 kalimat.
- "fakta" 2-4 poin menarik.
- "tag" maksimal 4 kata kunci.`;

    let avoid = Object.keys(posted || {})
      .filter((k) => k.startsWith('t:'))
      .slice(-25)
      .map((k) => k.slice(2))
      .join(', ');

    for (let attempt = 0; attempt < 3; attempt++) {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const prompt = [
        `Topik: ${topic}.`,
        `Tanggal: ${todayKey()}.`,
        avoid ? `Hindari membahas ulang topik/judul ini: ${avoid}.` : '',
        'Buat satu info baru yang belum pernah dibahas.',
      ]
        .filter(Boolean)
        .join('\n');

      const raw = await llm.askText(system, prompt);
      const parsed = this._parseJsonLoose(raw);
      if (!parsed || !parsed.judul || !parsed.ringkasan) continue;

      const title = String(parsed.judul).trim();
      if (!title) continue;
      const facts = (Array.isArray(parsed.fakta) ? parsed.fakta : [])
        .map((f) => String(f || '').trim())
        .filter(Boolean)
        .slice(0, 4);
      const tags = (Array.isArray(parsed.tag) ? parsed.tag : [])
        .map((t) => String(t || '').trim())
        .filter(Boolean)
        .slice(0, 4);

      const item = {
        key: hashKey('japaninfo', title),
        source: 'japaninfo',
        sourceLabel: 'Info Jejepangan',
        title,
        altTitle: '',
        description: String(parsed.ringkasan).trim(),
        image: '',
        url: '',
        genres: tags,
        score: 0,
        episodes: 0,
        status: 'Info',
        year: yearNow(),
        type: 'info',
        kind: String(parsed.kategori || 'Info Jejepangan').trim(),
        facts,
        studio: '',
        releaseDate: '',
        extra: '',
        slug: '',
      };

      if (!this._isPosted(item, posted)) return item;
      avoid = [avoid, title].filter(Boolean).join(', ');
    }
    return null;
  }

  async _enrich(item) {
    if (!item || item.source !== 'animekita' || !item.slug) return item;
    if (item.description && Array.isArray(item.genres) && item.genres.length) return item;

    try {
      const detail = await animekita.detail(item.slug);
      if (detail) {
        if (!item.description && detail.sinopsis) item.description = detail.sinopsis;
        if ((!Array.isArray(item.genres) || item.genres.length === 0) && detail.genre) {
          item.genres = Array.isArray(detail.genre)
            ? detail.genre
            : String(detail.genre)
                .split(',')
                .map((g) => g.trim())
                .filter(Boolean);
        }
        if (!item.releaseDate && detail.published) item.releaseDate = detail.published;
        if (!item.studio && detail.author) item.studio = detail.author;
      }
    } catch (err) {
      log.warn('[ANIME] gagal ambil detail AnimeKita:', err.message);
    }

    return item;
  }

  _caption(item, description) {
    if (item.type === 'news') {
      return newsfeeds
        .formatNewsCaption({ ...item, description })
        .slice(0, CAPTION_LIMIT);
    }
    const isInfo = item.type === 'info' || item.source === 'japaninfo';
    const options = isInfo
      ? {
          title: item.title,
          kind: item.kind || 'Info Jejepangan',
          headline: item.headline || '',
          genres: item.genres,
          releaseDate: item.releaseDate,
          summary: description,
          facts: item.facts,
          extra: item.extra,
        }
      : {
          title: item.title,
          studio: item.studio,
          genres: item.genres,
          releaseDate: item.releaseDate,
          synopsis: description,
        };

    const build = () => (isInfo ? buildInfo(options) : buildAnimeInfo(options));
    let caption = build();
    const desc = String(description || '').trim();
    if (caption.length > CAPTION_LIMIT && desc) {
      const excess = caption.length - CAPTION_LIMIT;
      const shortened = desc.slice(0, Math.max(120, desc.length - excess - 1)).trimEnd() + '…';
      if (isInfo) options.summary = shortened;
      else options.synopsis = shortened;
      caption = build();
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
        log.warn('[ANIME] Gagal kirim gambar, fallback teks:', err.message);
      }
    }

    if (!mode) {
      try {
        await sock.sendMessage(jid, { text: caption });
        mode = 'text';
      } catch (err) {
        log.warn('[ANIME] Kirim teks gagal, coba raw newsletter:', err.message);
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

  async _pickNews(posted) {
    const conf = (this.cfg && this.cfg.news) || {};
    if (conf.enabled === false) return { item: null, errors: [] };

    const { items, errors } = await newsfeeds.fetchAll(conf.sources, {
      perSource: Math.max(1, Math.min(20, Number(conf.perSource) || 8)),
      extraRss: Array.isArray(conf.xRss) ? conf.xRss : [],
    });

    for (const raw of items.slice(0, 24)) {
      const post = newsfeeds.toPostItem(raw);
      if (this._isPosted(post, posted)) continue;
      if (!raw.image) await newsfeeds.enrichItem(raw);
      if (!raw.image) continue;

      // enrichItem() hanya mengubah objek mentah, jadi bentuk ulang item post
      // agar gambar dan tautan X ikut terbawa.
      return { item: newsfeeds.toPostItem(raw), errors };
    }

    return { item: null, errors };
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
    const minYear = Number(this.conf.minYear) || yearNow();
    const maxYear = yearNow() + 1;
    const infoEvery = Math.max(1, Number(this.conf.infoEvery) || 3);
    const japanInfo = this.conf.japanInfo !== false;
    const newsEvery = Math.max(0, Number((this.cfg && this.cfg.news && this.cfg.news.every) || 0));

    // Selipkan berita bergambar dan info Jejepangan secara bergantian.
    // options.type bisa memaksa salah satu: anime | info | news.
    let wantNews =
      options.type === 'news' ||
      (options.type !== 'anime' &&
        options.type !== 'info' &&
        newsEvery > 0 &&
        (todayCount + 1) % newsEvery === 0);
    let wantInfo =
      !wantNews &&
      (options.type === 'info' ||
        (options.type !== 'anime' && japanInfo && (todayCount + 1) % infoEvery === 0));

    let item = null;
    let usedInfo = false;
    let usedNews = false;
    let result = { errors: [] };

    if (wantNews) {
      const picked = await this._pickNews(state.posted);
      item = picked.item;
      result = { errors: picked.errors };
      usedNews = Boolean(item);
      if (!item && options.type === 'news') {
        this.lastError = '';
        return {
          ok: false,
          skipped: true,
          message: 'tidak ada berita bergambar yang belum pernah diposting',
          sourceErrors: picked.errors,
        };
      }
      if (picked.errors.length) {
        for (const e of picked.errors) {
          log.warn(`[ANIME] Sumber berita ${e.source} gagal: ${e.error}`);
        }
      }
    }

    if (!item && wantInfo) {
      item = await this._generateJapanInfo(state.posted);
      usedInfo = Boolean(item);
      if (!item && options.type === 'info') {
        this.lastError = '';
        return {
          ok: false,
          skipped: true,
          message: 'gagal membuat info Jejepangan (Gemini tidak merespons/JSON tidak valid)',
        };
      }
    }

    if (!item) {
      result = await feeds.fetchAll(sources, perSource, { minYear, maxYear });
      if (result.errors.length) {
        for (const e of result.errors) {
          log.warn(`[ANIME] Sumber ${e.source} gagal: ${e.error}`);
        }
      }

      let eligible = result.items.filter((it) => !this._isPosted(it, state.posted));

      // Kalau tidak ada anime baru, isi slot dengan info Jejepangan.
      if (eligible.length === 0 && japanInfo && options.type !== 'anime') {
        item = await this._generateJapanInfo(state.posted);
        usedInfo = Boolean(item);
      }

      if (!item && eligible.length === 0) {
        this.lastError = '';
        return {
          ok: false,
          skipped: true,
          message: `tidak ada anime baru >= ${minYear} yang belum pernah diposting`,
          sourceErrors: result.errors,
        };
      }

      if (!item) {
        // Pilih acak dari beberapa kandidat teratas supaya feed tidak monoton.
        const pool = eligible.slice(0, 8);
        item = randomPick(pool) || pool[0];
      }
    }

    if (!usedInfo) await this._enrich(item);
    // Info Jejepangan sudah dibuat dalam Bahasa Indonesia, tidak perlu diterjemahkan.
    const description = usedInfo ? item.description : await this._translate(item.description);
    const caption = this._caption(item, description);

    this.lastAttemptAt = Date.now();
    this.lastResult = null;

    // Cek apakah isi pesan sudah pernah dikirim (repost identik).
    const captionHash = hashKey('m', caption);
    if (captionHash && state.posted[captionHash]) {
      this.lastError = '';
      return {
        ok: false,
        skipped: true,
        message: `pesan identik sudah pernah diposting: ${item.title}`,
        sourceErrors: result.errors,
      };
    }

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

    const keys = this._dedupeKeys(item);
    if (captionHash) keys.push(captionHash);
    await this.store.recordAnimeChannelPost(keys, today, {
      maxAgeDays: Number(this.conf.dedupeDays) || 0,
      maxEntries: Number(this.conf.dedupeMax) || 5000,
    });

    this.lastError = '';
    this.lastResult = {
      ok: true,
      mode,
      reason,
      type: usedNews ? 'news' : usedInfo ? 'info' : 'anime',
      item: item.title,
      source: item.sourceLabel,
      channelJid: jid,
      at: Date.now(),
    };
    return {
      ok: true,
      mode,
      item,
      type: usedNews ? 'news' : usedInfo ? 'info' : 'anime',
      channelJid: jid,
      sourceErrors: result.errors,
    };
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
      minYear: Number(this.conf.minYear) || yearNow(),
      maxYear: yearNow() + 1,
      dedupeDays: Number(this.conf.dedupeDays) || 0,
      dedupeMax: Math.max(100, Number(this.conf.dedupeMax) || 5000),
      japanInfo: this.conf.japanInfo !== false,
      infoEvery: Math.max(1, Number(this.conf.infoEvery) || 3),
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
      `• Min tahun    : ${s.minYear} (maks ${s.maxYear})`,
      `• Info Jepang  : ${s.japanInfo ? `ya, tiap ${s.infoEvery} post` : 'tidak'}`,
      `• Dedupe       : ${s.dedupeDays > 0 ? `${s.dedupeDays} hari` : 'permanen'} (maks ${s.dedupeMax})`,
      `• Gambar       : ${s.images ? 'ya' : 'tidak'} | Terjemah: ${s.translate ? 'ya' : 'tidak'}`,
    ];
    if (s.lastResult && s.lastResult.ok) {
      const kind = s.lastResult.type === 'info' ? 'info' : 'anime';
      lines.push(`• Terakhir     : ${s.lastResult.item} (${kind}/${s.lastResult.mode})`);
    }
    if (s.lastError) lines.push(`• Error        : ${s.lastError}`);
    if (s.invite) lines.push('', `Invite: https://whatsapp.com/channel/${s.invite}`);
    return lines.join('\n');
  }
}

module.exports = { AnimeChannelPoster };
