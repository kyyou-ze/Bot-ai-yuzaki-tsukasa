'use strict';

const animekita = require('./animekita');
const { fetchWithTimeout } = require('./util');

const ALL_SOURCES = ['anilist', 'kitsu', 'animekita', 'jikan'];
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DART_UA = 'Dart/3.1 (dart:io)';

const ANILIST_QUERY = `query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large }
      siteUrl
      genres
      averageScore
      episodes
      status
      seasonYear
      format
      startDate { year month day }
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode { episode airingAt }
    }
  }
}`;

function cleanText(input, max = 0) {
  let s = String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (max > 0 && s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
  return s;
}

function normalizeScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 10 ? Math.round(n * 10) : Math.round(n);
}

function idStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  if (!s) return '';
  if (
    s.includes('releasing') ||
    s.includes('current') ||
    s.includes('airing') ||
    s.includes('ongoing')
  ) {
    return 'Sedang Tayang';
  }
  if (s.includes('finished') || s.includes('complete')) return 'Selesai';
  if (s.includes('not yet') || s.includes('upcoming') || s.includes('tba')) return 'Belum Tayang';
  if (s.includes('hiatus') || s.includes('delayed') || s.includes('cancel')) return 'Ditunda';
  return raw;
}

function yearOf(value) {
  const m = String(value || '').match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : 0;
}

function titleKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSources(raw) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = list.filter((s) => ALL_SOURCES.includes(s));
  return valid.length > 0 ? [...new Set(valid)] : ALL_SOURCES.slice();
}

async function fetchAniList(limit = 8) {
  const res = await fetchWithTimeout(
    'https://graphql.anilist.co',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { page: 1, perPage: Math.max(1, Math.min(20, limit)) },
      }),
    },
    15000
  );

  if (!res.ok) throw new Error(`AniList http ${res.status}`);
  const json = await res.json();
  const list = json && json.data && json.data.Page && json.data.Page.media;
  if (!Array.isArray(list)) throw new Error('AniList response tidak valid');

  return list
    .map((it) => {
      if (!it || !it.id) return null;
      const titleParts = it.title || {};
      const title = cleanText(titleParts.english || titleParts.romaji || titleParts.native, 160);
      const altTitle =
        titleParts.english && titleParts.romaji && titleParts.english !== titleParts.romaji
          ? cleanText(titleParts.romaji, 160)
          : '';
      const next = it.nextAiringEpisode;
      const extra = next
        ? `Episode ${next.episode} berikutnya: ${new Date(next.airingAt * 1000).toLocaleDateString(
            'id-ID',
            { day: 'numeric', month: 'long', year: 'numeric' }
          )}`
        : '';
      const studio = (it.studios && Array.isArray(it.studios.nodes) ? it.studios.nodes : [])
        .map((s) => s && s.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ');
      return {
        key: `anilist:${it.id}`,
        source: 'anilist',
        sourceLabel: 'AniList',
        title,
        altTitle,
        description: cleanText(it.description, 1400),
        image: (it.coverImage && (it.coverImage.extraLarge || it.coverImage.large)) || '',
        url: it.siteUrl || `https://anilist.co/anime/${it.id}`,
        genres: Array.isArray(it.genres) ? it.genres.map(String).slice(0, 8) : [],
        score: normalizeScore(it.averageScore),
        episodes: Number(it.episodes) || 0,
        status: idStatus(it.status),
        year: Number(it.seasonYear) || 0,
        type: cleanText(it.format, 30),
        studio,
        releaseDate: it.startDate || '',
        extra,
        slug: '',
      };
    })
    .filter((it) => it && it.title);
}

async function fetchKitsu(limit = 8) {
  const n = Math.max(1, Math.min(20, limit));
  const url =
    'https://kitsu.io/api/edge/anime?filter[status]=current' +
    `&page[limit]=${n}&sort=-averageRating`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        'User-Agent': BROWSER_UA,
      },
    },
    15000
  );

  if (!res.ok) throw new Error(`Kitsu http ${res.status}`);
  const json = await res.json();
  const list = json && json.data;
  if (!Array.isArray(list)) throw new Error('Kitsu response tidak valid');

  return list
    .map((it) => {
      const a = (it && it.attributes) || {};
      const titles = a.titles || {};
      const title = cleanText(titles.en || titles.en_jp || a.canonicalTitle, 160);
      if (!title) return null;
      const altTitle = cleanText(titles.ja_jp || a.canonicalTitle, 160);
      const poster = a.posterImage || {};
      const studio = (a.productionCompanies || [])
        .map((c) => c && c.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ');
      return {
        key: `kitsu:${it.id}`,
        source: 'kitsu',
        sourceLabel: 'Kitsu',
        title,
        altTitle: altTitle && altTitle !== title ? altTitle : '',
        description: cleanText(a.synopsis, 1400),
        image: poster.large || poster.original || poster.medium || '',
        url: a.slug ? `https://kitsu.io/anime/${a.slug}` : '',
        genres: [],
        score: normalizeScore(a.averageRating),
        episodes: Number(a.episodeCount) || 0,
        status: idStatus(a.status),
        year: yearOf(a.startDate),
        type: cleanText(a.subtype, 30),
        studio,
        releaseDate: a.startDate || '',
        extra: studio ? `Studio: ${studio}` : '',
        slug: '',
      };
    })
    .filter((it) => it && it.title);
}

