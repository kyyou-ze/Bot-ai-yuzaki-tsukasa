'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const wa = require('../wa');
const log = require('../logger');
const memory = require('../memory');
const { escapeXml, jidUser } = require('../util');
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

const QUOTE_FONT = "DejaVu Sans, Noto Sans, Arial, sans-serif";
const QUOTE_CARD_W = 452;
const QUOTE_CARD_X = (SIZE - QUOTE_CARD_W) / 2;
const QUOTE_PAD_X = 34;
const QUOTE_HEADER_H = 98;
const QUOTE_FOOTER_H = 48;
const QUOTE_MAX_H = SIZE - 40;

const QUOTE_THEMES = {
  dark: {
    bg1: '#132029',
    bg2: '#0b141a',
    fg: '#e9edef',
    muted: '#8aa0ab',
    accent: '#25d366',
    avatarFg: '#06231a',
    border: '#22333d',
    shadow: '#000000',
    shadowOpacity: 0.5,
  },
  light: {
    bg1: '#ffffff',
    bg2: '#f2f7f4',
    fg: '#12211b',
    muted: '#5e7a70',
    accent: '#1faa59',
    avatarFg: '#ffffff',
    border: '#dfe9e3',
    shadow: '#0b2418',
    shadowOpacity: 0.18,
  },
};

const QUOTE_THEME_ALIASES = {
  terang: 'light',
  putih: 'light',
  gelap: 'dark',
  hitam: 'dark',
};

function quoteTheme(value) {
  const key = String(value || '').toLowerCase();
  const name = QUOTE_THEME_ALIASES[key] || key;
  return QUOTE_THEMES[name] ? name : '';
}

function clipText(value, max) {
  const text = normalText(value);
  return text.length > max ? text.slice(0, Math.max(1, max - 1)).trimEnd() + '…' : text;
}

function quotedMediaLabel(content) {
  const quoted = wa.quotedContent(wa.contextInfoOf(content));
  if (!quoted) return '';
  const type = wa.contentTypeOf(quoted);
  const labels = {
    imageMessage: '📷 Foto',
    videoMessage: '🎬 Video',
    stickerMessage: '🧩 Sticker',
    audioMessage: '🎙️ Audio',
    documentMessage: '📄 Dokumen',
  };
  return labels[type] || '';
}

function quotedAuthor(content, fallback) {
  const ctx = wa.contextInfoOf(content);
  if (!ctx || !ctx.quotedMessage) return normalText(fallback) || 'Kamu';
  const jid = ctx.participant || ctx.remoteJid || '';
  const known = jid ? memory.getUserName(jid) : '';
  if (known) return known;
  const user = jidUser(jid);
  if (/^\d{5,}$/.test(user)) return `+${user}`;
  return clipText(user || fallback || 'Kamu', 24);
}

function quoteLayout(text, fontSizeFloor = 16) {
  const maxTextWidth = QUOTE_CARD_W - QUOTE_PAD_X * 2;
  let chosen = null;
  for (let fontSize = 34; fontSize >= fontSizeFloor; fontSize -= 2) {
    const maxChars = Math.max(8, Math.floor(maxTextWidth / (fontSize * 0.55)));
    const lineHeight = Math.round(fontSize * 1.42);
    const lines = wrapText(text, maxChars, 40);
    const quoteHeight = lines.length * lineHeight;
    const cardHeight = QUOTE_HEADER_H + quoteHeight + QUOTE_FOOTER_H;
    if (cardHeight <= QUOTE_MAX_H) {
      chosen = { fontSize, lineHeight, lines, quoteHeight, cardHeight };
      break;
    }
  }
  if (!chosen) {
    const fontSize = fontSizeFloor;
    const maxChars = Math.max(8, Math.floor(maxTextWidth / (fontSize * 0.55)));
    const lineHeight = Math.round(fontSize * 1.42);
    const lines = wrapText(text, maxChars, 14);
    const quoteHeight = lines.length * lineHeight;
    chosen = {
      fontSize,
      lineHeight,
      lines,
      quoteHeight,
      cardHeight: Math.min(QUOTE_MAX_H, QUOTE_HEADER_H + quoteHeight + QUOTE_FOOTER_H),
    };
  }
  return chosen;
}

