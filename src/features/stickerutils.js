'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const wa = require('../wa');
const log = require('../logger');
const { escapeXml } = require('../util');
const { runFfmpeg } = require('./media');

const SIZE = 512;
const MAX_TEXT = 600;

function randomHue() {
  return Math.floor(Math.random() * 360);
}

function normalText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

function wrapText(text, maxChars, maxLines) {
  const words = normalText(text).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  let truncated = false;
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (word.length > maxChars) {
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      }
      current = truncated ? '' : rest;
    } else {
      current = word;
    }
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
  }
  if (lines.length < maxLines) {
    if (current) lines.push(current);
  } else if (current) {
    truncated = true;
  }
  if (lines.length === 0) lines.push('...');
  if (truncated) {
    const idx = lines.length - 1;
    let last = lines[idx];
    if (last.length >= maxChars) last = last.slice(0, Math.max(1, maxChars - 1));
    lines[idx] = last + '…';
  }
  return lines;
}

function textSvg(text, options) {
  const opts = options || {};
  const hue = Number.isFinite(opts.hue) ? opts.hue : randomHue();
  const hue2 = (hue + 70) % 360;
  const fontSize = opts.fontSize || 46;
  const maxChars = opts.maxChars || Math.max(6, Math.floor((SIZE * 0.82) / (fontSize * 0.58)));
  const lines = wrapText(text, maxChars, opts.maxLines || 7);
  const lineHeight = Math.round(fontSize * 1.25);
  const total = lines.length * lineHeight;
  const startY = Math.round((SIZE - total) / 2 + fontSize * 0.85);
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${SIZE / 2}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="hsl(${hue},85%,55%)"/>` +
      `<stop offset="100%" stop-color="hsl(${hue2},85%,32%)"/>` +
      `</linearGradient></defs>` +
      `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>` +
      `<circle cx="70" cy="70" r="110" fill="#ffffff" fill-opacity="0.08"/>` +
      `<circle cx="${SIZE - 50}" cy="${SIZE - 60}" r="130" fill="#000000" fill-opacity="0.10"/>` +
      `<text text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" ` +
      `font-size="${fontSize}" font-weight="bold" fill="#ffffff" ` +
      `stroke="rgba(0,0,0,0.35)" stroke-width="2" paint-order="stroke">${tspans}</text>` +
      `</svg>`
  );
}

function quoteSvg(text, name) {
  const author = normalText(name) || 'Kamu';
  const initial = (author.match(/[a-z0-9]/i) || ['?'])[0].toUpperCase();
  const fontSize = 38;
  const maxChars = Math.max(8, Math.floor((SIZE * 0.72) / (fontSize * 0.58)));
  const lines = wrapText(text, maxChars, 5);
  const lineHeight = Math.round(fontSize * 1.32);
  const startY = 178;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="76" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="card" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="#101c24"/>` +
      `<stop offset="100%" stop-color="#0b141a"/>` +
      `</linearGradient></defs>` +
      `<rect width="${SIZE}" height="${SIZE}" rx="34" fill="url(#card)"/>` +
      `<rect x="0" y="0" width="12" height="${SIZE}" rx="6" fill="#25d366"/>` +
      `<circle cx="70" cy="92" r="34" fill="#25d366"/>` +
      `<text x="70" y="104" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" ` +
      `font-size="34" font-weight="bold" fill="#0b141a">${escapeXml(initial)}</text>` +
      `<text x="118" y="88" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" ` +
      `font-weight="bold" fill="#e9edef">${escapeXml(author.slice(0, 24))}</text>` +
      `<text x="118" y="116" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" ` +
      `fill="#8696a0">mengutip pesan</text>` +
      `<text font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" ` +
      `fill="#e9edef">${tspans}</text>` +
      `<text x="76" y="${SIZE - 36}" font-family="DejaVu Sans, Arial, sans-serif" ` +
      `font-size="17" fill="#8696a0">Tsukasa • Quote Card</text>` +
      `</svg>`
  );
}

