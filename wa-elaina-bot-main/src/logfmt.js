'use strict';

/** Ubah teks multi-baris jadi satu baris rapi untuk log panel. */
function oneLine(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ringkas error agar panel tidak penuh rantai provider/URL panjang.
 * Contoh: "API: tikwm HTTP 403 | Jina: timeout | HTML: WAF" -> satu pesan.
 */
function shortError(err, max = 160) {
  let text = oneLine(err && err.message ? err.message : err);
  const parts = text.split(' | ').filter(Boolean);
  if (parts.length > 1) {
    text = `${parts[0]} (+${parts.length - 1} sumber gagal)`;
  }
  text = text.replace(/https?:\/\/\S+/gi, '[url]');
  if (max > 0 && text.length > max) {
    text = text.slice(0, max - 1).trimEnd() + '…';
  }
  return text || 'error tidak diketahui';
}

module.exports = { oneLine, shortError };
