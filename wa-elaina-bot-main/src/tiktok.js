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
  const final = await expandUrl(raw, cfg);
  return fetchVideoInfoApi(final, cfg);
}

module.exports = {
  detectTikTokUrls,
  getTikTokFromTikwm,
  getTikTok: getTikTokFromTikwm,
  downloadBytes,
  headInfo,
};
