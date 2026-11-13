/**
 * Banner untuk plugin Kaguya (ESM).
 *
 * Memakai `contextInfo.externalAdReply`: kartu gambar + judul/deskripsi
 * ditempel ke pesan teks, jadi URL tidak perlu ditulis di badan pesan.
 */

let bannerMod = null;

async function loadBanner() {
    if (!bannerMod) {
        const mod = await import('../../src/menubanner.js');
        bannerMod = mod.default || mod;
    }
    return bannerMod;
}

const env = (key) => String(process.env[key] || '').trim();

// Thumbnail cadangan: gambar banner Tsukasa yang sudah dipakai promo.
const FALLBACK_IMAGE =
    'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png';

export function sewaBannerConfig() {
    const imageUrl =
        env('SEWA_IMAGE_URL') || env('MENU_IMAGE_URL') || env('PROMO_IMAGE_URL') || FALLBACK_IMAGE;
    const linkUrl =
        env('SEWA_LINK_URL') ||
        env('MENU_LINK_URL') ||
        env('PROMO_URL') ||
        (global.config && global.config.promo && global.config.promo.url) ||
        'https://tsukasabot-md.vercel.app';
    return { imageUrl, linkUrl };
}

/**
 * Kirim teks dengan kartu banner (link preview). Kalau thumbnail gagal
 * disiapkan, pesan tetap terkirim sebagai teks biasa.
 */
export async function sendPreview(sock, jid, text, opts = {}) {
    const { quoted = null, title, description } = opts;
    const cfg = sewaBannerConfig();
    const imageUrl = opts.imageUrl || cfg.imageUrl;
    const linkUrl = opts.linkUrl || cfg.linkUrl;

    let preview = null;
    if (imageUrl && linkUrl) {
        try {
            const banner = await loadBanner();
            preview = await banner.buildMenuPreview({
                imageUrl,
                linkUrl,
                title: title || (global.namebot || 'Tsukasa'),
                description: description || 'Sewa bot WhatsApp Tsukasa: sticker, unduhan, game grup, moderasi.',
            });
        } catch {
            preview = null;
        }
    }

    // URL target tidak ditulis ke badan pesan; kartu banner yang tampil.
    const content = { text: String(text ?? '') };
    if (preview && preview.thumbnailUrl) content.contextInfo = { externalAdReply: preview };
    return sock.sendMessage(jid, content, quoted ? { quoted } : {});
}
