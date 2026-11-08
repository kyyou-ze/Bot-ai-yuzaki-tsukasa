'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./logger');

// Bentuk kosong harus sama dengan yang pernah di-commit di repo. Setelah data
// lama disalin ke data/tiktok/, file lama dikembalikan ke bentuk ini supaya
// `git status` bersih dan auto-update tidak perlu stash data runtime.
const LEGACY_FILES = [
  {
    key: 'tiktokAccountsDb',
    legacy: 'database/accounts.json',
    empty: {},
  },
  {
    key: 'verifDb',
    legacy: 'database/verif.json',
    empty: [],
  },
  {
    key: 'historyUpDb',
    legacy: 'database/history_up.json',
    empty: [],
  },
  {
    key: 'upTodayDb',
    legacy: 'database/up_today.json',
    empty: { days: {} },
  },
  {
    key: 'seenVideosDb',
    legacy: 'database/seen_videos.json',
    empty: { accounts: {} },
  },
];

function samePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

function inside(dir, file) {
  const rel = path.relative(dir, file);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Migrasi database TikTok lama ke folder data/tiktok/.
 *
 * Hanya menyalin jika target belum ada. Setelah salinan berhasil, file lama
 * diubah kembali ke bentuk kosong agar tidak terus dianggap perubahan lokal
 * oleh git (penyebab data hilang saat auto-update).
 */
function migrateTikTokData(cfg) {
  if (!cfg || !cfg.tiktokDataDir) return 0;
  const root = path.resolve(cfg.tiktokDataDir);
  let migrated = 0;

  for (const item of LEGACY_FILES) {
    const legacy = path.resolve(item.legacy);
    const target = cfg[item.key] ? path.resolve(cfg[item.key]) : '';
    if (!target || samePath(legacy, target)) continue;
    // Jangan sentuh path kustom di luar folder data/tiktok.
    if (!inside(root, target)) continue;

    let legacyText;
    try {
      legacyText = fs.readFileSync(legacy, 'utf8');
    } catch {
      legacyText = '';
    }
    if (!legacyText) continue;

    const parsed = parseJson(legacyText);
    if (parsed === undefined) {
      log.warn(`[MIGRASI] ${item.legacy} bukan JSON valid; migrasi dilewati.`);
      continue;
    }

    if (!fs.existsSync(target)) {
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2));
        fs.renameSync(tmp, target);
        migrated += 1;
        log.info(`[MIGRASI] ${item.legacy} -> ${target}`);
      } catch (err) {
        log.warn(`[MIGRASI] gagal menyalin ${item.legacy}: ${err.message}`);
        continue;
      }
    }

    // Data sudah ada di target; kosongkan file lama agar working tree bersih.
    try {
      fs.writeFileSync(legacy, JSON.stringify(item.empty, null, 2));
    } catch {
      /* file lama mungkin read-only; tidak masalah */
    }
  }

  return migrated;
}

module.exports = { migrateTikTokData, LEGACY_FILES };
