'use strict';

const sharp = require('sharp');

const wa = require('../wa');
const log = require('../logger');
const { UA, fetchWithTimeout } = require('../util');
const { extractSticker } = require('./stickerutils');

const SIZE = 512;
const MAX_STICKER_BYTES = 5 * 1024 * 1024;

// Google merilis kombinasi Emoji Kitchen bertahap per tanggal. Kombinasi lama
// tetap ada di folder tanggal lamanya, jadi kita coba beberapa tanggal sekaligus.
const EMOJI_KITCHEN_DATES = [
  '20201001',
  '20210218',
  '20210521',
  '20210831',
  '20211115',
  '20220110',
  '20220203',
  '20220406',
  '20220823',
  '20221101',
  '20230127',
  '20230301',
  '20230803',
  '20231101',
  '20240109',
  '20240207',
  '20240402',
  '20240603',
  '20240805',
  '20241001',
  '20241202',
  '20250203',
];

const EMOJI_RE = /\p{Extended_Pictographic}/u;

const COMMANDS = new Set([
  'emojimix',
  'emojikitchen',
  'flip',
  'mirror',
  'flipv',
  'rotate',
  'putar',
  'grayscale',
  'gray',
  'greyscale',
  'bw',
  'blur',
  'crop',
  'resize',
  'small',
  'invert',
  'negate',
]);

function graphemes(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(raw), (part) => part.segment);
  } catch {
    return Array.from(raw);
  }
}

function parseEmojis(text) {
  const raw = String(text || '').replace(/\+/g, ' ');
  return graphemes(raw)
    .filter((part) => part && part.trim() && EMOJI_RE.test(part))
    .slice(0, 2);
}

function emojiCodeVariants(emoji) {
  const cps = [...String(emoji || '')].map(
    (ch) => 'u' + ch.codePointAt(0).toString(16)
  );
  const stripped = cps.filter((code) => code !== 'ufe0f');
  return [...new Set([stripped.join('-'), cps.join('-')])].filter(Boolean);
}

async function tryUrls(urls) {
  if (urls.length === 0) return null;
  const attempts = urls.map(async (url) => {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 12000);
    if (!res.ok) throw new Error(`http ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 256 || buf.length > MAX_STICKER_BYTES) {
      throw new Error('ukuran gambar tidak valid');
    }
    return buf;
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

function kitchenUrls(leftCodes, rightCodes) {
  const urls = [];
  for (const [x, y] of [
    [leftCodes, rightCodes],
    [rightCodes, leftCodes],
  ]) {
    for (const date of EMOJI_KITCHEN_DATES) {
      urls.push(
        `https://www.gstatic.com/android/keyboard/emojikitchen/${date}/${x}/${x}_${y}.png`
      );
    }
  }
  return urls;
}

async function fetchEmojiMix(left, right) {
  const leftVariants = emojiCodeVariants(left);
  const rightVariants = emojiCodeVariants(right);
  if (leftVariants.length === 0 || rightVariants.length === 0) return null;

  // Tahap 1: versi tanpa variation selector (paling umum).
  let png = await tryUrls(kitchenUrls(leftVariants[0], rightVariants[0]));
  if (png) return png;

  // Tahap 2: kombinasi variant lain (mis. emoji yang menyimpan FE0F).
  const extra = [];
  for (const a of leftVariants) {
    for (const b of rightVariants) {
      if (a === leftVariants[0] && b === rightVariants[0]) continue;
      extra.push(...kitchenUrls(a, b));
    }
  }
  png = await tryUrls(extra);
  return png;
}

async function extractMedia(content, m, chat) {
  const sticker = await extractSticker(content, m, chat);
  if (sticker) return { buf: sticker, source: 'sticker' };

  if (content && content.imageMessage) {
    const buf = await wa.downloadMedia({ key: m.key, message: content });
    if (buf && buf.length) return { buf, source: 'image' };
  }

  const quoted = wa.quotedContent(wa.contextInfoOf(content));
  if (quoted && quoted.imageMessage) {
    const buf = await wa.downloadQuoted(quoted, chat, m.key.participant || chat);
    if (buf && buf.length) return { buf, source: 'image' };
  }
  return null;
}

