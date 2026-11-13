'use strict';

/**
 * Katalog fitur yang bisa diaktif/nonaktifkan per grup lewat `.fitur`.
 *
 * Setiap fitur punya daftar perintah yang dipetakan ke fitur tersebut. Saat
 * sebuah fitur dimatikan di grup, perintahnya otomatis ditolak dan barisnya
 * hilang dari menu `.help` di grup itu. Fitur yang tidak terdaftar di sini
 * (mis. `.help`, `.fitur`, perintah owner) selalu tersedia.
 */
const FEATURES = [
  {
    key: 'ai',
    label: 'AI & Vision',
    description: 'Chat AI, gambar AI, voice note, vision, rangkum, dan info.',
    commands: [
      'gambar',
      'imggen',
      'tts',
      'vn',
      'info',
      'rangkum',
      'ringkas',
      'summary',
    ],
  },
  {
    key: 'sticker',
    label: 'Sticker & Transform',
    description: 'Pembuat sticker, pack sticker, dan transformasi sticker.',
    commands: [
      's',
      'sgif',
      'stiker',
      'sticker',
      'srandom',
      'spack',
      'sadd',
      'slist',
      'sdel',
      'toimg',
      'ttp',
      'attp',
      'wm',
      'stickerinfo',
      'smeta',
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
    ],
  },
  {
    key: 'brat',
    label: 'Brat',
    description: 'Sticker brat dengan berbagai tema warna.',
    commands: ['brat'],
  },
  {
    key: 'qc',
    label: 'Quote Card',
    description: 'Quote card dari pesan yang di-reply.',
    commands: ['qc', 'qcimg', 'qci'],
  },
  {
    key: 'media',
    label: 'Media & Random',
    description: 'Blue Archive, pap, hijabin, dan media sekali lihat.',
    commands: ['ba', 'pap', 'hijabin', 'rvo'],
  },
  {
    key: 'anime',
    label: 'Anime',
    description: 'Info anime, jadwal, pencarian, dan rekomendasi.',
    commands: ['anime'],
  },
  {
    key: 'news',
    label: 'News & Cosplay Feed',
    description: 'Berita anime/manga/gacha/cosplay.',
    commands: ['news', 'berita'],
  },
  {
    key: 'cosplay',
    label: 'Cosplay Instagram',
    description: 'Ambil foto dari post Instagram.',
    commands: ['cosplay'],
  },
  {
    key: 'cn',
    label: 'CN TikTok',
    description: 'Buat contoh CN TikTok dengan nama bergaya Unicode.',
    commands: ['cn'],
  },
  {
    key: 'animechannel',
    label: 'Anime Channel',
    description: 'Auto-post info anime ke channel WhatsApp.',
    commands: ['animechannel', 'anime-channel'],
  },
  {
    key: 'verif',
    label: 'Verif TikTok',
    description: 'Verif ACC TikTok, pantauan akun, daftar verif, dan profil .me.',
    commands: [
      'verif',
      'veriv',
      'addakun',
      'tambahakun',
      'delakun',
      'hapusakun',
      'listakun',
      'daftarakun',
      'listverif',
      'listveriv',
      'unverif',
      'unveriv',
      'me',
      'profile',
    ],
  },
  {
    key: 'detector',
    label: 'Detector UP',
    description: 'Siapa UP hari ini, cek UP, riwayat, dan kelola detector.',
    commands: [
      'siapaup',
      'whoup',
      'cekup',
      'history',
      'detector',
      'detektor',
    ],
  },
  {
    key: 'tools',
    label: 'Alat Grup',
    description: 'Pengingat, polling, statistik, AFK, tagall, dan info bot.',
    commands: [
      'ingatkan',
      'remind',
      'pengingat',
      'poll',
      'voting',
      'statistik',
      'stats',
      'stat',
      'topaktif',
      'topactive',
      'topchat',
      'welcome',
      'sambutan',
      'goodbye',
      'selamattinggal',
      'pamit',
      'bye',
      'afk',
      'back',
      'unafk',
      'kembali',
      'tagall',
      'ping',
      'status',
      'health',
      'whoami',
    ],
  },
  {
    key: 'memory',
    label: 'Ingatan Pribadi',
    description: 'Simpan fakta pribadi lewat chat pribadi dan lihat apa yang diingat.',
    commands: ['ingat', 'ingatan', 'catat', 'note', 'notes'],
  },
  {
    key: 'moderation',
    label: 'Moderasi & Admin',
    description: 'Peraturan, antilink, antispam, mute, jadwal, dan mode grup.',
    commands: [
      'peraturan',
      'rules',
      'jadwal',
      'jadwalgrup',
      'antilink',
      'antispam',
      'moderasi',
      'resetwarn',
      'mute',
      'unmute',
      'modegrup',
      'groupmode',
    ],
  },
];

// Alias nama fitur yang ramah dipakai di chat.
const FEATURE_ALIASES = {
  sticker: 'sticker',
  stiker: 'sticker',
  quote: 'qc',
  qc: 'qc',
  quotecard: 'qc',
  image: 'media',
  gambar: 'media',
  animechannel: 'animechannel',
  'anime-channel': 'animechannel',
  verifikasi: 'verif',
  tiktok: 'detector',
  moderation: 'moderation',
  moderasi: 'moderation',
  admin: 'moderation',
  alat: 'tools',
  tools: 'tools',
  grup: 'tools',
  memori: 'memory',
  ingatan: 'memory',
  memory: 'memory',
};

const COMMAND_FEATURE = new Map();
for (const feature of FEATURES) {
  for (const command of feature.commands) {
    if (!COMMAND_FEATURE.has(command)) COMMAND_FEATURE.set(command, feature.key);
  }
}

function cleanToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[#./!]+/, '');
}

function featureForCommand(command) {
  return COMMAND_FEATURE.get(cleanToken(command)) || '';
}

function isKnownCommand(command) {
  return COMMAND_FEATURE.has(cleanToken(command));
}

/**
 * Nama perintah yang valid untuk override `.fitur on/off` per perintah.
 * Mengembalikan string kosong jika bukan perintah yang terdaftar.
 */
function normalizeCommandKey(value) {
  const cmd = cleanToken(value);
  return COMMAND_FEATURE.has(cmd) ? cmd : '';
}

function allCommands() {
  return [...COMMAND_FEATURE.keys()];
}

function normalizeFeatureKey(value) {
  const raw = cleanToken(value);
  const key = FEATURE_ALIASES[raw] || raw;
  return FEATURES.some((f) => f.key === key) ? key : '';
}

function featureLabel(key) {
  const feature = FEATURES.find((f) => f.key === key);
  return feature ? feature.label : String(key || '');
}

function featureByKey(key) {
  return FEATURES.find((f) => f.key === key) || null;
}

function featureList() {
  return FEATURES.map((f) => ({ ...f, commands: f.commands.slice() }));
}

module.exports = {
  FEATURES,
  featureForCommand,
  isKnownCommand,
  normalizeCommandKey,
  allCommands,
  normalizeFeatureKey,
  featureLabel,
  featureByKey,
  featureList,
};
