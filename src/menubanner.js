'use strict';

// Banner menu/greeting memakai `contextInfo.externalAdReply`: kartu gambar
// besar (thumbnail + judul + deskripsi) yang ditempel ke pesan teks. Dengan
// cara ini WhatsApp menampilkan banner tanpa perlu menulis URL di badan pesan.
//
// Banner bisa berasal dari URL publik maupun file lokal. File lokal dibaca
// sebagai buffer lalu ditempel ke `externalAdReply.thumbnail`, jadi tidak perlu
// server web tambahan. Aset bawaan ada di `assets/menu/`.

const fs = require('fs');
const path = require('path');

// Banner cadangan kalau MENU_IMAGE_URL / PROMO_IMAGE_URL belum diisi.
const DEFAULT_BANNER_IMAGE =
  'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png';

// Banner lokal bawaan (menggantikan banner ALYA MD). Bisa ditimpa lewat
// MENU_IMAGE_PATH.
const DEFAULT_BANNER_PATH = path.resolve(__dirname, '..', 'assets', 'menu', 'banner-tsukasa.png');

const REPO_ROOT = path.resolve(__dirname, '..');

// Batas aman thumbnail externalAdReply. WhatsApp menerima buffer gambar, tapi
// file besar membuat pesan lambat terkirim.
const MAX_THUMBNAIL_BYTES = 900 * 1024;
const THUMBNAIL_WIDTH = 960;

// Thumbnail yang ditempel langsung ke pesan teks menu (externalAdReply)
// dikirim inline sebagai byte protobuf. Gambar besar membuat pesan ditolak,
// jadi kartu menu diperkecil dulu: kartunya tetap tampil, teks tetap terkirim.
const MENU_THUMBNAIL_WIDTH = 360;
const MENU_THUMBNAIL_QUALITY = 70;

function expandPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const unquoted = raw.replace(/^["']|["']$/g, '');
  const expanded = unquoted.startsWith('~')
    ? path.join(process.env.HOME || '', unquoted.slice(1))
    : unquoted;
  return path.isAbsolute(expanded) ? expanded : path.resolve(REPO_ROOT, expanded);
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalFile(value) {
  const expanded = expandPath(value);
  if (!expanded) return false;
  try {
    return fs.statSync(expanded).isFile();
  } catch {
    return false;
  }
}

function bannerImageCandidates() {
  const entries = [
    process.env.MENU_IMAGE_PATH,
    process.env.MENU_IMAGE_URL,
    process.env.PROMO_IMAGE_URL,
    DEFAULT_BANNER_PATH,
    DEFAULT_BANNER_IMAGE,
  ];
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const value = String(entry || '').trim();
    if (!value) continue;
    const key = isHttpUrl(value) ? value : expandPath(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function bannerLinkUrl() {
  return String(process.env.MENU_LINK_URL || process.env.PROMO_URL || '').trim();
}

let sharpModule;
function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    // sharp opsional: kalau tidak terpasang, banner memakai file apa adanya.
    sharpModule = require('sharp');
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

async function readImageBuffer(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  if (buffer.length <= MAX_THUMBNAIL_BYTES) return buffer;

  const sharp = getSharp();
  if (!sharp) return buffer;
  try {
    return await sharp(buffer)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * Bangun kartu banner (objek `externalAdReply`).
 *
 * Urutan sumber gambar: `thumbnail` (buffer siap pakai) → `imagePath` (file
 * lokal) → `imageUrl` (URL publik atau path file). Mengembalikan null kalau
 * tidak ada gambar yang valid.
 */
async function buildAdReply({ imageUrl, imagePath, thumbnail, title, description, sourceUrl } = {}) {
  const ad = {
    title: String(title || 'Tsukasa').slice(0, 120),
    body: String(description || '').slice(0, 200),
    mediaType: 1,
    renderLargerThumbnail: true,
  };

  let thumb = Buffer.isBuffer(thumbnail) && thumbnail.length ? thumbnail : null;
  if (!thumb) {
    const localCandidate = imagePath || (!isHttpUrl(imageUrl) ? imageUrl : '');
    if (localCandidate && isLocalFile(localCandidate)) {
      try {
        thumb = await readImageBuffer(expandPath(localCandidate));
      } catch {
        thumb = null;
      }
    }
  }

  if (thumb) {
    ad.thumbnail = thumb;
  } else if (isHttpUrl(imageUrl)) {
    ad.thumbnailUrl = String(imageUrl).trim();
  } else {
    return null;
  }

  // Hanya isi sourceUrl kalau memang diminta. Default kosong supaya tidak ada
  // baris link yang terlihat di kartu.
  if (isHttpUrl(sourceUrl)) ad.sourceUrl = String(sourceUrl).trim();

  return ad;
}

/**
 * Pilih kandidat gambar pertama yang valid dan bangun kartunya.
 */
async function firstAdReply(opts = {}) {
  for (const imageUrl of bannerImageCandidates()) {
    const ad = await buildAdReply({ ...opts, imageUrl });
    if (ad) return ad;
  }
  return null;
}

/** Perkecil thumbnail kartu menu agar aman ditempel ke pesan teks. */
async function compactMenuThumbnail(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return buffer;
  const sharp = getSharp();
  if (!sharp) return buffer;
  try {
    return await sharp(buffer)
      .resize({ width: MENU_THUMBNAIL_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: MENU_THUMBNAIL_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * Banner menu utama. Thumbnail diperkecil supaya kartu bisa menyatu dengan
 * teks menu tanpa membuat pesan ditolak WhatsApp.
 * @returns {Promise<null | { title: string, body: string, thumbnail?: Buffer, thumbnailUrl?: string, mediaType: number, renderLargerThumbnail: boolean, sourceUrl?: string }>}
 */
async function buildMenuPreview(opts) {
  const ad = await firstAdReply(opts || {});
  if (ad && Buffer.isBuffer(ad.thumbnail)) {
    ad.thumbnail = await compactMenuThumbnail(ad.thumbnail);
  }
  return ad;
}

/**
 * Banner menu teknik ALYA/Kaguya: kartu *link preview* yang menempel pada
 * pesan teks menu lewat `extendedTextMessage.linkPreview` (WAUrlInfo).
 *
 * Ini berbeda dari `externalAdReply`. Kartu link preview adalah bagian dari
 * pesan teks itu sendiri, sehingga WhatsApp tetap merender seluruh teks menu
 * walaupun panjang — guild yang dulu memakai externalAdReply membuat bubble
 * teksnya hilang dan yang tampil cuma voice note.
 *
 * Baris URL ditaruh di awal teks oleh router dan `matched-text` diisi URL yang
 * sama supaya WhatsApp mengaitkan kartu ke baris tersebut.
 */
async function buildMenuLinkPreview({ title, description } = {}) {
  const ad = await buildMenuPreview({ title, description });
  const url = bannerLinkUrl() || DEFAULT_BANNER_IMAGE;
  const info = {
    'matched-text': url,
    'canonical-url': url,
    title: String(title || 'Tsukasa').slice(0, 120),
    description: String(description || '').slice(0, 200),
  };
  if (ad && Buffer.isBuffer(ad.thumbnail) && ad.thumbnail.length) {
    // WAUrlInfo.jpegThumbnail bertipe string base64 (bukan Buffer).
    info.jpegThumbnail = ad.thumbnail.toString('base64');
  }
  return info;
}

/**
 * Banner untuk welcome/goodbye. URL target tidak ikut ditulis ke badan pesan,
 * jadi yang terlihat hanya kartu gambar/teks, bukan alamat web.
 */
async function buildGreetingPreview({ title, description } = {}) {
  return firstAdReply({
    title: title || 'Tsukasa',
    description: description || 'Bot WhatsApp Tsukasa.',
  });
}

/**
 * Tes banner tanpa mengirim menu. Dipakai `.menu banner` untuk mendiagnosis
 * kenapa gambar tidak muncul.
 */
async function testMenuBanner(opts = {}) {
  const candidates = bannerImageCandidates();
  const ad = await firstAdReply(opts);
  const imageSource = ad ? ad.thumbnailUrl || ad.thumbnail || '' : '';
  const isBuffer = Boolean(ad && Buffer.isBuffer(ad.thumbnail));
  return {
    ok: Boolean(ad),
    info: {
      imageUrl: isBuffer ? `(lokal ${ad.thumbnail.length} byte)` : String(imageSource || ''),
      linkUrl: bannerLinkUrl(),
      thumbnailUrl: ad ? String(imageSource || '') : '',
      mode: isBuffer ? 'externalAdReply (thumbnail buffer)' : 'externalAdReply',
      error: ad ? '' : 'belum ada gambar banner yang valid',
      candidates: candidates.map((c) => (isHttpUrl(c) ? c : expandPath(c))),
    },
    preview: ad,
  };
}

module.exports = {
  buildAdReply,
  buildMenuPreview,
  buildMenuLinkPreview,
  buildGreetingPreview,
  bannerImageCandidates,
  bannerLinkUrl,
  testMenuBanner,
  isHttpUrl,
  isLocalFile,
  expandPath,
  DEFAULT_BANNER_IMAGE,
  DEFAULT_BANNER_PATH,
};
