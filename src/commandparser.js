'use strict';

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Perintah yang dikenal. Dipakai untuk membedakan "tsukasa help" (perintah)
// dari "tsukasa halo apa kabar" (obrolan biasa).
const KNOWN_COMMANDS = new Set([
  'help', 'menu', 'whoami',
  'fitur', 'feature', 'features', 'togglefitur',
  'ingatkan', 'remind', 'pengingat',
  'poll', 'voting',
  'rangkum', 'ringkas', 'summary',
  'statistik', 'stats', 'stat',
  'topaktif', 'topactive', 'topchat',
  'anime', 'info', 'news', 'berita', 'cosplay',
  'animechannel', 'anime-channel',
  'peraturan', 'rules',
  'health', 'status', 'ping',
  'backup', 'audit',
  'afk', 'back', 'unafk', 'kembali',
  'config', 'setting', 'pengaturan', 'set', 'isi',
  'update', 'upgrade', 'autoupdate',
  'panel', 'server',
  'geminikey', 'gkey',
  'hot', 'tsukasa', 'persona', 'mode',
  'modegrup', 'groupmode',
  'cn',
  'tagall', 'rvo',
  'ba', 'pap', 's', 'sgif', 'stiker', 'sticker', 'brat',
  'srandom', 'spack', 'sadd', 'slist', 'sdel',
  'toimg', 'ttp', 'attp', 'qc', 'qcimg', 'qci', 'wm', 'stickerinfo', 'smeta',
  'emojimix', 'emojikitchen',
  'flip', 'mirror', 'flipv', 'rotate', 'putar',
  'grayscale', 'gray', 'greyscale', 'bw', 'blur', 'crop',
  'resize', 'small', 'invert', 'negate',
  'vn', 'tts', 'gambar', 'imggen', 'hijabin',
  'jadwal', 'jadwalgrup', 'antilink', 'antispam', 'moderasi',
  'resetwarn', 'mute', 'unmute',
  'verif', 'veriv', 'listverif', 'listveriv', 'unverif', 'unveriv',
  'me', 'profile',
  'siapaup', 'whoup', 'cekup', 'history',
  'addakun', 'tambahakun', 'delakun', 'hapusakun',
  'listakun', 'daftarakun', 'detector', 'detektor',
]);

/**
 * Parser perintah tunggal. Menerima semua gaya penulisan:
 *   !help  /help  .help  tsukasa help
 * Mengembalikan null jika teks bukan bentuk perintah.
 *
 * `explicit` berarti user memakai prefix (!, /, .); `natural` berarti pesan
 * hanya berisi trigger tanpa perintah (mis. "tsukasa").
 */
function parseCommand(text, trigger) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const explicit = /^[!\/.]\s*/.test(raw);
  let rest = '';

  if (explicit) {
    rest = raw.replace(/^[!\/.]\s*/, '');
  } else {
    const re = new RegExp('^' + escapeRegExp(trigger || 'tsukasa') + '\\b[\\s,]*', 'i');
    if (!re.test(raw)) return null;
    rest = raw.replace(re, '').trim();
  }

  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { cmd: '', rest: '', explicit, natural: true };
  }
  return {
    cmd: parts[0].toLowerCase(),
    rest: parts.slice(1).join(' '),
    explicit,
    natural: false,
  };
}

/**
 * "tsukasa persona x" dan "tsukasa mode pro on" dirapikan menjadi bentuk
 * yang ditangani blok perintah `tsukasa`.
 */
function normalizeCommand(parsed) {
  if (!parsed || !parsed.cmd) return parsed;
  if (parsed.cmd === 'persona' || parsed.cmd === 'mode') {
    return {
      ...parsed,
      cmd: 'tsukasa',
      rest: parsed.cmd + (parsed.rest ? ' ' + parsed.rest : ''),
    };
  }
  return parsed;
}

function stripLeadingTrigger(text, trigger) {
  const raw = String(text || '').trim();
  const re = new RegExp('^' + escapeRegExp(trigger || 'tsukasa') + '\\b[\\s,]*', 'i');
  return raw.replace(re, '').trim();
}

module.exports = {
  escapeRegExp,
  KNOWN_COMMANDS,
  parseCommand,
  normalizeCommand,
  stripLeadingTrigger,
};
