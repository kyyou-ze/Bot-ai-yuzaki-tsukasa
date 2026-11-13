'use strict';

const fs = require('fs');

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const resets = [];

/**
 * Pindahkan folder sesi yang sudah dicabut WhatsApp ke `<dir>.loggedout-<waktu>`.
 *
 * Baileys memilih jalur login/registrasi hanya dari ada-tidaknya `creds.me`.
 * `requestPairingCode()` mengisi `creds.me` sebelum pairing benar-benar
 * selesai, jadi sesi setengah jadi akan terus ditolak (401) kalau dipakai
 * ulang. Memindahkan folder membuat percobaan berikutnya masuk alur pairing.
 *
 * Folder tidak dihapus supaya masih bisa diperiksa. Dibatasi `LIMIT` kali per
 * `WINDOW_MS` agar akun yang benar-benar diblokir tidak menjadi loop.
 */
function resetLoggedOutSession(dir, now = Date.now()) {
  const target = String(dir || '').trim();
  if (!target) return { ok: false, reason: 'folder sesi kosong' };

  while (resets.length && now - resets[0] > WINDOW_MS) resets.shift();
  if (resets.length >= LIMIT) {
    return { ok: false, reason: `${LIMIT}x logout dalam 10 menit` };
  }

  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const moved = `${target}.loggedout-${stamp}`;
  try {
    fs.renameSync(target, moved);
    resets.push(now);
    return { ok: true, moved };
  } catch (err) {
    // Folder belum ada: tidak ada yang perlu dipindahkan, lanjut pairing.
    if (err.code === 'ENOENT') {
      resets.push(now);
      return { ok: true, moved: '' };
    }
    return { ok: false, reason: err.message };
  }
}

/** Jumlah reset dalam jendela waktu aktif (untuk diagnostik). */
function resetCount(now = Date.now()) {
  return resets.filter((t) => now - t <= WINDOW_MS).length;
}

module.exports = { resetLoggedOutSession, resetCount, LIMIT, WINDOW_MS };
