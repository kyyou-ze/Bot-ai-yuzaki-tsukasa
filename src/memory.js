'use strict';

const log = require('./logger');
const fs = require('fs');
const path = require('path');

const MAX_TURNS = 8;
const MEMORY_DIR = path.resolve(process.cwd(), 'data', 'memory');
const OWNER_GIST_FILE = path.join(MEMORY_DIR, '_owner-gist.json');
const FACTS_FILE = path.join(MEMORY_DIR, '_facts.json');
const MAX_FACTS = 10;
const MAX_FACT_LEN = 160;
const DAY_MS = 24 * 60 * 60 * 1000;

// Masa berlaku ingatan. Ringkasan suasana owner cepat basi, sedangkan fakta
// pribadi yang ditulis sendiri user boleh bertahan lama. 0 = tidak kedaluwarsa.
function ttlDaysFromEnv(name, fallback) {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

const GIST_TTL_DAYS = ttlDaysFromEnv('MEMORY_GIST_TTL_DAYS', 14);
const FACT_TTL_DAYS = ttlDaysFromEnv('MEMORY_FACT_TTL_DAYS', 180);

const chatHistMap = new Map();
const userNameMap = new Map();
// Catatan fakta pribadi per JID. Hanya dipakai sebagai konteks internal.
const factsMap = new Map();

// Ringkasan aman percakapan pribadi owner. Dipakai supaya Tsukasa tetap
// terasa dekat dengan owner saat mereka bertemu di grup, tanpa membocorkan
// isi chat pribadi. `dirty` menandai ringkasan perlu diperbarui.
const ownerGist = {
  text: '',
  updatedAt: 0,
  sourceChat: '',
  dirty: false,
};
// Naik setiap owner chat; dipakai agar ringkasan yang selesai belakangan
// tidak menghapus penanda "perlu diperbarui" dari pesan yang lebih baru.
let ownerGistSeq = 0;

const reNameRequest = /^(panggil aku|sebut aku|nama aku|namaku|name is|call me)\s+(.+)$/i;

function sanitizeJid(jid) {
  return String(jid || '')
    .replace(/@/g, '_at_')
    .replace(/:/g, '_colon_');
}

function desanitizeName(name) {
  return String(name || '')
    .replace(/_at_/g, '@')
    .replace(/_colon_/g, ':');
}

function loadAll() {
  try {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  } catch {
    return;
  }

  const usersFile = path.join(MEMORY_DIR, '_usernames.json');
  try {
    const raw = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    for (const [k, v] of Object.entries(raw || {})) userNameMap.set(k, v);
  } catch {
    /* ignore */
  }

  try {
    const gist = JSON.parse(fs.readFileSync(OWNER_GIST_FILE, 'utf8'));
    ownerGist.text = String(gist.text || '');
    ownerGist.updatedAt = Number(gist.updatedAt) || 0;
    ownerGist.sourceChat = String(gist.sourceChat || '');
  } catch {
    /* belum ada ringkasan */
  }

  try {
    const stat = fs.statSync(FACTS_FILE);
    const fallbackAt = Number(stat.mtimeMs) || Date.now();
    const raw = JSON.parse(fs.readFileSync(FACTS_FILE, 'utf8'));
    let changed = false;
    for (const [jid, list] of Object.entries(raw || {})) {
      if (!Array.isArray(list)) continue;
      const entries = [];
      for (const item of list) {
        const entry = normalizeFactEntry(item, fallbackAt);
        if (!entry) {
          changed = true;
          continue;
        }
        // Catatan format lama masih berupa string; simpan ulang sebagai objek
        // supaya punya cap waktu dan bisa kedaluwarsa.
        if (typeof item === 'string' || !item.createdAt) changed = true;
        if (factExpired(entry)) {
          changed = true;
          continue;
        }
        entries.push(entry);
      }
      const clean = entries.slice(0, MAX_FACTS);
      if (clean.length !== entries.length) changed = true;
      if (clean.length) factsMap.set(jid, clean);
    }
    if (changed) persistFacts();
  } catch {
    /* belum ada catatan */
  }

  let entries = [];
  try {
    entries = fs.readdirSync(MEMORY_DIR);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!name.endsWith('.json') || name === '_usernames.json') continue;
    try {
      const hist = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, name), 'utf8'));
      if (Array.isArray(hist)) {
        chatHistMap.set(desanitizeName(name.slice(0, -5)), hist);
      }
    } catch {
      /* ignore */
    }
  }
}

