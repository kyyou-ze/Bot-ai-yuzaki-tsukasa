'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');

const wa = require('../wa');
const {
  downloadBytes,
  escapeXml,
  fileExists,
  publicPath,
  isGroupJid,
} = require('../util');

// ---------------- ffmpeg helper ----------------
// Pterodactyl Node egg biasanya tidak punya ffmpeg sistem. Pakai binary
// portable dari paket ffmpeg-static bila tersedia, lalu fallback ke PATH.
function resolveFfmpeg() {
  const explicit = String(process.env.FFMPEG_PATH || '').trim();
  if (explicit) return explicit;
  try {
    const bundled = require('ffmpeg-static');
    if (bundled) return bundled;
  } catch {
    /* paket tidak terpasang */
  }
  return 'ffmpeg';
}

const FFMPEG = resolveFfmpeg();

function runFfmpeg(args, timeoutMs = 75000) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffmpeg timeout'));
    }, timeoutMs);
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 5000) stderr = stderr.slice(-5000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg error: ${stderr.slice(-400)}`));
    });
  });
}

function getEnv(key, def) {
  const v = String(process.env[key] || '').trim();
  return v || def;
}

function intEnv(key, def) {
  const n = parseInt(getEnv(key, String(def)), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function nameToSvg(text, width, height) {
  const label = escapeXml(text);
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="rgba(0,0,0,0.55)"/>` +
      `<text x="${width - 12}" y="${Math.round(height / 2) + 9}" ` +
      `font-family="DejaVu Sans, Arial, sans-serif" font-size="${Math.max(14, Math.round(height / 2.6))}" ` +
      `fill="rgba(255,255,255,0.92)" text-anchor="end">${label}</text></svg>`
  );
}

