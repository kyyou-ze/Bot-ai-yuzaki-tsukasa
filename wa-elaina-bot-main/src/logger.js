'use strict';

const fs = require('fs');
const path = require('path');

// Logger dipakai sebelum src/config.js, jadi muat .env lebih dulu agar
// LOG_LEVEL/LOG_DB_LEVEL dari file ikut terbaca.
try {
  require('dotenv').config();
} catch {
  /* dotenv opsional saat logger diuji terpisah */
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LABELS = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' };

const consoleLevel = normalizeLevel(process.env.LOG_LEVEL, 'info');
const dbLevel = normalizeLevel(process.env.LOG_DB_LEVEL, 'warn');
const consoleEnabled = String(process.env.LOG_CONSOLE || 'true').toLowerCase() !== 'false';
const stackInConsole = String(process.env.LOG_STACK || 'false').toLowerCase() === 'true';
const dbPath = String(process.env.LOG_DB || './database/logs.json').trim();
const dbEnabled = dbPath && !['off', 'false', '0', 'none'].includes(dbPath.toLowerCase());
const dbMax = Math.max(50, parseInt(process.env.LOG_DB_MAX || '1000', 10) || 1000);
const timezone = String(process.env.BOT_TIMEZONE || 'Asia/Jakarta');

const original = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let entries = null;
let sequence = 0;

function normalizeLevel(value, fallback) {
  const level = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : fallback;
}

function clock(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => (parts.find((p) => p.type === type) || {}).value || '00';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get(
      'second'
    )}`;
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }
}

function splitTag(args) {
  const first = args[0];
  if (typeof first === 'string') {
    const bracket = first.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
    if (bracket) {
      return { tag: bracket[1].trim().toUpperCase(), rest: [bracket[2], ...args.slice(1)] };
    }
    // API baru: log.info('TIKTOK', 'pesan ...')
    if (args.length > 1 && /^[A-Za-z0-9_-]{2,24}$/.test(first.trim())) {
      return { tag: first.trim().toUpperCase(), rest: args.slice(1) };
    }
  }
  return { tag: 'APP', rest: args };
}

function scalar(value) {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function firstStack(args) {
  for (const value of args) {
    if (value instanceof Error && value.stack) return String(value.stack).slice(0, 8000);
    if (value && typeof value === 'object' && typeof value.stack === 'string' && value.stack) {
      return String(value.stack).slice(0, 8000);
    }
  }
  return '';
}

function messageOf(args) {
  return (
    args
      .map(scalar)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim() || '-'
  );
}

function loadDb() {
  if (entries !== null) return entries;
  entries = [];
  try {
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (Array.isArray(raw)) entries = raw;
    else if (raw && Array.isArray(raw.logs)) entries = raw.logs;
  } catch {
    entries = [];
  }
  return entries;
}

function saveDb() {
  if (!dbEnabled) return;
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const tmp = `${dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
    fs.renameSync(tmp, dbPath);
  } catch (err) {
    original.error(`[LOGGER] gagal menulis ${dbPath}: ${err.message}`);
  }
}

function store(entry) {
  if (!dbEnabled || LEVELS[entry.level] < LEVELS[dbLevel]) return;
  const data = loadDb();
  data.push(entry);
  if (data.length > dbMax) data.splice(0, data.length - dbMax);
  sequence = (sequence + 1) % 100000;
  saveDb();
}

function write(level, args) {
  if (!LEVELS[level]) level = 'info';
  const { tag, rest } = splitTag(args);
  const message = messageOf(rest);
  const stack = firstStack(rest);

  // Simpan bug/error ke database walau console dimatikan.
  if (LEVELS[level] >= LEVELS[dbLevel]) {
    store({
      id: `${Date.now()}-${sequence}`,
      time: new Date().toISOString(),
      timeLocal: clock(),
      level,
      tag,
      message,
      ...(stack ? { stack } : {}),
      pid: process.pid,
    });
  }

  if (!consoleEnabled || LEVELS[level] < LEVELS[consoleLevel]) return;

  const line = stackInConsole && stack
    ? `[${clock()}] [${LABELS[level]}] [${tag}] ${message}\n${stack}`
    : `[${clock()}] [${LABELS[level]}] [${tag}] ${message}`;

  if (level === 'error') original.error(line);
  else if (level === 'warn') original.warn(line);
  else original.log(line);
}

module.exports = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  log: (...args) => write('info', args),
  recent(limit = 20) {
    const data = loadDb();
    return data.slice(-Math.max(1, Number(limit) || 20));
  },
  dbPath,
};