function clampNumber(value, def, min, max) {
  const n = Number(String(value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

class StickerTransformFeature {
  constructor(cfg) {
    this.cfg = cfg || {};
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  async metaOf(buf) {
    const meta = await sharp(buf).metadata();
    const pages = Number(meta.pages || 1);
    return {
      meta,
      pages,
      animated: pages > 1,
      width: Number(meta.width || SIZE),
      height: Number(meta.pageHeight || meta.height || SIZE),
    };
  }

  async encode(buf, animated, apply) {
    let img = sharp(buf, { animated });
    if (apply) img = apply(img);
    return img
      .webp({
        quality: 82,
        effort: 4,
        ...(animated ? { loop: 0 } : {}),
      })
      .toBuffer();
  }

  async sendResult(chat, m, buf) {
    if (!buf || buf.length === 0) throw new Error('hasil kosong');
    if (buf.length > MAX_STICKER_BYTES) throw new Error('sticker hasil terlalu besar');
    await wa.sendSticker(chat, buf, m);
  }

  async transform(chat, m, content, cmd, rest) {
    const found = await extractMedia(content, m, chat);
    if (!found) {
      await wa
        .sendText(chat, 'Reply sticker/gambar lalu kirim command transformasinya.', m)
        .catch(() => {});
      return;
    }

    const { buf } = found;
    const info = await this.metaOf(buf);

    let webp;
    if (cmd === 'flip' || cmd === 'mirror') {
      // Sharp: flop() = cermin horizontal.
      webp = await this.encode(buf, info.animated, (img) => img.flop());
    } else if (cmd === 'flipv') {
      webp = await this.encode(buf, info.animated, (img) => img.flip());
    } else if (cmd === 'rotate' || cmd === 'putar') {
      const angle = clampNumber(rest, 90, -360, 360);
      const animated = info.animated && Math.abs(angle) % 90 === 0;
      webp = await this.encode(buf, animated, (img) =>
        img.rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      );
    } else if (['grayscale', 'gray', 'greyscale', 'bw'].includes(cmd)) {
      webp = await this.encode(buf, info.animated, (img) => img.grayscale());
    } else if (cmd === 'invert' || cmd === 'negate') {
      webp = await this.encode(buf, info.animated, (img) => img.negate());
    } else if (cmd === 'blur') {
      const sigma = clampNumber(rest, 8, 0.3, 100);
      webp = await this.encode(buf, info.animated, (img) => img.blur(sigma));
    } else if (cmd === 'crop') {
      const size = Math.max(1, Math.min(info.width, info.height));
      webp =
        info.width === info.height
          ? await this.encode(buf, info.animated)
          : await this.encode(buf, info.animated, (img) =>
              img.extract({
                left: Math.floor((info.width - size) / 2),
                top: Math.floor((info.height - size) / 2),
                width: size,
                height: size,
              })
            );
    } else if (['resize', 'small'].includes(cmd)) {
      const target = clampNumber(rest, 320, 16, 1024);
      const scale = Math.min(1, target / Math.max(info.width, info.height));
      const width = Math.max(1, Math.round(info.width * scale));
      const height = Math.max(1, Math.round(info.height * scale));
      webp = await this.encode(buf, info.animated, (img) =>
        img.resize(width, height, { fit: 'fill' })
      );
    }

    if (!webp) throw new Error('transformasi tidak dikenal');
    await this.sendResult(chat, m, webp);
  }

  async emojiMix(chat, m, content, rest) {
    let emojis = parseEmojis(rest);
    if (emojis.length < 2) {
      const quoted = wa.quotedContent(wa.contextInfoOf(content));
      if (quoted) emojis = parseEmojis(wa.extractText(quoted));
    }
    if (emojis.length < 2) {
      await wa
        .sendText(
          chat,
          'Gunakan: *.emojimix <emoji1> <emoji2>*\nContoh: .emojimix 😀 😍',
          m
        )
        .catch(() => {});
      return;
    }

    const png = await fetchEmojiMix(emojis[0], emojis[1]);
    if (!png) {
      await wa
        .sendText(
          chat,
          `Kombinasi *${emojis[0]} + ${emojis[1]}* tidak tersedia di Emoji Kitchen. Coba pasangan emoji lain.`,
          m
        )
        .catch(() => {});
      return;
    }

    const webp = await sharp(png)
      .resize(SIZE, SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
    await wa.sendSticker(chat, webp, m);
  }

  async handle(sock, m, content, cmd, rest) {
    const chat = m.key.remoteJid;
    if (!chat) return false;
    const name = String(cmd || '').toLowerCase();
    if (!StickerTransformFeature.isCommand(name)) return false;

    try {
      if (name === 'emojimix' || name === 'emojikitchen') {
        await this.emojiMix(chat, m, content, rest);
        return true;
      }
      await this.transform(chat, m, content, name, rest);
      return true;
    } catch (err) {
      log.error(`[STICKERTRANSFORM] ${name} gagal: ${err.message}`);
      await wa
        .sendText(chat, `Gagal memproses *.${name}*: ${err.message}`, m)
        .catch(() => {});
      return true;
    }
  }
}

module.exports = { StickerTransformFeature };
