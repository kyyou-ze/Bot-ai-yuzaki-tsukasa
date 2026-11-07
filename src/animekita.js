'use strict';

const { fetchWithTimeout } = require('./util');

const BASE_URL = 'https://apps.animekita.org/api/v1.1.9';
const UA = 'Dart/3.1 (dart:io)';

function lastJsonEnd(text) {
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text[i];
    if (c === '}' || c === ']') return i + 1;
  }
  return text.length;
}

function trimJson(text) {
  let out = String(text || '').trim();
  const start = out.search(/[[{]/);
  if (start > 0) out = out.slice(start);
  const end = lastJsonEnd(out);
  if (end > 0 && end < out.length) out = out.slice(0, end);
  return out;
}

async function getJson(endpoint, timeoutMs = 20000) {
  const res = await fetchWithTimeout(
    BASE_URL + endpoint,
    {
      headers: {
        'User-Agent': UA,
        'Accept-Encoding': 'gzip',
      },
      redirect: 'follow',
    },
    timeoutMs
  );

  if (res.status >= 400) {
    const body = await res.text().catch(() => '');
    throw new Error(`animekita ${res.status}: ${String(body).trim().slice(0, 300)}`);
  }

  const raw = trimJson(await res.text());
  if (!raw) throw new Error('empty response');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`decode: ${err.message}`);
  }
}

function parseSimpleEntries(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.value)) return raw.value;
  throw new Error('decode simple entries: unexpected format');
}

async function newUploads(page = 1) {
  const p = Number(page) >= 1 ? Number(page) : 1;
  return parseSimpleEntries(await getJson(`/baruupload.php?page=${p}`));
}

async function movies() {
  return parseSimpleEntries(await getJson('/movie.php'));
}

async function schedule() {
  const payload = await getJson('/jadwal.php');
  return Array.isArray(payload.data) ? payload.data : [];
}

async function animeList() {
  const payload = await getJson('/anime-list.php');
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
}

async function genre(slug, page = 1) {
  const p = Number(page) >= 1 ? Number(page) : 1;
  const name = String(slug || '').trim().toLowerCase();
  const q = new URLSearchParams({ url: `${name}/`, page: String(p) });
  return parseSimpleEntries(await getJson(`/genreseries.php?${q.toString()}`));
}

async function search(keyword) {
  const q = String(keyword || '').trim();
  if (!q) throw new Error('keyword is required');
  const qs = new URLSearchParams({ keyword: q });
  const payload = await getJson(`/search.php?${qs.toString()}`);
  return Array.isArray(payload.data) ? payload.data : [];
}

async function detail(slug) {
  const s = String(slug || '').trim();
  if (!s) throw new Error('url is required');
  const qs = new URLSearchParams({ url: s });
  const payload = await getJson(`/series.php?${qs.toString()}`);
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error('series not found');
  }
  return payload.data[0];
}

async function episode(slug, resolution = '720p') {
  const s = String(slug || '').trim();
  if (!s) throw new Error('url is required');
  const reso = String(resolution || '').trim() || '720p';
  const qs = new URLSearchParams({ url: s, reso });
  const payload = await getJson(`/chapter.php?${qs.toString()}`);
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error('episode not found');
  }
  return payload.data[0];
}

module.exports = {
  BASE_URL,
  newUploads,
  movies,
  schedule,
  animeList,
  genre,
  search,
  detail,
  episode,
};
