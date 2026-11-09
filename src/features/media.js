'use strict';

const log = require('../logger');
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
    this.reCmd = /(?:^|\s)[!\/.]\s*(?:s|sgif|stiker|sticker)\b|\b(?:stiker|sticker)\b/i;
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
const BRAT_SIZE = 512;
const BRAT_FONT =
  "'Roboto Condensed', 'Arial Narrow', 'Liberation Sans Narrow', 'DejaVu Sans Condensed', sans-serif";

const BRAT_THEMES = {
  green: { bg: '#8ACE00', fg: '#000000' },
  white: { bg: '#F4F4EF', fg: '#111111' },
  black: { bg: '#111111', fg: '#F4F4EF' },
  pink: { bg: '#FF9EC4', fg: '#111111' },
  blue: { bg: '#8FB8FF', fg: '#111111' },
  red: { bg: '#FF4D4D', fg: '#FFFFFF' },
};

const BRAT_THEME_ALIASES = {
  hijau: 'green',
  putih: 'white',
  hitam: 'black',
  biru: 'blue',
  merah: 'red',
};

function bratTheme(value) {
  const key = String(value || '').toLowerCase();
  return BRAT_THEMES[BRAT_THEME_ALIASES[key] || key] ? BRAT_THEME_ALIASES[key] || key : '';
}

function wrapBrat(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    // Kata yang lebih panjang dari satu baris dipotong paksa.
    while (current.length > maxChars && lines.length < maxLines) {
      lines.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) lines.push('brat');
  return lines.slice(0, maxLines);
}

class BratFeature {
  constructor(triggerRegex) {
    this.triggerRegex = triggerRegex;
    this.reBrat = /\bbrat\b/i;
  }

  extractStickerText(text) {
    return String(text || '')
      .replace(this.triggerRegex, ' ')
      .replace(this.reBrat, ' ')
      .replace(/^[\s!/.]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseOptions(text) {
    let raw = this.extractStickerText(text);
    let theme = 'green';
    let blur = 0.35;

    // Format: .brat white halo / .brat --theme black --blur 1 halo
    const tokens = raw.split(/\s+/).filter(Boolean);
    while (tokens.length) {
      const token = tokens[0].toLowerCase();
      if (token === '--theme' || token === 'theme') {
        tokens.shift();
        const picked = bratTheme(tokens[0]);
        if (picked) {
          theme = picked;
          tokens.shift();
        }
        continue;
      }
      if (token === '--blur' || token === 'blur') {
        tokens.shift();
        const n = Number(tokens[0]);
        if (Number.isFinite(n) && n >= 0 && tokens[0] !== undefined) {
          blur = Math.max(0, Math.min(4, n));
          tokens.shift();
        } else {
          blur = 1.2;
        }
        continue;
      }
      const picked = bratTheme(token);
      // Nama tema hanya dipakai kalau masih ada teks setelahnya.
      if (picked && tokens.length > 1) {
        theme = picked;
        tokens.shift();
        continue;
      }
      break;
    }

    raw = tokens.join(' ').trim();
    return { text: raw, theme, blur };
  }

  buildSvg(text, options = {}) {
    const themeName = bratTheme(options.theme) || 'green';
    const theme = BRAT_THEMES[themeName];
    const lower = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim() || 'brat';
    const boxWidth = BRAT_SIZE * 0.86;
    const boxHeight = BRAT_SIZE * 0.78;
    const maxLines = 8;

    let chosen = null;
    for (let fontSize = 132; fontSize >= 20; fontSize -= 2) {
      const charWidth = fontSize * 0.52;
      const maxChars = Math.max(3, Math.floor(boxWidth / charWidth));
      const lines = wrapBrat(lower, maxChars, maxLines);
      const lineHeight = fontSize * 1.04;
      const totalHeight = lines.length * lineHeight;
      const longEnough = lines.every((line) => line.length <= maxChars);
      if (longEnough && totalHeight <= boxHeight) {
        chosen = { fontSize, lines, lineHeight, totalHeight };
        break;
      }
    }
    if (!chosen) {
      const fontSize = 20;
      const maxChars = Math.max(3, Math.floor(boxWidth / (fontSize * 0.52)));
      const lines = wrapBrat(lower, maxChars, maxLines);
      chosen = { fontSize, lines, lineHeight: fontSize * 1.04, totalHeight: lines.length * fontSize * 1.04 };
    }

    const startY = (BRAT_SIZE - chosen.totalHeight) / 2 + chosen.fontSize * 0.8;
    const tspans = chosen.lines
      .map(
        (line, i) =>
          `<text x="${BRAT_SIZE / 2}" y="${startY + i * chosen.lineHeight}" ` +
          `text-anchor="middle" font-family="${BRAT_FONT}" font-size="${chosen.fontSize}" ` +
          `font-weight="500" letter-spacing="-0.5" fill="${theme.fg}">${escapeXml(line)}</text>`
      )
      .join('');

    return Buffer.from(
      `<svg width="${BRAT_SIZE}" height="${BRAT_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="${BRAT_SIZE}" height="${BRAT_SIZE}" fill="${theme.bg}"/>${tspans}</svg>`
    );
  }

  async handle(sock, m, content, rawText) {
    const text = wa.extractText(content) || rawText || '';
    if (!this.triggerRegex.test(text)) return false;
    if (!this.reBrat.test(text)) return false;

    const parsed = this.parseOptions(text);
    let stickerText = parsed.text;
    if (!stickerText.trim()) stickerText = 'brat';

    const chat = m.key.remoteJid;
    try {
      const svg = this.buildSvg(stickerText, parsed);
      let image = sharp(svg);
      if (parsed.blur > 0) image = image.blur(parsed.blur);
      const webp = await image.webp({ lossless: true, effort: 4 }).toBuffer();
      await wa.sendSticker(chat, webp, m);
    } catch (err) {
      log.error('[BRAT] gagal:', err.message);
      await wa.sendText(chat, 'Gagal membuat sticker brat 😔', m).catch(() => {});
    }
    return true;
  }
}

module.exports = { StickerFeature, BratFeature, runFfmpeg, isGroupJid };