async function staticToWebp(input, watermark) {
  const meta = await sharp(input).metadata();
  const animated = Number(meta.pages || 1) > 1;

  let base = sharp(input, { animated });
  base = base.rotate().resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const composites = [];
  if (watermark.image && fileExists(watermark.image)) {
    const scale = intEnv('STICKER_WM_IMG_SCALE', 128);
    const wm = await sharp(watermark.image)
      .resize(scale, scale, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    composites.push({ input: wm, gravity: 'southeast' });
  } else if (watermark.text) {
    const svg = nameToSvg(watermark.text, 512, 46);
    composites.push({ input: svg, top: 512 - 46, left: 0 });
  }

  if (composites.length) base = base.composite(composites);
  return base.webp({ quality: 80, effort: 4 }).toBuffer();
}

async function videoToWebp(inputBuffer, watermark) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticker-'));
  const inFile = path.join(tmpDir, 'in.bin');
  const outFile = path.join(tmpDir, 'out.webp');
  try {
    fs.writeFileSync(inFile, inputBuffer);
    const base =
      'fps=15,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,' +
      'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
    let vf = base;
    if (watermark.text) {
      const escaped = String(watermark.text)
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'");
      const fontSize = intEnv('STICKER_WM_SIZE', 18);
      const margin = intEnv('STICKER_WM_MARGIN', 12);
      const alpha = Number(getEnv('STICKER_WM_ALPHA', '0.8'));
      vf +=
        `,drawtext=text='${escaped}':fontcolor=white@${alpha}:fontsize=${fontSize}:` +
        `box=1:boxcolor=0x00000088:boxborderw=6:x=w-tw-${margin}:y=h-th-${margin}`;
    }
    const args = [
      '-y',
      '-i',
      inFile,
      '-vf',
      vf,
      '-vcodec',
      'libwebp',
      '-loop',
      '0',
      '-lossless',
      '0',
      '-q:v',
      '60',
      '-preset',
      'default',
      outFile,
    ];
    try {
      await runFfmpeg(args);
    } catch (err) {
      // Coba lagi tanpa watermark (mis. font tidak tersedia di panel).
      if (watermark.text) {
        await runFfmpeg([
          '-y', '-i', inFile, '-vf', base,
          '-vcodec', 'libwebp', '-loop', '0', '-lossless', '0', '-q:v', '60', '-preset', 'default', outFile,
        ]);
      } else {
        throw err;
      }
    }
    return fs.readFileSync(outFile);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function watermarkConfig() {
  const text = getEnv('STICKER_WM_TEXT', '@Tsukasa');
  const image = getEnv('STICKER_WM_IMG', '');
  return {
    text,
    image: image ? publicPath(image) : '',
  };
}

// ---------------- Sticker ----------------
class StickerFeature {
  constructor() {
    // Catatan: pola "!s" tidak bisa diawali \b karena "!" bukan karakter word.
    this.reCmd = /(?:^|\s)!\s*(?:s|sgif|stiker|sticker)\b|\b(?:stiker|sticker)\b/i;
    this.reNat = /\b(stiker|sticker)\b/i;
    this.reTsukasa = /\btsukasa\b/i;
  }

  shouldHandle(content, rawText) {
    const text = (wa.extractText(content) || rawText || '').trim().toLowerCase();
    if (this.reCmd.test(text)) return true;
    if (this.reNat.test(text) && this.hasMedia(content)) return true;
    if (this.hasMedia(content) && this.reTsukasa.test(text) && /stiker|sticker/.test(text)) return true;
    return false;
  }

  hasMedia(content) {
    if (!content) return false;
    if (content.imageMessage || content.videoMessage) return true;
    const ci = wa.contextInfoOf(content);
    const q = wa.quotedContent(ci);
    return Boolean(q && (q.imageMessage || q.videoMessage));
  }

  async handle(sock, m, content, rawText) {
    const chat = m.key.remoteJid;
    const text = (wa.extractText(content) || rawText || '').trim();
    const low = text.toLowerCase();
    if (!this.shouldHandle(content, rawText)) return false;

    const urlMatch = low.match(/https?:\/\/\S+/);
    const isAnimated = low.includes('!sgif') || (urlMatch && /\.gif(\?|$)/i.test(urlMatch[0]));

    let data = null;
    if (urlMatch) {
      try {
        const got = await downloadBytes(urlMatch[0], 50 * 1024 * 1024, 90000);
        data = got.data;
      } catch (err) {
        await wa.sendText(chat, `Gagal unduh: ${err.message}`, m).catch(() => {});
        return true;
      }
    } else {
      let media = content.imageMessage || content.videoMessage;
      let quoted = null;
      let animated = Boolean(content.videoMessage);
      if (!media) {
        quoted = wa.quotedContent(wa.contextInfoOf(content));
        if (quoted) {
          media = quoted.imageMessage || quoted.videoMessage;
          animated = Boolean(quoted.videoMessage);
        }
      }
      if (!media) {
        await wa.sendText(
          chat,
          'Tidak menemukan media untuk dijadikan sticker. Sertakan URL atau reply gambar/video.',
          m
        ).catch(() => {});
        return true;
      }
      try {
        data = quoted
          ? await wa.downloadQuoted(quoted, chat, m.key.participant || chat)
          : await wa.downloadMedia({ key: m.key, message: content });
      } catch (err) {
        await wa.sendText(chat, `Gagal mengunduh media: ${err.message}`, m).catch(() => {});
        return true;
      }
      if (animated) {
        const wm = watermarkConfig();
        try {
          const webp = await videoToWebp(data, wm);
          await wa.sendSticker(chat, webp, m);
        } catch (err) {
          await wa.sendText(chat, `Konversi WebP gagal: ${err.message}`, m).catch(() => {});
        }
        return true;
      }
    }

    try {
      const wm = watermarkConfig();
      const animated = Boolean(isAnimated);
      const webp = animated ? await videoToWebp(data, wm) : await staticToWebp(data, wm);
      await wa.sendSticker(chat, webp, m);
    } catch (err) {
      await wa.sendText(chat, `Konversi/gagal kirim sticker: ${err.message}`, m).catch(() => {});
    }
    return true;
  }
}

// ---------------- Brat ----------------
class BratFeature {
  constructor(triggerRegex) {
    this.triggerRegex = triggerRegex;
    this.reBrat = /\bbrat\b/i;
  }

  extractStickerText(text) {
    let cleaned = String(text || '')
      .replace(this.triggerRegex, ' ')
      .replace(this.reBrat, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) {
      cleaned = String(text || '')
        .replace(this.triggerRegex, '')
        .replace(this.reBrat, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return cleaned;
  }

  buildSvg(text) {
    const size = 512;
    const lower = text.toLowerCase();
    const len = lower.length;
    let fontSize = 48;
    if (len <= 5) fontSize = 60;
    else if (len <= 10) fontSize = 48;
    else if (len <= 20) fontSize = 36;
    else if (len <= 40) fontSize = 28;
    else fontSize = 20;
    fontSize = (fontSize * size) / 400;

    const charWidth = fontSize * 0.55;
    const maxChars = Math.max(3, Math.floor((size * 0.9) / charWidth));
    const words = lower.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= maxChars) current = test;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (lines.length === 0) lines.push('brat');

    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = (size - totalHeight) / 2 + fontSize;

    let tspans = '';
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      if (y > size - 15) return;
      const single = lines.length === 1 && len <= 12;
      const x = single ? size / 2 : 20;
      const anchor = single ? 'middle' : 'start';
      tspans += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" fill="#000">${escapeXml(
        line
      )}</text>`;
    });

    return Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="${size}" height="${size}" fill="#8EFF8E"/>${tspans}</svg>`
    );
  }

  async handle(sock, m, content, rawText) {
    const text = wa.extractText(content) || rawText || '';
    if (!this.triggerRegex.test(text)) return false;
    if (!this.reBrat.test(text)) return false;

    let stickerText = this.extractStickerText(text);
    if (!stickerText.trim()) stickerText = 'brat';

    const chat = m.key.remoteJid;
    try {
      const svg = this.buildSvg(stickerText);
      const webp = await sharp(svg).webp({ lossless: true, effort: 4 }).toBuffer();
      await wa.sendSticker(chat, webp, m);
    } catch (err) {
      console.error('[BRAT] gagal:', err.message);
      await wa.sendText(chat, 'Gagal membuat sticker brat 😔', m).catch(() => {});
    }
    return true;
  }
}

module.exports = { StickerFeature, BratFeature, runFfmpeg, isGroupJid };
