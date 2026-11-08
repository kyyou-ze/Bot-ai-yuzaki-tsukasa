'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function envFile() {
  return path.resolve(
    process.env.ENV_FILE || process.env.DOTENV_CONFIG_PATH || path.join(ROOT, '.env')
  );
}

function exampleFile() {
  return path.resolve(process.env.ENV_EXAMPLE || path.join(ROOT, '.env.example'));
}

function boolValue(value, def = true) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'aktif', 'nyala'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'mati', 'nonaktif'].includes(v)) return false;
  return def;
}

function parseEntries(text) {
  const map = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function parseExample(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ key: m[1], value: m[2] });
  }
  return out;
}

/**
 * Tambahkan variabel yang ada di `.env.example` tetapi belum ada di `.env`.
 *
 * Nilai lama TIDAK pernah ditimpa; hanya key yang hilang yang ditambahkan.
 * Dipanggil sebelum dotenv memuat `.env` (lihat index.js) supaya variabel
 * baru dari update langsung berlaku pada start/restart yang sama.
 */
function syncEnvFile(options = {}) {
  const target = options.envFile || envFile();
  const example = options.exampleFile || exampleFile();

  let exampleText;
  try {
    exampleText = fs.readFileSync(example, 'utf8');
  } catch {
    return { ok: false, reason: 'no-example', added: [] };
  }

  let current = '';
  let exists = true;
  try {
    current = fs.readFileSync(target, 'utf8');
  } catch {
    exists = false;
  }

  const currentKeys = parseEntries(current);
  if (exists && !boolValue(currentKeys.get('ENV_SYNC_ENABLED'), true)) {
    return { ok: true, disabled: true, added: [] };
  }

  const entries = parseExample(exampleText);
  if (!exists) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, exampleText, { mode: 0o600 });
      return { ok: true, created: true, added: entries.map((e) => e.key) };
    } catch (err) {
      return { ok: false, reason: err.message, added: [] };
    }
  }

  const missing = entries.filter((entry) => !currentKeys.has(entry.key));
  if (!missing.length) return { ok: true, added: [] };

  const block = [
    '',
    '# ===== Ditambahkan otomatis dari .env.example =====',
    ...missing.map((entry) => `${entry.key}=${entry.value}`),
    '',
  ].join('\n');

  try {
    const prefix = current && !current.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(target, prefix + block);
    return { ok: true, added: missing.map((entry) => entry.key) };
  } catch (err) {
    return { ok: false, reason: err.message, added: [] };
  }
}

module.exports = {
  syncEnvFile,
  parseEntries,
  parseExample,
  envFile,
  exampleFile,
};
