'use strict';

const log = require('./logger');
const fs = require('fs');
const path = require('path');

const MAX_TURNS = 8;
const MEMORY_DIR = path.resolve(process.cwd(), 'data', 'memory');

const chatHistMap = new Map();
const userNameMap = new Map();

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

module.exports = {
  loadAll,
  load,
  saveTurn,
  buildContext,
  detectNameRequest,
  setUserName,
  getUserName,
  extractActualUserInput,
};
