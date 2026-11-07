'use strict';

const log = require('../logger');
const api = require('../animekita');
const llm = require('../llm');
const wa = require('../wa');
const { buildInfo } = require('../animeinfo');

const INFO_SYSTEM = `Kamu adalah asisten info serba bisa. Pengguna bisa meminta info tentang apa saja: anime, film, drama Jepang/Korea, budaya Jejepangan, fakta unik, hal absurd, atau topik lain.

Berikan informasi yang ringkas, jelas, dan faktual dalam Bahasa Indonesia. Jika topiknya tidak kamu ketahui dengan pasti, katakan dengan jujur bahwa informasinya terbatas.

Balas HANYA dengan JSON valid, tanpa markdown dan tanpa penjelasan tambahan, dengan format:
{"judul":"...","kategori":"...","studio":"...","genre":["..."],"tanggal_rilis":"YYYY-MM-DD","ringkasan":"...","fakta":["...","..."]}

Aturan:
- Semua isi teks wajib Bahasa Indonesia.
- "judul" diisi nama karya/topik yang diminta.
- "kategori" contohnya: Anime, Film, Drama Jepang, Drama Korea, Manga, Budaya Jepang, Fakta Unik, Info Absurd, Teknologi, Lainnya.
- "studio" hanya untuk karya film/anime/drama; kosongkan jika tidak relevan atau tidak yakin.
- "genre" maksimal 4 item; kosongkan jika tidak relevan.
- "tanggal_rilis" format YYYY-MM-DD jika relevan dan diketahui; kosongkan jika tidak.
- "ringkasan" 2-5 kalimat. Untuk karya, isi sinopsis tanpa spoiler. Untuk topik non-karya, isi penjelasan inti.
- "fakta" berisi 2-4 fakta menarik/poin penting; boleh kosong jika tidak ada.
- Jangan mengarang detail spesifik (tanggal, angka, nama) yang tidak kamu yakini.`;

function normalizeJson(text) {
  let out = String(text || '').trim();
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
  return out.trim();
}

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function firstSearchHit(query, blocks) {
  const wanted = norm(query);
  if (!wanted) return null;

  const all = [];
  for (const block of blocks || []) {
    if (block && Array.isArray(block.result)) all.push(...block.result);
  }

  for (const item of all) {
    const title = norm(item && (item.judul || item.anime_name));
    if (!title) continue;
    if (title === wanted) return item;
    if (title.includes(wanted) || wanted.includes(title)) {
      const ratio = Math.min(title.length, wanted.length) / Math.max(title.length, wanted.length);
      if (ratio >= 0.6) return item;
    }
  }
  return null;
}

function mediaStyle(kind) {
  const k = String(kind || '').toLowerCase();
  if (k.includes('anime')) {
    return { verb: 'dikerjakan oleh', studioLabel: 'studio', summaryLabel: 'Sinopsis' };
  }
  if (k.includes('film') || k.includes('drama') || k.includes('manga')) {
    return { verb: 'diproduksi oleh', studioLabel: 'rumah produksi', summaryLabel: 'Sinopsis' };
  }
  return { summaryLabel: 'Ringkasan' };
}

class InfoFeature {
  constructor(reTrigger) {
    this.reTrigger = reTrigger;
  }

  extractCommand(text) {
    const t = String(text || '').trim();
    if (!t) return null;

    if (t.startsWith('!')) {
      const parts = t.slice(1).trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return null;
      if (parts[0].toLowerCase() !== 'info') return null;
      return parts.slice(1);
    }

    if (!this.reTrigger.test(t)) return null;
    const clean = t.replace(this.reTrigger, ' ').trim();
    if (!clean) return null;
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts[0].toLowerCase() !== 'info') return null;
    return parts.slice(1);
  }

  async fromAnimeKita(query) {
    const blocks = await api.search(query);
    const hit = firstSearchHit(query, blocks);
    if (!hit || !hit.url) return null;

    const detail = await api.detail(hit.url);
    if (!detail) return null;

    return {
      title: detail.judul || hit.judul || query,
      kind: 'Anime',
      verb: 'dikerjakan oleh',
      studioLabel: 'studio',
      summaryLabel: 'Sinopsis',
      studio: detail.author || '',
      genres: detail.genre || [],
      releaseDate: detail.published || '',
      synopsis: detail.sinopsis || '',
    };
  }

  async fromLlm(query) {
    const raw = await llm.askText(INFO_SYSTEM, query);
    if (!raw) return null;

    let parsed;
    try {
      parsed = JSON.parse(normalizeJson(raw));
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;

    const kind = parsed.kategori || 'Info';
    return {
      title: parsed.judul || query,
      kind,
      ...mediaStyle(kind),
      studio: parsed.studio || '',
      genres: parsed.genre || [],
      releaseDate: parsed.tanggal_rilis || '',
      synopsis: parsed.ringkasan || parsed.sinopsis || '',
      facts: parsed.fakta || [],
    };
  }

  async handle(sock, m, text) {
    const args = this.extractCommand(text);
    if (args === null) return false;

    if (args.length === 0) {
      await this.reply(sock, m, 'Format: info <topik>. Contoh: info Wound & Bandage');
      return true;
    }

    const query = args.join(' ');
    try {
      let data = null;
      try {
        data = await this.fromAnimeKita(query);
      } catch (err) {
        log.warn('[INFO] AnimeKita gagal:', err.message);
      }
      if (!data) data = await this.fromLlm(query);

      if (!data) {
        await this.reply(
          sock,
          m,
          `Maaf, info untuk "${query}" belum bisa diambil. Coba lagi sebentar ya.`
        );
        return true;
      }

      await this.reply(sock, m, buildInfo(data));
    } catch (err) {
      log.error('[INFO] error:', err.message);
      await this.reply(sock, m, `Gagal ambil info "${query}": ${err.message}`);
    }
    return true;
  }

  reply(sock, m, msg) {
    return wa.sendText(m.key.remoteJid, msg, m).catch(() => {});
  }
}

module.exports = { InfoFeature };