function wmSvg(text) {
  const label = normalText(text).slice(0, 60) || '@Tsukasa';
  return Buffer.from(
    `<svg width="${SIZE}" height="64" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="${SIZE - 250}" y="14" width="238" height="36" rx="10" fill="#000000" fill-opacity="0.45"/>` +
      `<text x="${SIZE - 22}" y="42" text-anchor="end" ` +
      `font-family="DejaVu Sans, Arial, sans-serif" font-size="21" font-weight="bold" ` +
      `fill="#ffffff" fill-opacity="0.92">${escapeXml(label)}</text>` +
      `</svg>`
  );
}

function ffmpegText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

async function extractSticker(content, m, chat) {
  let quoted = null;
  let media = content && content.stickerMessage;
  if (!media) {
    quoted = wa.quotedContent(wa.contextInfoOf(content));
    if (quoted && quoted.stickerMessage) media = quoted.stickerMessage;
  }
  if (!media) return null;

  if (quoted && quoted.stickerMessage) {
    return wa.downloadQuoted(quoted, chat, m.key.participant || chat);
  }
  return wa.downloadMedia({ key: m.key, message: content });
}

function quotedText(content) {
  const quoted = wa.quotedContent(wa.contextInfoOf(content));
  if (!quoted) return '';
  return String(wa.extractText(quoted) || '').trim();
}

class StickerUtilsFeature {
  constructor(cfg) {
    this.cfg = cfg || {};
  }

  static isCommand(name) {
    return ['toimg', 'ttp', 'attp', 'qc', 'wm', 'stickerinfo', 'smeta'].includes(
      String(name || '').toLowerCase()
    );
  }

  textFrom(content, rest) {
    return normalText(rest) || quotedText(content);
  }

  async sendSticker(chat, m, buf) {
    await wa.sendSticker(chat, buf, m);
  }

  async toImage(chat, m, content) {
    const buf = await extractSticker(content, m, chat);
    if (!buf) {
      await wa.sendText(chat, 'Reply sticker lalu ketik *.toimg*.', m).catch(() => {});
      return;
    }
    const meta = await sharp(buf).metadata();
    const png = await sharp(buf, { animated: false }).png().toBuffer();
    const note = Number(meta.pages || 1) > 1 ? ' (frame pertama)' : '';
    await wa.sendImage(chat, png, `🖼️ Sticker → PNG${note}`, m).catch(async () => {
      await wa.sendText(chat, 'Gagal mengubah sticker jadi gambar.', m).catch(() => {});
    });
  }

  async info(chat, m, content) {
    const buf = await extractSticker(content, m, chat);
    if (!buf) {
      await wa.sendText(chat, 'Reply sticker lalu ketik *.stickerinfo*.', m).catch(() => {});
      return;
    }
    let meta = {};
    try {
      meta = await sharp(buf).metadata();
    } catch (err) {
      log.warn(`[STICKERINFO] metadata gagal: ${err.message}`);
    }
    const pages = Number(meta.pages || 1);
    const lines = [
      '🧩 *Sticker Info*',
      `• Format : ${meta.format || 'webp'}`,
      `• Ukuran : ${meta.width || '?'}×${meta.height || '?'}`,
      `• Frame  : ${pages}${pages > 1 ? ' (animasi)' : ' (statis)'}`,
      `• Size   : ${(buf.length / 1024).toFixed(1)} KB`,
      `• Mime   : ${meta.format ? `image/${meta.format}` : 'image/webp'}`,
    ];
    await wa.sendText(chat, lines.join('\n'), m).catch(() => {});
  }

  async makeTtp(chat, m, text) {
    if (!text) {
      await wa.sendText(chat, 'Gunakan: *.ttp <teks>* atau reply teks lalu *.ttp*.', m).catch(
        () => {}
      );
      return;
    }
    const svg = textSvg(text);
    const webp = await sharp(svg).webp({ quality: 82, effort: 4 }).toBuffer();
    await this.sendSticker(chat, m, webp);
  }