async function fetchJikan(limit = 8) {
  const n = Math.max(1, Math.min(25, limit));
  const res = await fetchWithTimeout(
    `https://api.jikan.moe/v4/seasons/now?sfw=true&limit=${n}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
      },
    },
    15000
  );

  if (!res.ok) throw new Error(`Jikan http ${res.status}`);
  const json = await res.json();
  const list = json && json.data;
  if (!Array.isArray(list)) throw new Error('Jikan response tidak valid');

  return list
    .map((it) => {
      if (!it) return null;
      const images = it.images || {};
      const image =
        (images.jpg && (images.jpg.large_image_url || images.jpg.image_url)) ||
        (images.webp && (images.webp.large_image_url || images.webp.image_url)) ||
        '';
      const title = cleanText(it.title_english || it.title, 160);
      if (!title) return null;
      const altTitle =
        it.title_english && it.title && it.title_english !== it.title
          ? cleanText(it.title, 160)
          : '';
      const studios = (it.studios || [])
        .map((s) => s && s.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ');
      return {
        key: `jikan:${it.mal_id}`,
        source: 'jikan',
        sourceLabel: 'MyAnimeList',
        title,
        altTitle,
        description: cleanText(it.synopsis, 1400),
        image,
        url: it.url || (it.mal_id ? `https://myanimelist.net/anime/${it.mal_id}` : ''),
        genres: Array.isArray(it.genres) ? it.genres.map((g) => g && g.name).filter(Boolean).slice(0, 8) : [],
        score: normalizeScore(it.score),
        episodes: Number(it.episodes) || 0,
        status: idStatus(it.status),
        year: Number(it.year) || yearOf(it.aired && it.aired.from),
        type: cleanText(it.type, 30),
        studio: studios,
        releaseDate: (it.aired && it.aired.from) || '',
        extra: studios ? `Studio: ${studios}` : '',
        slug: '',
      };
    })
    .filter((it) => it && it.title);
}

async function fetchAnimeKita(limit = 8) {
  const list = await animekita.newUploads(1);
  if (!Array.isArray(list)) throw new Error('AnimeKita response tidak valid');

  return list
    .slice(0, Math.max(1, limit))
    .map((it) => {
      const slug = String((it && it.url) || '').trim();
      const title = cleanText(it && it.judul, 160);
      if (!title) return null;
      const extra = [
        it.lastup ? cleanText(it.lastup, 80) : '',
        it.lastch ? `Chapter ${cleanText(it.lastch, 30)}` : '',
      ]
        .filter(Boolean)
        .join(' • ');
      return {
        key: `animekita:${it.id || slug || title}`,
        source: 'animekita',
        sourceLabel: 'AnimeKita',
        title,
        altTitle: '',
        description: '',
        image: (it && it.cover) || '',
        url: slug
          ? `https://animekita.org/?s=${encodeURIComponent(slug)}`
          : `https://animekita.org/?s=${encodeURIComponent(title)}`,
        genres: [],
        score: 0,
        episodes: 0,
        status: 'Sedang Tayang',
        year: 0,
        type: 'TV',
        studio: '',
        releaseDate: '',
        extra,
        slug,
      };
    })
    .filter((it) => it && it.title);
}

async function fetchSource(name, limit) {
  switch (name) {
    case 'anilist':
      return fetchAniList(limit);
    case 'kitsu':
      return fetchKitsu(limit);
    case 'animekita':
      return fetchAnimeKita(limit);
    case 'jikan':
      return fetchJikan(limit);
    default:
      return [];
  }
}

/**
 * Ambil info anime dari beberapa sumber sekaligus. Sumber yang gagal /
 * timeout tidak menggagalkan keseluruhan proses.
 */
async function fetchAll(sources, perSource = 8) {
  const names = normalizeSources(sources);
  const results = await Promise.allSettled(names.map((name) => fetchSource(name, perSource)));

  const errors = [];
  const lists = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      lists.push(res.value);
    } else if (res.status === 'rejected') {
      errors.push({ source: names[i], error: res.reason && res.reason.message ? res.reason.message : String(res.reason) });
    }
  });

  // Interleave antar sumber supaya hasilnya bervariasi.
  const merged = [];
  const maxLen = lists.reduce((max, list) => Math.max(max, list.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (list[i]) merged.push(list[i]);
    }
  }

  // Buang duplikat judul dalam satu siklus.
  const seen = new Set();
  const items = [];
  for (const it of merged) {
    const key = titleKey(it.title);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    items.push(it);
  }

  return { items, errors, sources: names };
}

module.exports = {
  ALL_SOURCES,
  cleanText,
  normalizeScore,
  idStatus,
  normalizeSources,
  fetchAniList,
  fetchKitsu,
  fetchJikan,
  fetchAnimeKita,
  fetchAll,
};
