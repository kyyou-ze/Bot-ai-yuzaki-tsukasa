'use strict';

// Menu audio (voice note) — dikirim setelah pesan menu utama.
// ALYA MD mengirim menu beserta VN; di sini audionya memakai aset lokal
// `assets/menu/menu-music.mp3` dan dikonversi ke opus/ogg lewat ffmpeg agar
// tampil sebagai voice note. Kalau ffmpeg tidak tersedia, audio dikirim apa
// adanya sebagai file audio biasa (bukan PTT).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const wa = require('./wa');

const DEFAULT_PATH = 'assets/menu/menu-music.mp3';
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

let cache = null;
let convertBroken = false;

function enabled() {
  const raw = String(process.env.MENU_AUDIO ?? 'false').trim().toLowerCase();
  return !['0', 'false', 'off', 'no', 'nonaktif', 'mati'].includes(raw);
}

function expandPath(value) {
  let out = String(value || '').trim();
  if (!out) return '';
  if (out === '~') out = require('os').homedir();
  else if (out.startsWith('~/') || out.startsWith('~\\')) {
    out = path.join(require('os').homedir(), out.slice(2));
  }
  return path.isAbsolute(out) ? out : path.resolve(process.cwd(), out);
}

function audioPath() {
  return expandPath(process.env.MENU_AUDIO_PATH || DEFAULT_PATH);
}

function convertToOpus(input) {
  return new Promise((resolve, reject) => {
    const bin = process.env.FFMPEG_PATH || 'ffmpeg';
    const proc = spawn(
      bin,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-vn',
        '-c:a',
        'libopus',
        '-b:a',
        '64k',
        '-vbr',
        'on',
        '-f',
        'ogg',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const chunks = [];
    const errors = [];
    let size = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      try {
        proc.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(err);
    };

    const timer = setTimeout(() => fail(new Error('ffmpeg timeout')), 45_000);
    timer.unref?.();

    proc.on('error', (err) => {
      clearTimeout(timer);
      fail(err);
    });
    proc.stderr.on('data', (chunk) => {
      if (errors.length < 20) errors.push(String(chunk));
    });
    proc.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) {
        fail(new Error('hasil konversi terlalu besar'));
        return;
      }
      chunks.push(chunk);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        fail(new Error(errors.join('').trim().slice(-500) || `ffmpeg exit ${code}`));
        return;
      }
      settled = true;
      const out = Buffer.concat(chunks);
      if (!out.length) {
        reject(new Error('ffmpeg menghasilkan audio kosong'));
        return;
      }
      resolve(out);
    });

    proc.stdin.on('error', () => {});
    proc.stdin.end(input);
  });
}

/**
 * Kirim voice note menu ke chat. Tidak melempar error agar kegagalan audio
 * tidak menggagalkan pengiriman menu.
 * @returns {Promise<boolean>} true kalau ada audio yang dikirim
 */
async function sendMenuAudio(sock, jid, quoted) {
  if (!enabled() || !sock || typeof sock.sendMessage !== 'function') return false;

  const file = audioPath();
  let source;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) return false;
    source = fs.readFileSync(file);
  } catch {
    return false;
  }

  let audio = source;
  let mimetype = 'audio/mpeg';
  let ptt = false;

  if (!convertBroken) {
    try {
      const key = `${file}:${source.length}`;
      if (cache && cache.key === key) {
        audio = cache.audio;
        mimetype = cache.mimetype;
        ptt = true;
      } else {
        const converted = await convertToOpus(source);
        audio = converted;
        mimetype = 'audio/ogg; codecs=opus';
        ptt = true;
        cache = { key, audio: converted, mimetype };
      }
    } catch (err) {
      // Jangan coba spawn ffmpeg lagi pada setiap menu kalau binernya tidak ada.
      if (err && (err.code === 'ENOENT' || /ENOENT|not found/i.test(err.message || ''))) {
        convertBroken = true;
      }
      console.warn('[MENU AUDIO] konversi opus gagal, kirim audio biasa:', err?.message || err);
    }
  }

  try {
    await wa.sendMessage(
      jid,
      { audio, mimetype, ptt, ...(ptt ? {} : { fileName: path.basename(file) }) },
      quoted || null
    );
    return true;
  } catch (err) {
    console.warn('[MENU AUDIO] gagal kirim:', err?.message || err);
    return false;
  }
}

module.exports = {
  enabled,
  audioPath,
  sendMenuAudio,
};
