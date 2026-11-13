'use strict';

const log = require('./logger');
const wa = require('./wa');
const { downloadImage } = require('./imageutil');

// Kartu preview link untuk menu. Gambar diunduh sekali, dikompres, lalu
// di-upload sebagai highQualityThumbnail. Tanpa upload itu, WhatsApp Android
// sering hanya menampilkan teks tanpa gambar.
const CACHE_TTL_MS = 30 * 60 * 1000;
// jpegThumbnail cukup kecil; highQualityThumbnail yang membawa versi besar.
const MAX_THUMB_BYTES = 256 * 1024;

// Banner cadangan kalau MENU_IMAGE_URL / PROMO_IMAGE_URL belum diisi.
const DEFAULT_BANNER_IMAGE =
  'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png';

let cache = { url: '', link: '', at: 0, value: null };

function bannerImageCandidates() {
  return [
    ...new Set(
      [process.env.MENU_IMAGE_URL, process.env.PROMO_IMAGE_URL, DEFAULT_BANNER_IMAGE]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    ),
  ];
}

function bannerLinkUrl() {
  return String(process.env.MENU_LINK_URL || process.env.PROMO_URL || '').trim();
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Pastikan thumbnail berupa JPEG. sharp dipakai imageutil, tapi kalau tidak
 * tersedia kita coba @napi-rs/canvas sebagai cadangan.
 */
async function toJpegThumb(img) {
  if (!img || !img.data || !img.data.length) return null;
  if (img.mime === 'image/jpeg') return img.data;
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const src = await loadImage(img.data);
    const srcW = Number(src.width) || 640;
    const srcH = Number(src.height) || srcW;
    const width = Math.max(1, Math.min(720, srcW));
    const height = Math.max(1, Math.round((srcH / srcW) * width));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0, width, height);
    if (typeof canvas.encode === 'function') return await canvas.encode('image/jpeg', 72);
    return canvas.toBuffer('image/jpeg');
  } catch (err) {
    log.warn('[MENU] gagal membuat thumbnail JPEG:', err && err.message ? err.message : err);
    return null;
  }
}

/**
 * Bangun data preview + info diagnostik. Tidak melempar error supaya menu
 * tetap terkirim walau banner gagal.
 */
async function resolvePreview({ imageUrl, linkUrl, title, description }) {
  const image = String(imageUrl || '').trim();
  const info = {
    imageUrl: image,
    linkUrl: '',
    downloaded: false,
    mime: '',
    originalBytes: 0,
    thumbBytes: 0,
    hqUploaded: false,
    error: '',
  };

  if (!isHttpUrl(image)) {
    info.error = 'MENU_IMAGE_URL belum diisi atau bukan URL http/https';
    return { preview: null, info };
  }

  const link = isHttpUrl(linkUrl) ? String(linkUrl).trim() : image;
  info.linkUrl = link;

  const now = Date.now();
  if (cache.url === image && cache.link === link && now - cache.at < CACHE_TTL_MS && cache.value) {
    info.cached = true;
    return { preview: cache.value, info: { ...info, ...(cache.value.__info || {}) } };
  }

  let img;
  try {
    img = await downloadImage(image, {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 20000,
      maxWidth: 720,
      quality: 72,
      compressAbove: 1,
    });
  } catch (err) {
    info.error = `gagal unduh gambar: ${err && err.message ? err.message : err}`;
    log.warn('[MENU] banner gagal dimuat:', info.error);
    cache = { url: image, link, at: now, value: null };
    return { preview: null, info };
  }

  info.downloaded = true;
  info.mime = img.mime;
  info.originalBytes = img.originalBytes || (img.data && img.data.length) || 0;

  const thumb = await toJpegThumb(img);
  if (thumb && thumb.length) info.thumbBytes = thumb.length;

  const preview = {
    'canonical-url': link,
    'matched-text': link,
    title: String(title || 'Menu').slice(0, 120),
    description: String(description || '').slice(0, 200),
  };
  if (thumb && thumb.length && thumb.length <= MAX_THUMB_BYTES) {
    preview.jpegThumbnail = thumb;
  }

  // Upload versi besar ke server WhatsApp. Ini yang membuat kartu gambar
  // tampil di Android.
  try {
    const hq = await wa.buildLinkThumbnail(img.data, img.mime);
    if (hq) {
      preview.highQualityThumbnail = hq;
      info.hqUploaded = true;
      const small = hq.jpegThumbnail ? Buffer.from(hq.jpegThumbnail) : null;
      if (small && small.length && small.length <= MAX_THUMB_BYTES) {
        preview.jpegThumbnail = small;
        info.thumbBytes = small.length;
      }
    }
  } catch (err) {
    info.error = `upload thumbnail gagal: ${err && err.message ? err.message : err}`;
    log.warn('[MENU]', info.error);
  }

  Object.defineProperty(preview, '__info', { value: info, enumerable: false });
  cache = { url: image, link, at: now, value: preview };
  return { preview, info };
}

/**
 * Bangun objek WAUrlInfo untuk `linkPreview`.
 * @returns {Promise<null | { 'canonical-url': string, 'matched-text': string, title: string, description?: string, jpegThumbnail?: Buffer, highQualityThumbnail?: object }>}
 */
async function buildMenuPreview(opts) {
  const { preview } = await resolvePreview(opts || {});
  return preview;
}

/**
 * Banner untuk welcome/goodbye. Link target tidak ikut ditulis ke badan pesan,
 * jadi yang terlihat hanya kartu preview (judul/deskripsi), bukan URL panjang.
 */
async function buildGreetingPreview({ title, description } = {}) {
  const linkUrl = bannerLinkUrl();
  for (const imageUrl of bannerImageCandidates()) {
    const preview = await buildMenuPreview({
      imageUrl,
      linkUrl: linkUrl || imageUrl,
      title: title || 'Tsukasa',
      description: description || 'Bot WhatsApp Tsukasa.',
    });
    if (preview) return preview;
  }
  return null;
}

/**
 * Tes banner tanpa mengirim menu. Dipakai `.menu banner` untuk mendiagnosis
 * kenapa gambar tidak muncul.
 */
async function testMenuBanner(opts) {
  const { preview, info } = await resolvePreview(opts || {});
  return { ok: Boolean(preview), info, preview };
}

module.exports = {
  buildMenuPreview,
  buildGreetingPreview,
  bannerImageCandidates,
  bannerLinkUrl,
  testMenuBanner,
  isHttpUrl,
  DEFAULT_BANNER_IMAGE,
};
