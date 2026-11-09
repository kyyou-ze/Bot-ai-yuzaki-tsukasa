'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./logger');

// Baileys' useMultiFileAuthState menulis file langsung (writeFile) tanpa
// rename. Kalau proses berhenti atau disk penuh di tengah penulisan, file JSON
// bisa setengah jadi. Wrapper ini menulis lewat file sementara + rename dan
// mengulang sekali, lalu mencatat error asli (kode + path) supaya penyebab
// "transaction failed, rolling back" tidak lagi buta.
function fixFileName(file) {
  return String(file || '').replace(/\//g, '__').replace(/:/g, '-');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJsonAtomic(file, data, BufferJSON) {
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(tmp, JSON.stringify(data, BufferJSON.replacer));
    await fs.promises.rename(tmp, file);
  } catch (err) {
    await fs.promises.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

async function writeWithRetry(file, data, BufferJSON, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await writeJsonAtomic(file, data, BufferJSON);
      return;
    } catch (err) {
      lastError = err;
      log.warn(
        `[WA:AUTH] tulis ${path.basename(file)} gagal (percobaan ${i + 1}/${attempts}):`,
        err.code ? `${err.code} ` : '',
        err.message
      );
      if (i + 1 < attempts) await sleep(150 * (i + 1));
    }
  }
  throw lastError;
}

/**
 * Ganti keys.set dari useMultiFileAuthState dengan versi atomik + retry.
 * keys.get, creds, dan saveCreds tetap memakai implementasi Baileys.
 */
function hardenAuthState(baileys, state, sessionDir) {
  if (!state || !state.keys || typeof state.keys.set !== 'function') return state;
  const BufferJSON = baileys && baileys.BufferJSON;
  if (!BufferJSON || !BufferJSON.replacer) {
    log.warn('[WA:AUTH] BufferJSON tidak tersedia; auth state tidak di-hardening.');
    return state;
  }

  const dir = path.resolve(sessionDir);
  state.keys.set = async (data) => {
    const tasks = [];
    for (const category of Object.keys(data || {})) {
      for (const id of Object.keys(data[category] || {})) {
        const value = data[category][id];
        const file = path.join(dir, fixFileName(`${category}-${id}.json`));
        if (value) {
          tasks.push(writeWithRetry(file, value, BufferJSON).catch((err) => {
            err.message = `${err.code ? `${err.code}: ` : ''}${err.message} (${file})`;
            throw err;
          }));
        } else {
          tasks.push(fs.promises.unlink(file).catch(() => {}));
        }
      }
    }
    await Promise.all(tasks);
  };
  return state;
}

module.exports = { hardenAuthState };
