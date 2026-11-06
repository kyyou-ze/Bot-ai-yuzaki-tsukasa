'use strict';

const log = require('../logger');
const path = require('path');
const api = require('../animekita');
const llm = require('../llm');
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

// Genre yang bisa dipakai di `!anime roulette`. AniList memakai nama
// Inggris, jadi terima juga istilah Indonesia yang umum.
const ROULETTE_GENRE_MAP = {
  action: 'Action',
  aksi: 'Action',
  adventure: 'Adventure',
  petualangan: 'Adventure',
  comedy: 'Comedy',
  komedi: 'Comedy',
  drama: 'Drama',
  fantasy: 'Fantasy',
  fantasi: 'Fantasy',
  horror: 'Horror',
  horor: 'Horror',
  mecha: 'Mecha',
  music: 'Music',
  musik: 'Music',
  mystery: 'Mystery',
  misteri: 'Mystery',
  psychological: 'Psychological',
  romance: 'Romance',
  romansa: 'Romance',
  'sci-fi': 'Sci-Fi',
  scifi: 'Sci-Fi',
  'sci fi': 'Sci-Fi',
  'slice of life': 'Slice of Life',
  sliceoflife: 'Slice of Life',
  sports: 'Sports',
  olahraga: 'Sports',
  supernatural: 'Supernatural',
  thriller: 'Thriller',
  isekai: 'Fantasy',
};

const ROULETTE_GENRE_LIST = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

const ANILIST_ROULETTE_QUERY = `query ($page: Int, $perPage: Int, $genre: String) {
  Page(page: $page, perPage: $perPage) {
    media(
      type: ANIME
      genre: $genre
      sort: POPULARITY_DESC
      isAdult: false
      status_in: [FINISHED, RELEASING]
      averageScore_greater: 60
    ) {
      id
      title { romaji english }
      description(asHtml: false)
      genres
      averageScore
      episodes
      status
      seasonYear
      startDate { year month day }
      studios(isMain: true) { nodes { name } }
      siteUrl
    }
  }
}`;

function stripHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function resolveRouletteGenre(input) {
  const raw = String(input || '').trim();
  if (!raw) return { genre: '', label: '', unknown: false };
  const key = raw.toLowerCase();
  const mapped = ROULETTE_GENRE_MAP[key];
  if (mapped) return { genre: mapped, label: mapped, unknown: false };
  const known = ROULETTE_GENRE_LIST.find((g) => g.toLowerCase() === key);
  if (known) return { genre: known, label: known, unknown: false };
  return { genre: '', label: raw, unknown: true };
}

async function requestRoulette(genre) {
  const res = await fetchWithTimeout(
    'https://graphql.anilist.co',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'wa-tsukasa-bot/2.0',
      },
      body: JSON.stringify({
        query: ANILIST_ROULETTE_QUERY,
        variables: { page: 1, perPage: 30, genre: genre || null },
      }),
    },
    15000
  );
  if (!res.ok) throw new Error(`AniList http ${res.status}`);
  const json = await res.json();
  if (json && json.errors && json.errors.length) {
    throw new Error(json.errors[0].message || 'AniList error');
  }
  const list = json && json.data && json.data.Page && json.data.Page.media;
  return Array.isArray(list) ? list : [];
}

async function fetchRoulette(genre) {
  let list = [];
  if (genre) {
    try {
      list = await requestRoulette(genre);
    } catch (err) {
      log.warn('[ANIME] roulette genre gagal, fallback acak:', err.message);
    }
  }
  if (list.length === 0) list = await requestRoulette('');
  return list;
}

async function translateSynopsis(text) {
  const clean = stripHtml(text);
  if (!clean) return '';
  try {
    const out = await llm.askText(
      'Terjemahkan sinopsis anime berikut ke Bahasa Indonesia yang natural dan ringkas. Balas hanya dengan terjemahannya, tanpa markdown atau embel-embel.',
      clean.slice(0, 1500)
    );
    return String(out || '').trim() || clean;
  } catch {
    return clean;
  }
}

