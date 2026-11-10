'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { downloadQueue } = require('./downloadqueue');

const UA = 'wa-tsukasa-bot/2.0';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeJid(jid) {
  return String(jid || '').trim();
}

function jidUser(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function onlyDigits(s) {
  return String(s || '').replace(/\D+/g, '');
}

function isGroupJid(jid) {
  return String(jid || '').endsWith('@g.us');
}

function destJid(jid) {
  const s = normalizeJid(jid);
  if (isGroupJid(s)) return s;
  // Buang device suffix (:12) dari JID user.
  return s.replace(/:\d+@/, '@');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function trimWords(s, max) {
  if (!max || max <= 0) return s;
  const parts = String(s || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= max) return s;
  return parts.slice(0, max).join(' ');
}

function normaliseTitle(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Normalisasi judul untuk dedupe lintas sumber: buang tahun, season, part,
// cour, dan tanda baca supaya variasi judul dianggap sama.
function canonicalTitle(text) {
  return normaliseTitle(
    String(text || '')
      .replace(/['’]s\b/gi, '')
      .replace(/['’]/g, '')
      // Sisa "journey s end" dari judul lama yang apostrofnya sudah hilang.
      .replace(/\b([a-z0-9]+)\s+s\s+([a-z0-9]+)\b/gi, '$1 $2')
      .replace(/&/g, ' and ')
      .replace(/\((?:19|20)\d{2}\)/g, ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
      .replace(/\b(?:season|s)\s*\d+\b/gi, ' ')
      .replace(/\b\d+\s*(?:st|nd|rd|th)\s*season\b/gi, ' ')
      .replace(/\b(?:part|cour)\s*\d+\b/gi, ' ')
      .replace(/\b(?:final season|the final season)\b/gi, ' ')
      .replace(/\b(?:stage|movie|film|ova|ona|special|tv)\b/gi, ' ')
      .replace(/\b\d+(?:st|nd|rd|th)\b/gi, ' ')
  )
    .replace(/^the\s+/, '')
    .trim();
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function atomicWriteJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function safeReadJson(file, def) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return def;
  }
}

// ---------- HTTP helpers ----------
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Timer sengaja tidak di-clear: signal harus tetap hidup selama body dibaca.
  // Tanpa ini, server yang mengirim header lalu berhenti bisa menggantung
  // selamanya karena timeout sudah dilepas tepat setelah fetch() resolve.
  if (typeof timer.unref === 'function') timer.unref();
  return fetch(url, { ...options, signal: controller.signal });
}

async function downloadBytes(url, max = 0, timeoutMs = 90000) {
  let label = 'http';
  try {
    const parsed = new URL(url);
    label = `http:${parsed.hostname}`.slice(0, 80);
  } catch {
    /* URL tidak valid; biarkan fetch yang memberi error */
  }
  return downloadQueue.run(label, async () => {
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': UA }, redirect: 'follow' },
      timeoutMs
    );
    if (!res.ok) throw new Error(`http ${res.status} ${res.statusText}`);
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    const len = Number(res.headers.get('content-length') || 0);
    if (max > 0 && len > 0 && len > max) {
      throw new Error(`file too large: ${len} > ${max}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (max > 0 && buf.length > max) {
      throw new Error(`file too large after read: ${buf.length} > ${max}`);
    }
    return { data: buf, mime: ct };
  });
}

async function headInfo(url, timeoutMs = 30000) {
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' },
      timeoutMs
    );
    const size = Number(res.headers.get('content-length') || 0) || 0;
    const ctype = (res.headers.get('content-type') || '').split(';')[0].trim();
    return { size, ctype };
  } catch {
    return { size: 0, ctype: '' };
  }
}

// ---------- Waktu lokal ----------
//
// Bot bisa berjalan di server yang zona waktunya UTC (umum di panel/Pterodactyl),
// jadi JANGAN memakai getHours()/toLocaleString() tanpa timeZone. Helper ini
// membaca jam dinding sesuai BOT_TIMEZONE dan dipakai seluruh bot.

const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const TZ_OFFSET_CACHE = new Map();

function safeTimezone(timezone) {
  const tz = String(timezone || '').trim();
  return tz || DEFAULT_TIMEZONE;
}

/**
 * Offset zona waktu (jam) terhadap UTC pada waktu tertentu.
 * Contoh: Asia/Jakarta -> 7, Asia/Makassar -> 8, Asia/Jayapura -> 9.
 */
function tzOffsetHours(timezone = DEFAULT_TIMEZONE, at = Date.now()) {
  const tz = safeTimezone(timezone);
  const when = Number.isFinite(Number(at)) ? Number(at) : Date.now();
  // Cache per zona + jam (offset bisa berubah karena DST di negara lain).
  const cacheKey = `${tz}|${Math.floor(when / 3600000)}`;
  if (TZ_OFFSET_CACHE.has(cacheKey)) return TZ_OFFSET_CACHE.get(cacheKey);
  let offset = 7;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(when));
    const get = (type) => Number((parts.find((p) => p.type === type) || {}).value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second')
    );
    const rounded = Math.floor(when / 1000) * 1000;
    offset = Math.round(((asUtc - rounded) / 3600000) * 100) / 100;
  } catch {
    /* zona tidak valid: pakai WIB */
  }
  if (TZ_OFFSET_CACHE.size > 500) TZ_OFFSET_CACHE.clear();
  TZ_OFFSET_CACHE.set(cacheKey, offset);
  return offset;
}

/**
 * Bagian waktu lokal: jam, menit, tanggal, dan nama hari.
 * dateKey selalu `YYYY-MM-DD` di zona waktu yang dipilih.
 */
function localParts(at = Date.now(), timezone = DEFAULT_TIMEZONE) {
  const tz = safeTimezone(timezone);
  const when = Number.isFinite(Number(at)) ? Number(at) : Date.now();
  try {
    const parts = new Intl.DateTimeFormat('id-ID', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(when));
    const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    const second = Number(get('second'));
    const pad = (n) => String(n).padStart(2, '0');
    const weekdayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const weekday = weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] || '';
    return {
      ts: when,
      timezone: tz,
      year,
      month,
      day,
      hour,
      minute,
      second,
      minutes: hour * 60 + minute,
      weekday,
      dateKey: `${year}-${pad(month)}-${pad(day)}`,
      clock: `${pad(hour)}:${pad(minute)}`,
      clockSeconds: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
      dateLabel: `${pad(day)}/${pad(month)}/${year}`,
      stamp: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    };
  } catch {
    // Fallback: pakai UTC agar tetap deterministik (jangan bergantung TZ host).
    const d = new Date(when);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      ts: when,
      timezone: tz,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
      weekday: '',
      dateKey: d.toISOString().slice(0, 10),
      clock: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
      clockSeconds: d.toISOString().slice(11, 19),
      dateLabel: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
      stamp: d.toISOString().replace('T', ' ').slice(0, 19),
    };
  }
}

/** Format tanggal+jam lokal, mis. "09/11/2026 21.05". */
function formatDateTime(at = Date.now(), timezone = DEFAULT_TIMEZONE) {
  const p = localParts(at, timezone);
  return `${p.dateLabel} ${p.clock}`;
}

/** Format jam lokal, mis. "21.05". */
function formatClock(at = Date.now(), timezone = DEFAULT_TIMEZONE) {
  return localParts(at, timezone).clock;
}

/** Format tanggal lokal, mis. "09/11/2026". */
function formatDate(at = Date.now(), timezone = DEFAULT_TIMEZONE) {
  return localParts(at, timezone).dateLabel;
}

function publicPath(p) {
  if (!p) return '';
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function fileExists(p) {
  if (!p) return false;
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function randomPick(arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[crypto.randomInt(arr.length)];
}

module.exports = {
  UA,
  sleep,
  normalizeJid,
  jidUser,
  onlyDigits,
  isGroupJid,
  destJid,
  escapeXml,
  trimWords,
  normaliseTitle,
  canonicalTitle,
  firstNonEmpty,
  ensureDir,
  atomicWriteJson,
  safeReadJson,
  tzOffsetHours,
  localParts,
  formatDateTime,
  formatClock,
  formatDate,
  fetchWithTimeout,
  downloadBytes,
  headInfo,
  publicPath,
  fileExists,
  randomPick,
};