function quoteSvg(text, name, options = {}) {
  const themeName = quoteTheme(options.theme) || 'dark';
  const theme = QUOTE_THEMES[themeName];
  const author = clipText(name, 24) || 'Kamu';
  const initial = (author.match(/[a-z0-9]/i) || ['?'])[0].toUpperCase();
  const mediaLabel = normalText(options.mediaLabel);
  const layout = quoteLayout(normalText(text));
  const cardH = Math.max(220, layout.cardHeight);
  const cardY = Math.round((SIZE - cardH) / 2);
  const avatarX = QUOTE_CARD_X + QUOTE_PAD_X + 24;
  const avatarY = cardY + 50;
  const nameX = avatarX + 40;
  const quoteX = QUOTE_CARD_X + QUOTE_PAD_X;
  const quoteStartY = cardY + QUOTE_HEADER_H + layout.fontSize;
  const footerLineY = cardY + cardH - QUOTE_FOOTER_H + 4;
  const footerTextY = cardY + cardH - 20;

  const tspans = layout.lines
    .map(
      (line, i) =>
        `<tspan x="${quoteX}" y="${quoteStartY + i * layout.lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs>` +
      `<linearGradient id="card" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${theme.bg1}"/>` +
      `<stop offset="100%" stop-color="${theme.bg2}"/>` +
      `</linearGradient>` +
      `<linearGradient id="avatar" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${theme.accent}"/>` +
      `<stop offset="100%" stop-color="#0f9d58"/>` +
      `</linearGradient>` +
      `<filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">` +
      `<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${theme.shadow}" flood-opacity="${theme.shadowOpacity}"/>` +
      `</filter>` +
      `</defs>` +
      `<g filter="url(#softShadow)">` +
      `<rect x="${QUOTE_CARD_X}" y="${cardY}" width="${QUOTE_CARD_W}" height="${cardH}" ` +
      `rx="28" fill="url(#card)" stroke="${theme.border}" stroke-width="1"/>` +
      `</g>` +
      `<rect x="${QUOTE_CARD_X + QUOTE_PAD_X}" y="${cardY}" width="52" height="4" rx="2" fill="${theme.accent}"/>` +
      `<text x="${QUOTE_CARD_X + QUOTE_CARD_W - 28}" y="${cardY + 82}" text-anchor="end" ` +
      `font-family="${QUOTE_FONT}" font-size="84" font-weight="bold" fill="${theme.accent}" ` +
      `fill-opacity="0.16">“</text>` +
      `<circle cx="${avatarX}" cy="${avatarY}" r="24" fill="url(#avatar)"/>` +
      `<text x="${avatarX}" y="${avatarY + 8}" text-anchor="middle" font-family="${QUOTE_FONT}" ` +
      `font-size="23" font-weight="bold" fill="${theme.avatarFg}">${escapeXml(initial)}</text>` +
      `<text x="${nameX}" y="${cardY + 46}" font-family="${QUOTE_FONT}" font-size="23" ` +
      `font-weight="bold" fill="${theme.fg}">${escapeXml(author)}</text>` +
      `<text x="${nameX}" y="${cardY + 69}" font-family="${QUOTE_FONT}" font-size="12.5" ` +
      `letter-spacing="1.4" fill="${theme.muted}">MENGUTIP PESAN</text>` +
      `<text font-family="${QUOTE_FONT}" font-size="${layout.fontSize}" ` +
      `fill="${theme.fg}">${tspans}</text>` +
      `<line x1="${quoteX}" y1="${footerLineY}" x2="${QUOTE_CARD_X + QUOTE_CARD_W - QUOTE_PAD_X}" ` +
      `y2="${footerLineY}" stroke="${theme.border}" stroke-width="1"/>` +
      `<circle cx="${quoteX + 4}" cy="${footerTextY - 5}" r="3" fill="${theme.accent}"/>` +
      `<text x="${quoteX + 14}" y="${footerTextY}" font-family="${QUOTE_FONT}" font-size="15" ` +
      `font-weight="bold" fill="${theme.accent}">Tsukasa</text>` +
      `<text x="${quoteX + 82}" y="${footerTextY}" font-family="${QUOTE_FONT}" font-size="15" ` +
      `fill="${theme.muted}">• Quote Card</text>` +
      (mediaLabel
        ? `<text x="${QUOTE_CARD_X + QUOTE_CARD_W - QUOTE_PAD_X}" y="${footerTextY}" ` +
          `text-anchor="end" font-family="${QUOTE_FONT}" font-size="14" ` +
          `fill="${theme.muted}">${escapeXml(mediaLabel)}</text>`
        : '') +
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
    return [
      'toimg',
      'ttp',
      'attp',
      'qc',
      'qcimg',
      'qci',
      'wm',
      'stickerinfo',
      'smeta',
    ].includes(String(name || '').toLowerCase());
  }

  textFrom(content, rest) {
    return normalText(rest) || quotedText(content);
  }

  parseQuoteOptions(rest) {
    const tokens = String(rest || '').split(/\s+/).filter(Boolean);
    let theme = 'dark';
    while (tokens.length) {
      const token = tokens[0].toLowerCase();
      if (token === '--theme' || token === 'theme') {
        tokens.shift();
        const picked = quoteTheme(tokens[0]);
        if (picked) {
          theme = picked;
          tokens.shift();
        }
        continue;
      }
      const picked = quoteTheme(token);
      if (picked) {
        theme = picked;
        tokens.shift();
        continue;
      }
      if (token === '--light' || token === 'light') {
        theme = 'light';
        tokens.shift();
        continue;
      }
      if (token === '--dark' || token === 'dark') {
        theme = 'dark';
        tokens.shift();
        continue;
      }
      break;
    }
    return { text: normalText(tokens.join(' ')), theme };
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

  async makeQuoteCard(chat, m, content, rest, asImage = false) {
    const parsed = this.parseQuoteOptions(rest);
    let text = parsed.text || quotedText(content);
    const mediaLabel = quotedMediaLabel(content);
    if (!text && mediaLabel) {
      text = `Mengirim ${mediaLabel.replace(/^[^\s]+\s/, '').toLowerCase()}`;
    }
    if (!text) {
      await wa
        .sendText(
          chat,
          'Reply pesan lalu ketik *.qc*, atau *.qc <teks>*. Contoh tema: *.qc light*.',
          m
        )
        .catch(() => {});
      return;
    }

    const name = quotedAuthor(content, m.pushName || 'Kamu');
    const svg = quoteSvg(text, name, { theme: parsed.theme, mediaLabel });

    if (asImage) {
      const png = await sharp(svg, { density: 144 }).png().toBuffer();
      await wa.sendImage(chat, png, '🖼️ Quote Card', m);
      return;
    }

    const webp = await sharp(svg)
      .webp({ quality: 90, effort: 4, alphaQuality: 100 })
      .toBuffer();
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

      if (name === 'qcimg' || name === 'qci') {
        await this.makeQuoteCard(chat, m, content, rest, true);
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

module.exports = { StickerUtilsFeature, extractSticker, quoteSvg, quoteLayout };
