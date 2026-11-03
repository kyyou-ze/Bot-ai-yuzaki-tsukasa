'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }, timeoutMs);
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
  firstNonEmpty,
  ensureDir,
  atomicWriteJson,
  safeReadJson,
  fetchWithTimeout,
  downloadBytes,
  headInfo,
  publicPath,
  fileExists,
  randomPick,
};
