'use strict';

// Banner menu/greeting memakai `contextInfo.externalAdReply`: kartu gambar
// besar (thumbnail + judul + deskripsi) yang ditempel ke pesan teks. Dengan
// cara ini WhatsApp menampilkan banner tanpa perlu menulis URL di badan pesan.
//
// Catatan: `sourceUrl` sengaja dibiarkan kosong agar tidak ada baris link/domain
// di kartu. Thumbnail diambil langsung oleh WhatsApp dari URL gambar.

// Banner cadangan kalau MENU_IMAGE_URL / PROMO_IMAGE_URL belum diisi.
const DEFAULT_BANNER_IMAGE =
  'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png';

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
 * Bangun kartu banner (objek `externalAdReply`) untuk satu URL gambar.
 * Mengembalikan null kalau URL gambar tidak valid.
 */
function buildAdReply({ imageUrl, title, description, sourceUrl } = {}) {
  const image = String(imageUrl || '').trim();
  if (!isHttpUrl(image)) return null;

  const ad = {
    title: String(title || 'Tsukasa').slice(0, 120),
    body: String(description || '').slice(0, 200),
    thumbnailUrl: image,
    mediaType: 1,
    renderLargerThumbnail: true,
  };

  // Hanya isi sourceUrl kalau memang diminta. Default kosong supaya tidak ada
  // baris link yang terlihat di kartu.
  if (isHttpUrl(sourceUrl)) ad.sourceUrl = String(sourceUrl).trim();

  return ad;
}

/**
 * Pilih kandidat gambar pertama yang valid dan bangun kartunya.
 */
function firstAdReply(opts = {}) {
  for (const imageUrl of bannerImageCandidates()) {
    const ad = buildAdReply({ ...opts, imageUrl });
    if (ad) return ad;
  }
  return null;
}

/**
 * Banner menu utama.
 * @returns {null | { title: string, body: string, thumbnailUrl: string, mediaType: number, renderLargerThumbnail: boolean, sourceUrl?: string }}
 */
async function buildMenuPreview(opts) {
  return firstAdReply(opts || {});
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
  const ad = firstAdReply(opts);
  return {
    ok: Boolean(ad),
    info: {
      imageUrl: ad ? ad.thumbnailUrl : '',
      linkUrl: bannerLinkUrl(),
      thumbnailUrl: ad ? ad.thumbnailUrl : '',
      mode: 'externalAdReply',
      error: ad ? '' : 'belum ada URL gambar banner yang valid',
      candidates,
    },
    preview: ad,
  };
}

module.exports = {
  buildAdReply,
  buildMenuPreview,
  buildGreetingPreview,
  bannerImageCandidates,
  bannerLinkUrl,
  testMenuBanner,
  isHttpUrl,
  DEFAULT_BANNER_IMAGE,
};
