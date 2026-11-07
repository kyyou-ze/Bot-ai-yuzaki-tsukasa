'use strict';

const { downloadBytes, headInfo } = require('./util');
const {
  desktopHeaders,
  tiktokFetch,
  fetchVideoInfoApi,
} = require('./tiktokapi');

async function detectTikTokUrls(text) {
  const t = String(text || '');
  const re = /https?:\/\/(?:vt\.|vm\.|m\.|www\.)?tiktok\.com\/[^\s<]+/gi;
  const out = [];
  let m;
  while ((m = re.exec(t))) {
    out.push(m[0].replace(/[).,!]+$/, ''));
  }
  return [...new Set(out)];
}

async function expandUrl(url, cfg = {}) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await tiktokFetch(
        url,
        {
          method,
          redirect: 'follow',
          headers: desktopHeaders(cfg),
        },
        20000,
        cfg
      );
      if (res.url) return res.url;
    } catch {
      /* ignore */
    }
  }
  return url;
}

/**
 * Ambil media TikTok lewat rantai API anti-WAF:
 * custom -> TikHub -> tiktok-api23 -> Ensig -> tiklydown -> TikWM.
 * Nama fungsi dipertahankan supaya pemanggil lama tidak perlu diubah.
 */
async function getTikTokFromTikwm(urls, cfg = {}) {
  if (!urls || urls.length === 0) throw new Error('tidak ada url tiktok valid');
  const raw = urls[0];

  // Link video/photo yang sudah lengkap tidak perlu di-expand: request ke
  // TikTok cuma menambah risiko WAF. Ekspansi hanya untuk link pendek.
  const canonical = /tiktok\.com\/@[^/]+\/(?:video|photo)\/\d{6,}/i.test(raw);
  const expanded = canonical ? raw : await expandUrl(raw, cfg).catch(() => raw);
  const candidates = [...new Set([raw, expanded].filter(Boolean))];

  let lastError = null;
  for (const url of candidates) {
    try {
      return await fetchVideoInfoApi(url, cfg);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('gagal mengambil media TikTok');
}

module.exports = {
  detectTikTokUrls,
  getTikTokFromTikwm,
  getTikTok: getTikTokFromTikwm,
  downloadBytes,
  headInfo,
};
