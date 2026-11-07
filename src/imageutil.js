'use strict';

const { downloadBytes } = require('./util');

// sharp bersifat dependensi resmi proyek, tetapi tetap dimuat opsional supaya
// bot tidak crash di lingkungan yang belum menjalankan npm install.
let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const DEFAULTS = {
  maxBytes: 12 * 1024 * 1024,
  timeoutMs: 30000,
  maxWidth: 1600,
  quality: 82,
  compressAbove: 1200 * 1024,
};

function ascii(buf, start, end) {
  try {
    return buf.slice(start, end).toString('latin1');
  } catch {
    return '';
  }
}

function detectImageMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && ascii(buf, 1, 4) === 'PNG') return 'image/png';
  if (ascii(buf, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc') return 'image/heic';
  }
  if (ascii(buf, 0, 2) === 'BM') return 'image/bmp';
  const head = ascii(buf, 0, 64).trim().toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml')) {
    return '';
  }
  return '';
}

function looksLikeHtml(buf) {
  const head = ascii(buf, 0, 128).trim().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml');
}

async function maybeCompress(data, mime, options) {
  if (!sharp || !/^image\/(jpeg|png|webp)$/i.test(mime)) return { data, mime, compressed: false };
  const maxWidth = Math.max(320, Number(options.maxWidth) || DEFAULTS.maxWidth);
  const quality = Math.max(40, Math.min(95, Number(options.quality) || DEFAULTS.quality));
  const compressAbove = Math.max(0, Number(options.compressAbove) || DEFAULTS.compressAbove);

  try {
    const meta = await sharp(data, { animated: false }).metadata();
    const width = Number(meta.width) || 0;
    const pages = Number(meta.pages) || 1;
    const needResize = width > maxWidth;
    const needShrink = data.length > compressAbove;
    if (pages > 1 || (!needResize && !needShrink)) {
      return { data, mime, compressed: false, width, height: Number(meta.height) || 0 };
    }

    let pipeline = sharp(data, { animated: false }).rotate();
    if (needResize) pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    const out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length > 0 && out.length < data.length) {
      return { data: out, mime: 'image/jpeg', compressed: true, width, height: Number(meta.height) || 0 };
    }
    return { data, mime, compressed: false, width, height: Number(meta.height) || 0 };
  } catch {
    return { data, mime, compressed: false };
  }
}

/**
 * Unduh gambar, validasi isinya, lalu kompres bila terlalu besar.
 * Akan melempar error untuk halaman HTML / respons yang bukan gambar.
 */
async function downloadImage(url, options = {}) {
  const opts = { ...DEFAULTS, ...(options || {}) };
  const got = await downloadBytes(url, opts.maxBytes, opts.timeoutMs);
  if (!got || !got.data || got.data.length < 100) {
    throw new Error('gambar kosong/terlalu kecil');
  }
  if (looksLikeHtml(got.data)) {
    throw new Error('respons bukan gambar (HTML)');
  }

  const headerMime = String(got.mime || '').toLowerCase();
  const detected = detectImageMime(got.data);
  const mime = detected || (headerMime.startsWith('image/') ? headerMime : '');
  if (!mime) {
    throw new Error(`bukan gambar (${headerMime || 'tipe tidak dikenal'})`);
  }

  const result = await maybeCompress(got.data, mime, opts);
  return {
    data: result.data,
    mime: result.mime,
    bytes: result.data.length,
    originalBytes: got.data.length,
    compressed: result.compressed,
    width: result.width || 0,
    height: result.height || 0,
  };
}

module.exports = {
  downloadImage,
  detectImageMime,
  looksLikeHtml,
  DEFAULTS,
};
