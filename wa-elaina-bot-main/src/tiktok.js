'use strict';

const { downloadBytes, headInfo } = require('./util');

const TIKWM_API = 'https://www.tikwm.com/api/';

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

async function expandUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'wa-tsukasa-bot/2.0' },
    });
    if (res.url) return res.url;
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'wa-tsukasa-bot/2.0' },
    });
    if (res.url) return res.url;
  } catch {
    /* ignore */
  }
  return url;
}

async function getFromTikwm(link) {
  const api = `${TIKWM_API}?url=${encodeURIComponent(link)}`;
  const res = await fetch(api, { headers: { Accept: 'application/json', 'User-Agent': 'wa-tsukasa-bot/2.0' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`tikwm HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const data = json && json.data ? json.data : {};
  return {
    video: String(data.play || '').trim(),
    audio: String(data.music || '').trim(),
    images: Array.isArray(data.images) ? data.images.filter(Boolean) : [],
  };
}

async function getTikTokFromTikwm(urls) {
  if (!urls || urls.length === 0) throw new Error('tidak ada url tiktok valid');
  const raw = urls[0];
  const final = await expandUrl(raw);
  return getFromTikwm(final);
}

module.exports = { detectTikTokUrls, getTikTokFromTikwm, downloadBytes, headInfo };