  async makeAttp(chat, m, text) {
    if (!text) {
      await wa.sendText(chat, 'Gunakan: *.attp <teks>* atau reply teks lalu *.attp*.', m).catch(
        () => {}
      );
      return;
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'attp-'));
    try {
      const frames = 12;
      const baseHue = randomHue();
      for (let i = 0; i < frames; i += 1) {
        const hue = (baseHue + i * 14) % 360;
        const svg = textSvg(text, { hue, fontSize: 46 });
        await sharp(svg)
          .png()
          .toFile(path.join(tmp, `frame-${String(i).padStart(3, '0')}.png`));
      }
      const out = path.join(tmp, 'out.webp');
      await runFfmpeg([
        '-y',
        '-framerate',
        '12',
        '-i',
        path.join(tmp, 'frame-%03d.png'),
        '-an',
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
        out,
      ]);
      const webp = fs.readFileSync(out);
      await this.sendSticker(chat, m, webp);
    } catch (err) {
      log.warn(`[ATTP] animasi gagal, fallback statis: ${err.message}`);
      await this.makeTtp(chat, m, text);
    } finally {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  async makeQuoteCard(chat, m, content, rest) {
    const text = this.textFrom(content, rest);
    if (!text) {
      await wa
        .sendText(chat, 'Reply pesan lalu ketik *.qc*, atau *.qc <teks>*.', m)
        .catch(() => {});
      return;
    }
    const name = String(m.pushName || '').trim() || 'Kamu';
    const svg = quoteSvg(text, name);
    const webp = await sharp(svg).webp({ quality: 86, effort: 4 }).toBuffer();
    await this.sendSticker(chat, m, webp);
  }

  async watermark(chat, m, content, rest) {
    const text = normalText(rest).slice(0, 60);
    if (!text) {
      await wa
        .sendText(chat, 'Gunakan: reply sticker lalu *.wm <teks watermark>*.', m)
        .catch(() => {});
      return;
    }
    const buf = await extractSticker(content, m, chat);
    if (!buf) {
      await wa.sendText(chat, 'Reply sticker lalu ketik *.wm <teks>*.', m).catch(() => {});
      return;
    }

    let meta = {};
    try {
      meta = await sharp(buf).metadata();
    } catch {
      meta = {};
    }
    const animated = Number(meta.pages || 1) > 1;

    if (animated) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-'));
      try {
        const inFile = path.join(tmp, 'in.webp');
        const outFile = path.join(tmp, 'out.webp');
        fs.writeFileSync(inFile, buf);
        const escaped = ffmpegText(text);
        const vf =
          `drawtext=text='${escaped}':fontcolor=white@0.92:fontsize=22:` +
          'box=1:boxcolor=0x00000088:boxborderw=6:x=w-tw-12:y=h-th-12';
        await runFfmpeg([
          '-y',
          '-i',
          inFile,
          '-vf',
          vf,
          '-an',
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
        ]);
        const webp = fs.readFileSync(outFile);
        await this.sendSticker(chat, m, webp);
        return;
      } catch (err) {
        log.warn(`[WM] watermark animasi gagal, fallback frame pertama: ${err.message}`);
      } finally {
        try {
          fs.rmSync(tmp, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }

    const webp = await sharp(buf, { animated: false })
      .resize(SIZE, SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .composite([{ input: wmSvg(text), gravity: 'southeast' }])
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    await this.sendSticker(chat, m, webp);
  }

  async handle(sock, m, content, cmd, rest) {
    const chat = m.key.remoteJid;
    if (!chat) return false;
    const name = String(cmd || '').toLowerCase();
    if (!StickerUtilsFeature.isCommand(name)) return false;

    try {
      if (name === 'toimg') {
        await this.toImage(chat, m, content);
        return true;
      }

      if (name === 'stickerinfo' || name === 'smeta') {
        await this.info(chat, m, content);
        return true;
      }

      if (name === 'ttp') {
        await this.makeTtp(chat, m, this.textFrom(content, rest));
        return true;
      }

      if (name === 'attp') {
        await this.makeAttp(chat, m, this.textFrom(content, rest));
        return true;
      }

      if (name === 'qc') {
        await this.makeQuoteCard(chat, m, content, rest);
        return true;
      }

      if (name === 'wm') {
        await this.watermark(chat, m, content, rest);
        return true;
      }
    } catch (err) {
      log.error(`[STICKERUTIL] ${name} gagal: ${err.message}`);
      await wa
        .sendText(chat, `Gagal memproses *.${name}*: ${err.message}`, m)
        .catch(() => {});
      return true;
    }

    return false;
  }
}

module.exports = { StickerUtilsFeature };