async function persistChat(chatJID, hist) {
  try {
    await fs.promises.mkdir(MEMORY_DIR, { recursive: true });
    await fs.promises.writeFile(
      path.join(MEMORY_DIR, `${sanitizeJid(chatJID)}.json`),
      JSON.stringify(hist, null, 2)
    );
  } catch (err) {
    log.error('[MEMORY] gagal simpan chat:', err.message);
  }
}

async function persistUserNames() {
  try {
    await fs.promises.mkdir(MEMORY_DIR, { recursive: true });
    await fs.promises.writeFile(
      path.join(MEMORY_DIR, '_usernames.json'),
      JSON.stringify(Object.fromEntries(userNameMap), null, 2)
    );
  } catch (err) {
    log.error('[MEMORY] gagal simpan nama:', err.message);
  }
}

function load(chatJID) {
  return chatHistMap.get(chatJID) || [];
}

/**
 * Hapus riwayat percakapan satu chat, termasuk file di disk. Nama pengguna
 * (userNameMap) sengaja tidak dihapus supaya bot tetap memanggil nama yang
 * sudah dikenal.
 */
function clear(chatJID) {
  const key = String(chatJID || '').trim();
  if (!key) return false;
  const existed = chatHistMap.delete(key);
  try {
    fs.unlinkSync(path.join(MEMORY_DIR, `${sanitizeJid(key)}.json`));
  } catch {
    /* file memang belum ada */
  }
  // Ingatan owner ikut dihapus bila yang dibersihkan adalah chat pribadinya.
  if (ownerGist.sourceChat === key) {
    ownerGist.text = '';
    ownerGist.updatedAt = 0;
    ownerGist.dirty = false;
    persistOwnerGist();
  }
  return existed;
}

function saveTurn(chatJID, role, text, name) {
  const hist = chatHistMap.get(chatJID) || [];
  const turn = { role, text };
  if (name) turn.name = String(name).trim().slice(0, 60);
  hist.push(turn);
  const trimmed = hist.length > MAX_TURNS * 2 ? hist.slice(hist.length - MAX_TURNS * 2) : hist;
  chatHistMap.set(chatJID, trimmed);
  persistChat(chatJID, trimmed);
  return trimmed;
}

function buildContext(hist, newUserText, senderJID) {
  const userName = getUserName(senderJID);
  const parts = [];
  if (hist.length > 0) {
    parts.push('Konteks percakapan sebelumnya:');
    for (const t of hist) {
      const who =
        t.role === 'user'
          ? `User${t.name ? ` (${t.name})` : ''}`
          : 'Tsukasa';
      parts.push(`${who}: ${t.text}`);
    }
    parts.push('');
  }
  parts.push(`Nama pengguna: ${userName || 'belum diketahui (panggil "kamu")'}`);
  parts.push('');
  parts.push('Pertanyaan/teks baru:');
  parts.push(newUserText);
  return parts.join('\n');
}

/**
 * Konteks untuk grup: tetap memuat riwayat, tetapi tanpa mengunci percakapan
 * ke satu nama pengguna. Nama pembicara sudah ada di transkrip batch.
 */
function buildGroupContext(hist, newUserText) {
  const parts = [];
  if (hist.length > 0) {
    parts.push('Konteks percakapan grup sebelumnya:');
    for (const t of hist) {
      // Turn user di grup sudah berupa transkrip berlabel [Nama]: ...,
      // jadi jangan ditambah prefiks nama lagi.
      parts.push(t.role === 'assistant' ? `Tsukasa: ${t.text}` : t.text);
    }
    parts.push('');
  }
  parts.push('Pertanyaan/teks baru:');
  parts.push(newUserText);
  return parts.join('\n');
}