async function formatRoulette(item) {
  const title =
    (item.title && (item.title.english || item.title.romaji)) || 'Tanpa judul';
  const studios =
    item.studios && Array.isArray(item.studios.nodes)
      ? item.studios.nodes.map((n) => n && n.name).filter(Boolean)
      : [];
  const year =
    Number(item.seasonYear) || Number(item.startDate && item.startDate.year) || 0;
  const synopsis = await translateSynopsis(item.description || '');
  const extra = [
    `⭐ Skor: ${item.averageScore || '-'}`,
    `📺 Episode: ${item.episodes || '?'}`,
    `📅 Tahun: ${year || '-'}`,
    item.siteUrl ? `🔗 ${item.siteUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return buildAnimeInfo({
    title,
    studio: studios.join(', '),
    genres: item.genres || [],
    releaseDate: item.startDate || year,
    synopsis: synopsis || 'Belum ada sinopsis.',
    extra,
  });
}

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

function isPixeldrainLink(link) {
  return /pixeldrain\.com\/(?:api\/file|u)\//i.test(String(link || ''));
}

function isDirectVideoLink(link) {
  const raw = String(link || '').trim();
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host.includes('pixeldrain.com')) return false;
    // Hampir semua mirror AnimeKita memakai URL file langsung. Cek ekstensi
    // dulu, lalu host CDN yang memang menyajikan video.
    if (/\.(mp4|webm|mkv|mov|m4v)(?:$|[?#])/i.test(url.pathname + url.search)) return true;
    return /(^|\.)animeverse\.id$/i.test(host) || /(^|\.)desudrive\.com$/i.test(host);
  } catch {
    return false;
  }
}

function normalizePixeldrain(link) {
  const raw = String(link || '').trim();
  const m = raw.match(/pixeldrain\.com\/(?:api\/file|u)\/([A-Za-z0-9_-]+)/i);
  if (!m) return raw;
  return `https://pixeldrain.com/api/file/${m[1]}?download`;
}

function hasDownloadable(streams) {
  return (Array.isArray(streams) ? streams : []).some(
    (s) => isDirectVideoLink(s && s.link) || isPixeldrainLink(s && s.link)
  );
}

/**
 * Urutkan tautan yang bisa diunduh. Mirror langsung (mp4) didahulukan karena
 * tidak kena rate limit Pixeldrain, lalu Pixeldrain sebagai cadangan.
 */
function streamCandidates(streams) {
  const out = [];
  const seen = new Set();
  for (const stream of Array.isArray(streams) ? streams : []) {
    const link = String((stream && stream.link) || '').trim();
    if (!link) continue;
    const direct = isDirectVideoLink(link);
    const pixel = isPixeldrainLink(link);
    if (!direct && !pixel) continue;

    const normalized = pixel ? normalizePixeldrain(link) : link;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    out.push({
      link: normalized,
      reso: String((stream && stream.reso) || '').trim() || '?',
      score: direct ? 2 : 1,
    });
  }
  return out.sort((a, b) => b.score - a.score);
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

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function qualityNumber(reso) {
  const raw = String(reso || '').trim().toLowerCase();
  if (!raw) return NaN;
  if (raw === '4k' || raw === '2160p') return 2160;
  if (raw === '2k' || raw === '1440p') return 1440;
  const m = raw.match(/(\d{3,4})/);
  return m ? Number(m[1]) : NaN;
}

class AnimeFeature {
  constructor(reTrigger) {
    this.reTrigger = reTrigger;
    this.genreAllow = new Set(GENRES);
    this.genreString = GENRES.join(', ');
    // Antrean unduhan episode: batasi jumlah unduhan paralel agar RAM dan
    // bandwidth tidak habis saat banyak permintaan masuk bersamaan.
    this.downloads = new Map();
    this.downloadQueue = [];
    this.activeDownloads = 0;
    this.maxDownloads = Math.max(1, Number(process.env.ANIME_DL_CONCURRENCY) || 1);
  }

  downloadStatus() {
    return {
      active: [...this.downloads.values()]
        .filter((job) => job.startedAt)
        .map((job) => ({ slug: job.slug, chat: job.chat, startedAt: job.startedAt })),
      queued: this.downloadQueue.map((job) => ({ slug: job.slug, chat: job.chat })),
      max: this.maxDownloads,
    };
  }

  enqueueEpisode(chat, slug, ep, streams) {
    const key = `${chat}|${slug}`;
    if (this.downloads.has(key)) {
      return { queued: false, reason: 'episode ini sudah sedang diunduh/diantrekan' };
    }

    const job = {
      key,
      chat,
      slug,
      ep,
      streams,
      createdAt: Date.now(),
      startedAt: 0,
    };
    this.downloads.set(key, job);
    this.downloadQueue.push(job);
    const ahead = Math.max(0, this.downloadQueue.length - 1) + this.activeDownloads;
    this._pumpDownloads();

    if (ahead > 0) {
      wa.sendText(
        chat,
        `📥 Episode *${slug}* masuk antrean (posisi ${ahead + 1}). ` +
          'Bot akan mengirim otomatis setelah unduhan lain selesai.'
      ).catch(() => {});
    }
    return { queued: true, position: ahead + 1 };
  }

  _pumpDownloads() {
    while (this.activeDownloads < this.maxDownloads && this.downloadQueue.length) {
      const job = this.downloadQueue.shift();
      job.startedAt = Date.now();
      this.activeDownloads += 1;
      Promise.resolve()
        .then(() => this.deliverEpisode(job.chat, job.slug, job.ep, job.streams))
        .catch((err) => log.error('[ANIME] unduh episode error:', err.message))
        .finally(() => {
          this.activeDownloads = Math.max(0, this.activeDownloads - 1);
          this.downloads.delete(job.key);
          this._pumpDownloads();
        });
    }
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
      'anime episode <slug> [reso] - link streaming + unduh otomatis',
      'anime download <slug> [reso] - langsung unduh episode',
      'anime queue            - status antrean unduhan episode',
      'anime roulette [genre] - rekomendasi anime acak (contoh: anime roulette romance)',
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

        case 'queue':
        case 'antrean':
        case 'downloads':
        case 'unduhan': {
          const s = this.downloadStatus();
          const lines = [
            '*Antrean Unduhan Episode*',
            `Paralel : ${s.max}`,
            `Aktif   : ${s.active.length}`,
            `Menunggu: ${s.queued.length}`,
          ];
          for (const job of s.active) {
            lines.push(`• ⬇️ ${job.slug} (${job.chat})`);
          }
          for (let i = 0; i < s.queued.length; i++) {
            lines.push(`• ${i + 1}. ${s.queued[i].slug} (${s.queued[i].chat})`);
          }
          if (!s.active.length && !s.queued.length) lines.push('', 'Tidak ada unduhan berjalan.');
          await this.reply(sock, m, lines.join('\n'));
          return true;
        }

        case 'episode':
        case 'stream':
        case 'download':
        case 'unduh': {
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
          const note = hasDownloadable(streams)
            ? `\n${botName()} akan mencoba mengunduh episode ini otomatis (mp4/Pixeldrain).`
            : '';
          await this.reply(sock, m, formatEpisode(slug, ep, note));
          if (hasDownloadable(streams)) {
            this.enqueueEpisode(m.key.remoteJid, slug, ep, streams);
          }
          return true;
        }

        case 'roulette':
        case 'random':
        case 'acak':
        case 'rekomendasi':
        case 'recommend': {
          const rawGenre = rest.join(' ').trim();
          const resolved = resolveRouletteGenre(rawGenre);
          if (rawGenre && resolved.unknown) {
            await this.reply(
              sock,
              m,
              `Genre "${rawGenre}" tidak dikenal.\nPilih salah satu:\n${ROULETTE_GENRE_LIST.join(', ')}\n\nAtau kosongkan: anime roulette`
            );
            return true;
          }

          const list = await fetchRoulette(resolved.genre);
          const candidates = list.filter(
            (it) => it && it.title && (it.title.english || it.title.romaji)
          );
          const pool = candidates.length ? candidates : list;
          if (pool.length === 0) {
            await this.reply(sock, m, 'Tidak ada anime yang cocok. Coba genre lain ya.');
            return true;
          }

          const item = pool[Math.floor(Math.random() * pool.length)];
          await this.reply(sock, m, await formatRoulette(item));
          return true;
        }

        default:
          await this.reply(sock, m, this.helpMessage());
          return true;
      }
    } catch (err) {
      log.error('[ANIME] error:', err.message);
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

  async deliverEpisode(chat, slug, ep, streams) {
    const maxMb = Math.max(10, Number(process.env.ANIME_EP_MAX_MB) || 190);
    const maxBytes = maxMb * 1024 * 1024;
    const duration = Math.max(60, Number(process.env.ANIME_EP_TIMEOUT_SEC) || 240) * 1000;

    const qualities = [];
    const seenQuality = new Set();
    for (const raw of [...(Array.isArray(streams) ? streams.map((s) => s && s.reso) : []), ...(Array.isArray(ep.reso) ? ep.reso : [])]) {
      const reso = String(raw || '').trim();
      const num = qualityNumber(reso);
      if (!reso || !Number.isFinite(num) || seenQuality.has(reso)) continue;
      seenQuality.add(reso);
      qualities.push({ reso, num });
    }
    const requested = String((streams[0] && streams[0].reso) || qualities[0]?.reso || '720p');
    const requestedNum = qualityNumber(requested);
    // Coba resolusi yang diminta dulu, lalu turun ke resolusi lebih rendah
    // kalau file terlalu besar untuk dikirim lewat WhatsApp.
    const plan = qualities
      .filter((q) => !Number.isFinite(requestedNum) || q.num <= requestedNum)
      .sort((a, b) => b.num - a.num);
    if (!plan.some((q) => q.reso === requested)) plan.unshift({ reso: requested, num: requestedNum || 0 });

    const failures = [];
    for (const { reso } of plan) {
      let list = streams;
      if (reso !== requested) {
        try {
          const next = await api.episode(slug, reso);
          list = Array.isArray(next.stream) ? next.stream : [];
        } catch (err) {
          failures.push(`${reso}: ${err.message}`);
          continue;
        }
      }

      for (const candidate of streamCandidates(list)) {
        try {
          await this.downloadAndSendEpisode(chat, slug, reso, candidate, maxBytes, duration);
          return true;
        } catch (err) {
          failures.push(`${reso}: ${err.message}`);
          if (err && err.code === 'TOO_LARGE') break;
        }
      }
    }

    const reason = failures.length
      ? failures[failures.length - 1]
      : 'tidak ada tautan yang bisa diunduh';
    const best = streamCandidates(streams)[0];
    log.warn(`[ANIME] gagal unduh ${slug}: ${reason}`);
    await wa
      .sendText(
        chat,
        [
          `❌ Gagal mengunduh episode *${slug}* otomatis.`,
          `Alasan: ${reason}`,
          `Batas ukuran: ${maxMb} MB (atur lewat ANIME_EP_MAX_MB).`,
          best ? `Coba manual: ${best.link}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .catch(() => {});
    return false;
  }

  async downloadAndSendEpisode(chat, slug, reso, candidate, maxBytes, timeoutMs) {
    const link = candidate.link;
    const res = await fetchWithTimeout(
      link,
      {
        headers: {
          'User-Agent': 'wa-tsukasa-bot/1.0',
          Accept: 'video/*,application/octet-stream,*/*',
        },
        redirect: 'follow',
      },
      timeoutMs
    );
    if (res.status >= 300) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) {
      const err = new Error(`ukuran ${formatBytes(len)} melebihi batas ${formatBytes(maxBytes)}`);
      err.code = 'TOO_LARGE';
      throw err;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      const err = new Error(`ukuran ${formatBytes(buf.length)} melebihi batas ${formatBytes(maxBytes)}`);
      err.code = 'TOO_LARGE';
      throw err;
    }
    if (buf.length < 1024) throw new Error('file kosong/terlalu kecil');

    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (type && !/^(video\/|application\/octet-stream$|binary\/octet-stream$)/i.test(type)) {
      throw new Error(`bukan file video (${type})`);
    }

    let filename = filenameFor(link, res.headers.get('content-disposition'));
    if (!path.extname(filename)) filename += type === 'video/webm' ? '.webm' : '.mp4';
    filename = filename.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);

    await wa.sendDocument(
      chat,
      buf,
      type && type !== 'application/octet-stream' ? type : 'video/mp4',
      filename,
      `📺 ${slug} • ${reso} (${formatBytes(buf.length)})`
    );
    log.info(`[ANIME] episode terkirim: ${slug} ${reso} ${formatBytes(buf.length)}`);
    return true;
  }
}

module.exports = { AnimeFeature, formatSimpleList, formatDetail, formatEpisode, streamCandidates, isDirectVideoLink, normalizePixeldrain };
