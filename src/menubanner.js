'use strict';

const log = require('./logger');
const { downloadImage } = require('./imageutil');

// Kartu preview link untuk menu. Gambar diunduh sekali, dikompres jadi JPEG
// kecil, lalu dipakai sebagai thumbnail. Bukan foto yang dikirim terpisah,
// jadi WhatsApp menampilkannya sebagai banner berbentuk link preview.
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_THUMB_BYTES = 100 * 1024;

let cache = { url: '', at: 0, value: null };

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Pastikan thumbnail berupa JPEG. sharp sudah dipakai imageutil, tapi kalau
 * tidak tersedia kita coba @napi-rs/canvas sebagai cadangan.
 */
async function toJpegThumb(img) {
  if (!img || !img.data || !img.data.length) return null;
  if (img.mime === 'image/jpeg') return img.data;
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const src = await loadImage(img.data);
    const srcW = Number(src.width) || 640;
    const srcH = Number(src.height) || srcW;
    const width = Math.max(1, Math.min(400, srcW));
    const height = Math.max(1, Math.round((srcH / srcW) * width));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0, width, height);
    if (typeof canvas.encode === 'function') return await canvas.encode('image/jpeg', 70);
    return canvas.toBuffer('image/jpeg');
  } catch (err) {
    log.warn('[MENU] gagal membuat thumbnail JPEG:', err && err.message ? err.message : err);
    return null;
  }
}

/**
 * Bangun objek WAUrlInfo untuk `linkPreview`.
 * @returns {Promise<null | { 'canonical-url': string, 'matched-text': string, title: string, description?: string, jpegThumbnail?: Buffer }>}
 */
async function buildMenuPreview({ imageUrl, linkUrl, title, description }) {
  const image = String(imageUrl || '').trim();
  if (!isHttpUrl(image)) return null;

  const now = Date.now();
  if (cache.url === image && now - cache.at < CACHE_TTL_MS) return cache.value;

  const link = isHttpUrl(linkUrl) ? String(linkUrl).trim() : image;
  let preview = null;

  try {
    const img = await downloadImage(image, {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 20000,
      maxWidth: 400,
      quality: 60,
      compressAbove: 1,
    });
    const thumb = await toJpegThumb(img);
    preview = {
      'canonical-url': link,
      'matched-text': link,
      title: String(title || 'Menu').slice(0, 120),
      description: String(description || '').slice(0, 200),
    };
    if (thumb && thumb.length && thumb.length <= MAX_THUMB_BYTES) {
      preview.jpegThumbnail = thumb;
    }
  } catch (err) {
    log.warn('[MENU] banner gagal dimuat:', err && err.message ? err.message : err);
    preview = null;
  }

  cache = { url: image, at: now, value: preview };
  return preview;
}

module.exports = { buildMenuPreview, isHttpUrl };