function detectNameRequest(text) {
  const t = String(text || '').trim();
  const m = t.match(reNameRequest);
  if (m && m[2]) {
    const name = m[2].trim().replace(/^["'.!]+|["'.!]+$/g, '').trim();
    if (name) return name;
  }
  return null;
}

function setUserName(senderJID, name) {
  userNameMap.set(senderJID, name);
  persistUserNames();
}

function getUserName(senderJID) {
  return userNameMap.get(senderJID) || '';
}

// ---------------- Ingatan owner lintas chat ----------------

function persistOwnerGist() {
  try {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(
      OWNER_GIST_FILE,
      JSON.stringify(
        {
          text: ownerGist.text,
          updatedAt: ownerGist.updatedAt,
          sourceChat: ownerGist.sourceChat,
        },
        null,
        2
      )
    );
  } catch (err) {
    log.error('[MEMORY] gagal simpan ingatan owner:', err.message);
  }
}

/**
 * Tandai bahwa owner baru saja mengobrol di chat pribadi. Chat-nya diingat
 * sebagai sumber ringkasan. Isi mentah tidak pernah dipakai di grup.
 */
function markOwnerDm(chatJID) {
  const key = String(chatJID || '').trim();
  if (key) ownerGist.sourceChat = key;
  ownerGistSeq += 1;
  ownerGist.dirty = true;
  persistOwnerGist();
}

/** Ringkasan aman tentang owner (bukan transkrip) untuk konteks grup. */
function ownerGistExpired(now = Date.now()) {
  if (GIST_TTL_DAYS <= 0) return false;
  if (!ownerGist.updatedAt) return false;
  return now - ownerGist.updatedAt > GIST_TTL_DAYS * DAY_MS;
}

function getOwnerGist() {
  const expired = ownerGistExpired();
  return {
    text: expired ? '' : ownerGist.text,
    updatedAt: ownerGist.updatedAt,
    sourceChat: ownerGist.sourceChat,
    dirty: ownerGist.dirty,
    seq: ownerGistSeq,
    expired,
    // Ringkasan lama masih tersimpan, tetapi sudah tidak dipakai.
    stale: expired && Boolean(ownerGist.text),
    ttlDays: GIST_TTL_DAYS,
  };
}

/** Buang data yang tidak boleh ikut ke konteks grup (nomor, email, tautan). */
function sanitizeGist(text) {
  return String(text || '')
    .replace(/\+?\d[\d\s\-()]{6,}\d/g, '[disembunyikan]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[disembunyikan]')
    .replace(/https?:\/\/\S+/gi, '[tautan]')
    .trim();
}

/**
 * Simpan ringkasan baru dari model. `seq` adalah nomor urut saat ringkasan
 * mulai dibuat; bila owner sudah chat lagi, ringkasan tetap ditandai usang.
 */
function setOwnerGist(text, seq) {
  ownerGist.text = sanitizeGist(text).slice(0, 1500);
  ownerGist.updatedAt = Date.now();
  ownerGist.dirty = typeof seq === 'number' ? seq !== ownerGistSeq : false;
  persistOwnerGist();
  return ownerGist.text;
}

/** Riwayat chat pribadi owner terakhir, dipakai untuk membuat ringkasan. */
function ownerChatHistory() {
  return ownerGist.sourceChat ? load(ownerGist.sourceChat) : [];
}

// ---------------- Catatan fakta pribadi ----------------

function persistFacts() {
  try {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(FACTS_FILE, JSON.stringify(Object.fromEntries(factsMap), null, 2));
  } catch (err) {
    log.error('[MEMORY] gagal simpan catatan:', err.message);
  }
}

function cleanFact(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”‘’·•-]+|[\s"'“”‘’]+$/g, '')
    .trim()
    .slice(0, MAX_FACT_LEN);
}

function factStamp(entry) {
  return Number(entry && (entry.updatedAt || entry.createdAt)) || 0;
}

function factAgeDays(entry, now = Date.now()) {
  const stamp = factStamp(entry);
  if (!stamp) return 0;
  return Math.max(0, (now - stamp) / DAY_MS);
}

function factExpired(entry, now = Date.now()) {
  if (FACT_TTL_DAYS <= 0) return false;
  const stamp = factStamp(entry);
  if (!stamp) return false;
  return now - stamp > FACT_TTL_DAYS * DAY_MS;
}

/** Sisa hari sebelum catatan kedaluwarsa; null bila tidak memakai masa berlaku. */
function factDaysLeft(entry, now = Date.now()) {
  if (FACT_TTL_DAYS <= 0) return null;
  return Math.max(0, FACT_TTL_DAYS - factAgeDays(entry, now));
}

function normalizeFactEntry(value, fallbackAt) {
  const source = value && typeof value === 'object' ? value : { text: value };
  const text = cleanFact(source.text);
  if (!text) return null;
  const createdAt = Number(source.createdAt) || fallbackAt;
  const updatedAt = Number(source.updatedAt) || createdAt;
  return { text, createdAt, updatedAt };
}

/**
 * Fakta aktif (belum kedaluwarsa). Catatan basi dibuang sambil merapikan
 * file supaya tidak menumpuk.
 */
function activeFacts(key) {
  const list = factsMap.get(key);
  if (!list) return [];
  const now = Date.now();
  const alive = list.filter((entry) => !factExpired(entry, now));
  if (alive.length !== list.length) {
    if (alive.length) factsMap.set(key, alive);
    else factsMap.delete(key);
    persistFacts();
  }
  return alive;
}

/**
 * Simpan fakta pribadi untuk satu JID. Mengembalikan status agar pemanggil
 * bisa membedakan duplikat, penuh, dan berhasil. Menulis ulang fakta yang sama
 * akan menyegarkan masa berlakunya.
 */
function addFact(jid, text) {
  const key = String(jid || '').trim();
  const fact = cleanFact(text);
  if (!key || !fact) return { ok: false, reason: 'kosong' };
  const list = activeFacts(key);
  const now = Date.now();
  const existing = list.find((entry) => entry.text.toLowerCase() === fact.toLowerCase());
  if (existing) {
    existing.updatedAt = now;
    factsMap.set(key, list);
    persistFacts();
    return { ok: false, reason: 'duplikat', fact, refreshed: true, ttlDays: FACT_TTL_DAYS };
  }
  if (list.length >= MAX_FACTS) return { ok: false, reason: 'penuh', fact };
  list.push({ text: fact, createdAt: now, updatedAt: now });
  factsMap.set(key, list);
  persistFacts();
  return { ok: true, fact, count: list.length, ttlDays: FACT_TTL_DAYS };
}

/** Daftar fakta pribadi (teks saja) untuk satu JID. */
function getFacts(jid) {
  return activeFacts(String(jid || '').trim()).map((entry) => entry.text);
}

/** Daftar fakta beserta sisa masa berlaku, untuk ditampilkan ke user. */
function getFactEntries(jid) {
  return activeFacts(String(jid || '').trim()).map((entry) => ({
    text: entry.text,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    daysLeft: factDaysLeft(entry),
  }));
}

/** Hapus satu fakta berdasarkan nomor urut 1-based. */
function removeFact(jid, index) {
  const key = String(jid || '').trim();
  const list = activeFacts(key);
  if (!list.length) return '';
  const i = Number(index) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return '';
  const [removed] = list.splice(i, 1);
  if (list.length) factsMap.set(key, list);
  else factsMap.delete(key);
  persistFacts();
  return (removed && removed.text) || '';
}

/** Hapus semua fakta pribadi satu JID. */
function clearFacts(jid) {
  const key = String(jid || '').trim();
  if (!key || !factsMap.has(key)) return false;
  factsMap.delete(key);
  persistFacts();
  return true;
}

function extractActualUserInput(contextText) {
  const lines = String(contextText || '').split('\n');
  const found = [];
  let marker = false;
  for (const line of lines) {
    if (line.includes('Pertanyaan/teks baru:')) {
      marker = true;
      continue;
    }
    if (marker && line.trim() !== '') found.push(line);
  }
  if (found.length > 0) return found.join('\n');

  if (!contextText.includes('Konteks percakapan')) return contextText;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (
      line &&
      !line.startsWith('Konteks') &&
      !line.startsWith('Pertanyaan') &&
      !line.startsWith('Nama pengguna:') &&
      !line.includes('Tsukasa:')
    ) {
      return line;
    }
  }
  return contextText;
}

/** Masa berlaku ingatan yang aktif, untuk ditampilkan di bantuan. */
function memoryTtl() {
  return { gistDays: GIST_TTL_DAYS, factDays: FACT_TTL_DAYS };
}

module.exports = {
  loadAll,
  load,
  clear,
  saveTurn,
  buildContext,
  buildGroupContext,
  detectNameRequest,
  setUserName,
  getUserName,
  markOwnerDm,
  getOwnerGist,
  setOwnerGist,
  ownerChatHistory,
  addFact,
  getFacts,
  getFactEntries,
  removeFact,
  clearFacts,
  memoryTtl,
  extractActualUserInput,
};
