'use strict';

const path = require('path');
const api = require('../animekita');
const wa = require('../wa');
const { buildAnimeInfo } = require('../animeinfo');
const { fetchWithTimeout } = require('../util');

const MAX_SIMPLE_ITEMS = 10;
const MAX_SCHEDULE_ITEMS = 8;
const MAX_CHAPTER_ITEMS = 6;
const MAX_STREAM_ITEMS = 6;

const GENRES = [
  'action', 'adventure', 'comedy', 'demons', 'drama', 'ecchi', 'fantasy', 'game',
  'harem', 'historical', 'horror', 'josei', 'magic', 'martial-arts', 'mecha', 'military',
  'music', 'mystery', 'psychological', 'parody', 'police', 'romance', 'samurai', 'school',
  'sci-fi', 'seinen', 'shoujo', 'shoujo-ai', 'shounen', 'slice-of-life', 'sports', 'space',
  'super-power', 'supernatural', 'thriller', 'vampire', 'yaoi', 'yuri',
];

function fallback(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function botName() {
  return String(process.env.BOT_NAME || '').trim() || 'Bot';
}

function parsePage(args) {
  if (!args || args.length === 0) return 1;
  const p = parseInt(args[0], 10);
  return Number.isFinite(p) && p >= 1 ? p : 1;
}

function hasPixeldrain(streams) {
  return streams.some((s) => isPixeldrainLink(s && s.link));
}

function isPixeldrainLink(link) {
  return String(link || '').toLowerCase().includes('pixeldrain.com/api/file/');
}

function formatSimpleList(title, entries) {
  if (!entries || entries.length === 0) return `${title} kosong.`;
  const max = Math.min(entries.length, MAX_SIMPLE_ITEMS);
  const lines = [`*${title}*`];
  for (let i = 0; i < max; i++) {
    const e = entries[i] || {};
    lines.push(`${i + 1}. ${fallback(e.judul, e.anime_name, 'Tanpa judul')}`);
    const slug = fallback(e.url, e.link);
    if (slug) lines.push(`   slug: ${slug}`);
    const update = fallback(e.lastup, e.release_date, e.episode);
    if (update) lines.push(`   info: ${update}`);
    if (e.cover && i < 4) lines.push(`   cover: ${e.cover}`);
  }
  if (entries.length > max) lines.push(`... ${entries.length - max} entri lainnya.`);
  lines.push('');
  lines.push('Detail: anime detail <slug>');
  return lines.join('\n');
}

function formatSchedule(day, days) {
  if (!days || days.length === 0) return 'Jadwal kosong.';
  const wantDay = String(day || '').trim().toLowerCase();
  const lines = ['*Jadwal Rilis*'];
  let found = false;
  for (const d of days) {
    if (wantDay && String(d.day || '').toLowerCase() !== wantDay) continue;
    found = true;
    lines.push(`${d.day || ''}:`);
    const list = Array.isArray(d.animeList) ? d.animeList : [];
    const limit = Math.min(list.length, MAX_SCHEDULE_ITEMS);
    for (let i = 0; i < limit; i++) {
      const item = list[i] || {};
      lines.push(`- ${fallback(item.anime_name, 'Tanpa judul')} (slug: ${fallback(item.link)})`);
    }
    if (list.length > limit) lines.push(`  ... ${list.length - limit} lainnya`);
    lines.push('');
  }
  if (!found) return `Tidak ada jadwal untuk "${day}".`;
  lines.push('Ambil info lengkap: anime detail <slug>');
  return lines.join('\n').trim();
}

function formatAlphabetList(letter, data) {
  const entries = (data && data[letter]) || [];
  if (entries.length === 0) {
    if (letter === '#') return 'Tidak ada daftar untuk simbol #.';
    return `Tidak ada anime yang diawali huruf ${letter}.`;
  }
  const max = Math.min(entries.length, MAX_SIMPLE_ITEMS);
  const lines = [`*Daftar huruf ${letter}*`];
  for (let i = 0; i < max; i++) {
    const e = entries[i] || {};
    lines.push(`${i + 1}. ${fallback(e.judul, 'Tanpa judul')}`);
    lines.push(`   slug: ${fallback(e.url)}`);
  }
  if (entries.length > max) lines.push(`... ${entries.length - max} entri lainnya.`);
  lines.push('Gunakan anime detail <slug> untuk info.');
  return lines.join('\n');
}

function formatSearchResults(query, results) {
  const all = [];
  for (const block of results || []) {
    if (block && Array.isArray(block.result)) all.push(...block.result);
  }
  if (all.length === 0) return `Tidak ada hasil untuk "${query}".`;
  const max = Math.min(all.length, MAX_SIMPLE_ITEMS);
  const lines = [`*Hasil pencarian "${query}"*`];
  for (let i = 0; i < max; i++) {
    const e = all[i] || {};
    lines.push(`${i + 1}. ${fallback(e.judul, 'Tanpa judul')}`);
    if (e.url) lines.push(`   slug: ${e.url}`);
  }
  if (all.length > max) lines.push(`... ${all.length - max} hasil lainnya.`);
  lines.push('Detail: anime detail <slug>');
  return lines.join('\n');
}

function formatDetail(d) {
  if (!d) return 'Data detail kosong.';

  const extra = ['Chapter terbaru:'];
  const chapters = Array.isArray(d.chapter) ? d.chapter : [];
  if (chapters.length === 0) {
    extra.push('- Belum ada data.');
  } else {
    const limit = Math.min(chapters.length, MAX_CHAPTER_ITEMS);
    for (let i = 0; i < limit; i++) {
      const ch = chapters[i] || {};
      extra.push(`- ${fallback(ch.ch, 'ep')} (${fallback(ch.date, '?')}) -> ${fallback(ch.url)}`);
    }
    if (chapters.length > limit) {
      extra.push(`... ${chapters.length - limit} episode lainnya di API.`);
    }
  }
  extra.push('');
  extra.push('Ambil stream: anime episode <slug> [reso]');

  return buildAnimeInfo({
    title: d.judul,
    studio: d.author,
    genres: d.genre,
    releaseDate: d.published,
    synopsis: d.sinopsis,
    extra: extra.join('\n'),
  });
}

function formatEpisode(slug, ep, note) {
  if (!ep) return `Tidak ada data untuk ${slug}.`;
  const lines = [`*Episode ${slug}*`];
  if (Array.isArray(ep.reso) && ep.reso.length) {
    lines.push(`Resolusi tersedia: ${ep.reso.join(', ')}`);
  }
  lines.push('Link streaming:');
  const streams = Array.isArray(ep.stream) ? ep.stream : [];
  if (streams.length === 0) {
    lines.push('- Belum ada tautan.');
  } else {
    const limit = Math.min(streams.length, MAX_STREAM_ITEMS);
    for (let i = 0; i < limit; i++) {
      const s = streams[i] || {};
      lines.push(`- ${fallback(s.reso, '?')} -> ${fallback(s.link)}`);
    }
    if (streams.length > limit) {
      lines.push(`... ${streams.length - limit} link lainnya di API.`);
    }
  }
  if (String(note || '').trim()) lines.push(String(note).trim());
  return lines.join('\n');
}

function extractDispositionFilename(header) {
  if (!header) return '';
  const star = header.match(/filename\*\s*=\s*([^']*)''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[2].trim());
    } catch {
      /* ignore */
    }
  }
  const plain = header.match(/filename\s*=\s*"([^"]+)"/i) || header.match(/filename\s*=\s*([^;]+)/i);
  return plain ? plain[1].trim() : '';
}

function filenameFor(link, disposition) {
  const fromHeader = extractDispositionFilename(disposition);
  if (fromHeader) return fromHeader;
  try {
    const base = path.basename(new URL(link).pathname).trim();
    if (base) return base;
  } catch {
    /* ignore */
  }
  return 'pixeldrain.bin';
}

class AnimeFeature {
  constructor(reTrigger) {
    this.reTrigger = reTrigger;
    this.genreAllow = new Set(GENRES);
    this.genreString = GENRES.join(', ');
  }

  extractCommand(text) {
    const t = String(text || '').trim();
    if (!t) return null;

    if (t.startsWith('!')) {
      const parts = t.slice(1).trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return null;
      if (parts[0].toLowerCase() !== 'anime') return null;
      return parts.slice(1);
    }

    if (!this.reTrigger.test(t)) return null;
    const clean = t.replace(this.reTrigger, ' ').trim();
    if (!clean) return null;
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts[0].toLowerCase() !== 'anime') return null;
    return parts.slice(1);
  }

  helpMessage() {
    return [
      '*Menu AnimeKita*',
      'anime new [page]       - rilisan baru',
      'anime movie            - daftar movie',
      'anime schedule [hari]  - jadwal rilis (contoh: anime schedule selasa)',
      'anime list <huruf>     - daftar anime per awal huruf',
      'anime genre <nama> [page] - daftar berdasarkan genre',
      'anime search <keyword> - cari anime',
      'anime detail <slug>    - info detail + daftar chapter',
      'anime episode <slug> [reso] - link streaming per episode',
      '',
      'Gunakan slug/link dari hasil detail untuk mengambil episode.',
    ].join('\n');
  }

  reply(sock, m, msg) {
    return wa.sendText(m.key.remoteJid, msg, m).catch(() => {});
  }

  async handle(sock, m, text) {
    const args = this.extractCommand(text);
    if (args === null) return false;

    if (args.length === 0) {
      await this.reply(sock, m, this.helpMessage());
      return true;
    }

    const sub = String(args[0] || '').toLowerCase();
    const rest = args.slice(1);

    try {
      switch (sub) {
        case 'help':
        case 'menu':
          await this.reply(sock, m, this.helpMessage());
          return true;

        case 'new':
        case 'baru':
        case 'latest': {
          const page = parsePage(rest);
          const data = await api.newUploads(page);
          await this.reply(sock, m, formatSimpleList(`Rilisan terbaru (page ${page})`, data));
          return true;
        }

        case 'movie':
        case 'movies': {
          const data = await api.movies();
          await this.reply(sock, m, formatSimpleList('Daftar movie', data));
          return true;
        }

        case 'schedule':
        case 'jadwal': {
          const day = rest[0] || '';
          const data = await api.schedule();
          await this.reply(sock, m, formatSchedule(day, data));
          return true;
        }

        case 'list': {
          if (rest.length === 0) {
            await this.reply(sock, m, 'Format: anime list <huruf>. Contoh: anime list a');
            return true;
          }
          const letter = String(rest[0] || '').toUpperCase();
          const data = await api.animeList();
          await this.reply(sock, m, formatAlphabetList(letter, data));
          return true;
        }

        case 'genre': {
          if (rest.length === 0) {
            await this.reply(
              sock,
              m,
              'Format: anime genre <nama> [page].\nGenre tersedia: ' + this.genreString
            );
            return true;
          }
          const genre = String(rest[0] || '').toLowerCase();
          if (!this.genreAllow.has(genre)) {
            await this.reply(
              sock,
              m,
              'Genre tidak dikenal. Pilih salah satu dari:\n' + this.genreString
            );
            return true;
          }
          const page = rest.length > 1 ? parsePage(rest.slice(1)) : 1;
          const data = await api.genre(genre, page);
          await this.reply(sock, m, formatSimpleList(`Genre ${genre} (page ${page})`, data));
          return true;
        }

        case 'search':
        case 'cari':
        case 'find': {
          if (rest.length === 0) {
            await this.reply(sock, m, 'Format: anime search <kata kunci>');
            return true;
          }
          const query = rest.join(' ');
          const results = await api.search(query);
          await this.reply(sock, m, formatSearchResults(query, results));
          return true;
        }

        case 'detail': {
          if (rest.length === 0) {
            await this.reply(sock, m, 'Format: anime detail <slug>');
            return true;
          }
          const slug = rest[0];
          const detail = await api.detail(slug);
          await this.reply(sock, m, formatDetail(detail));
          return true;
        }

        case 'episode':
        case 'stream': {
          if (rest.length === 0) {
            await this.reply(
              sock,
              m,
              'Format: anime episode <slug> [reso]. Gunakan slug dari daftar chapter detail.'
            );
            return true;
          }
          const slug = rest[0];
          const reso = rest.length > 1 ? rest[1] : '720p';
          const ep = await api.episode(slug, reso);
          const streams = Array.isArray(ep.stream) ? ep.stream : [];
          const note = hasPixeldrain(streams)
            ? `\n${botName()} akan mencoba unduh tautan Pixeldrain otomatis.`
            : '';
          await this.reply(sock, m, formatEpisode(slug, ep, note));
          if (hasPixeldrain(streams)) {
            setImmediate(() => {
              this.deliverPixeldrain(m.key.remoteJid, streams).catch((err) => {
                console.error('[ANIME] pixeldrain error:', err.message);
              });
            });
          }
          return true;
        }

        default:
          await this.reply(sock, m, this.helpMessage());
          return true;
      }
    } catch (err) {
      console.error('[ANIME] error:', err.message);
      const label =
        sub === 'new' || sub === 'baru' || sub === 'latest'
          ? 'data rilis terbaru'
          : sub === 'movie' || sub === 'movies'
            ? 'daftar movie'
            : sub === 'schedule' || sub === 'jadwal'
              ? 'jadwal'
              : sub === 'list'
                ? 'daftar lengkap'
                : sub === 'genre'
                  ? `daftar genre ${rest[0] || ''}`
                  : sub === 'search' || sub === 'cari' || sub === 'find'
                    ? `hasil pencarian "${rest.join(' ')}"`
                    : sub === 'detail'
                      ? `detail untuk ${rest[0] || ''}`
                      : sub === 'episode' || sub === 'stream'
                        ? `stream untuk ${rest[0] || ''}`
                        : 'data anime';
      await this.reply(sock, m, `Gagal ambil ${label}: ${err.message}`);
      return true;
    }
  }

  async deliverPixeldrain(chat, streams) {
    const MAX_BYTES = 200 * 1024 * 1024;
    for (const st of streams) {
      if (!isPixeldrainLink(st && st.link)) continue;
      try {
        const res = await fetchWithTimeout(
          st.link,
          {
            headers: { 'User-Agent': 'wa-tsukasa-bot/1.0' },
            redirect: 'follow',
          },
          120000
        );
        if (res.status >= 300) throw new Error(`http ${res.status} ${res.statusText}`);
        const len = Number(res.headers.get('content-length') || 0);
        if (len > MAX_BYTES) throw new Error(`file terlalu besar (${len} byte)`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_BYTES) throw new Error(`file terlalu besar (${buf.length} byte)`);
        const filename = filenameFor(st.link, res.headers.get('content-disposition'));
        const mime = (res.headers.get('content-type') || '').split(';')[0].trim() ||
          'application/octet-stream';
        const caption = `Pixeldrain ${fallback(st.reso, filename)}`.trim();
        await wa.sendDocument(chat, buf, mime, filename, caption);
      } catch (err) {
        console.error('[ANIME] pixeldrain gagal:', err.message);
        await wa
          .sendText(chat, `Gagal unduh Pixeldrain ${fallback(st.reso, st.link)}: ${err.message}`)
          .catch(() => {});
      }
    }
  }
}

module.exports = { AnimeFeature, formatSimpleList, formatDetail, formatEpisode };
