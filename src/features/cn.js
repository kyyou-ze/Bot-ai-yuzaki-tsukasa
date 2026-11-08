'use strict';

const wa = require('../wa');

// Mathematical Sans-Serif Bold Italic (A-Z, a-z) dan Sans-Serif Bold (0-9).
// Dipakai untuk membuat CN bergaya seperti "𝙀𝘾𝙉" dari keyword biasa.
const BOLD_ITALIC_UPPER = 0x1d63c;
const BOLD_ITALIC_LOWER = 0x1d656;
const BOLD_DIGIT = 0x1d7ec;

function styleKeyword(value) {
  const raw = String(value || '').trim();
  if (!raw) return '𝙀𝘾𝙉';
  return Array.from(raw)
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCodePoint(BOLD_ITALIC_UPPER + code - 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCodePoint(BOLD_ITALIC_LOWER + code - 97);
      }
      if (code >= 48 && code <= 57) {
        return String.fromCodePoint(BOLD_DIGIT + code - 48);
      }
      return ch;
    })
    .join('');
}

/**
 * Fitur .cn <nama> — menampilkan contoh CN (copy name) TikTok dengan tiga
 * gaya yang umum dipakai: backtick + ECN, "ft ECN", dan "〆ECN".
 */
class CnFeature {
  constructor(cfg) {
    this.keyword = String((cfg && cfg.tiktokCnKeyword) || 'ECN').trim() || 'ECN';
  }

  format(rest, pushName) {
    const name = String(rest || '').trim().replace(/\s+/g, ' ') || String(pushName || '').trim();
    const display = name || '𝐍𝐚𝐦𝐚';
    const boldName = `*${display}*`;
    const cn = styleKeyword(this.keyword);
    const lines = [
      '𝗖𝗼𝗻𝘁𝗼𝗵 𝗖𝗡 (opsional)',
      `- ${boldName} \`${cn}᭄`,
      `- ${boldName}\`𝖋𝖙 ${cn}`,
      `- ${boldName}〆${cn}`,
    ];
    if (!name) {
      lines.push('', 'Gunakan: .cn <nama>', 'Contoh: .cn Tsukasa');
    }
    return lines.join('\n');
  }

  async handle(sock, m, rest) {
    const chat = m.key.remoteJid;
    await wa.sendText(chat, this.format(rest, m.pushName), m).catch(() => {});
    return true;
  }
}

module.exports = { CnFeature, styleKeyword };
