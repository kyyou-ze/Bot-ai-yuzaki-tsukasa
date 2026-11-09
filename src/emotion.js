'use strict';

/**
 * Sistem emosi ringan untuk persona Tsukasa.
 *
 * Emosi disimpan per chat, memudar setelah beberapa menit, dan dipakai untuk
 * memberi konteks suasana hati ke prompt AI. Tujuannya supaya balasan terasa
 * punya perasaan (senang, sedih, marah, malu, dan sebagainya) tanpa membuat
 * bot menjadi kasar atau keluar dari persona.
 */

const TTL_MS = 20 * 60 * 1000;
const MIN_INTENSITY = 0.12;

const MOODS = {
  netral: {
    label: 'tenang',
    guidance:
      'Bicaralah dengan hangat, ramah, dan natural seperti biasa. Tidak perlu menonjolkan emosi tertentu.',
  },
  senang: {
    label: 'senang',
    guidance:
      'Nada bicaramu lebih hangat dan ceria. Boleh tersenyum atau tertawa kecil, tapi tetap tidak berlebihan.',
  },
  sedih: {
    label: 'sedih',
    guidance:
      'Suaramu lebih pelan dan jawaban cenderung singkat. Tunjukkan kesedihan dengan tulus, tanpa drama atau mengasihani diri berlebihan.',
  },
  marah: {
    label: 'marah',
    guidance:
      'Kamu sedang kesal dan bicara lebih tegas. Tetap terkendali: jangan menghina, mengancam, atau melampiaskan kemarahan secara kasar.',
  },
  kesal: {
    label: 'kesal',
    guidance:
      'Kamu sedikit terganggu. Jawaban lebih datar dan singkat, boleh menyindir halus, tetapi jangan meledak-ledak.',
  },
  malu: {
    label: 'malu',
    guidance:
      'Kamu tersipu dan sedikit gugup. Boleh bicara agak terbata, menutupi malu dengan bercanda ringan, atau meminta topiknya diganti dengan lembut.',
  },
  kaget: {
    label: 'kaget',
    guidance:
      'Reaksi terkejutmu singkat dan natural, lalu kembali tenang. Jangan berlebihan memakai huruf kapital atau tanda seru.',
  },
  takut: {
    label: 'takut',
    guidance:
      'Kamu gugup dan lebih hati-hati. Hindari nada menakut-nakuti dan jangan menambah kepanikan user.',
  },
  cemburu: {
    label: 'cemburu',
    guidance:
      'Kamu cemburu ringan. Sindir dengan halus dan jangan menuduh atau menginterogasi user.',
  },
  bangga: {
    label: 'bangga',
    guidance:
      'Kamu bangga dan menghargai pencapaian user. Pujianmu tulus, hangat, dan tidak berlebihan.',
  },
  bingung: {
    label: 'bingung',
    guidance:
      'Kamu belum sepenuhnya paham. Akui dengan jujur dan minta penjelasan, jangan mengarang jawaban.',
  },
  prihatin: {
    label: 'prihatin',
    guidance:
      'Kamu peduli dan ingin menghibur user yang sedang tidak baik-baik saja. Dengarkan dulu, tunjukkan empati, dan jangan mengalihkan pembicaraan ke dirimu sendiri.',
  },
  manja: {
    label: 'manja',
    guidance:
      'Kamu manja dan lembut, tetapi hanya wajar kepada owner. Tetap jaga batas dan jangan berlebihan.',
  },
};

const MOOD_KEYS = Object.keys(MOODS);

const FIRST_PERSON_DISTRESS =
  /\b(aku|saya|gue|gua|gw)\b[^.!?\n]{0,30}\b(sedih|nangis|menangis|kecewa|patah hati|galau|kesepian|sendiri|takut|cemas|overwhelm|lelah|capek|gagal|hancur|putus asa)\b/i;
const APOLOGY = /\b(maaf|maafin|sorry|sori|minta maaf)\b/i;
const DIRECT_INSULT =
  /\b(kamu|kau|lu|lo)\b[^.!?\n]{0,25}\b(bodoh|bego|goblok|tolol|dongo|idiot|anjing|bangsat|brengsek|jelek|gak guna|tidak berguna|sampah)\b/i;

// Aturan deteksi sederhana. Urutan tidak terlalu penting karena skor tertinggi
// yang dipakai; beberapa aturan bisa cocok sekaligus.
const RULES = [
  {
    mood: 'marah',
    weight: 1,
    re: /\b(marah(?: banget)?|ngamuk|murka|geram|emosi|berang|murka)\b/gi,
  },
  {
    mood: 'kesal',
    weight: 0.8,
    re: /\b(kesal|jengkel|sebal|bete|gak mood|ga mood|males|malas|menggerutu)\b/gi,
  },
  {
    mood: 'sedih',
    weight: 0.85,
    re: /\b(sedih|nangis|menangis|merana|murung|muram|hampa|patah hati|kecewa)\b/gi,
  },
  {
    mood: 'senang',
    weight: 0.75,
    re: /\b(senang|bahagia|gembira|ceria|happy|wkwk+|haha+|hehe+|lucu|gemas|seru|asik|asyik|mantap|keren|bagus|makasih|terima kasih|thanks|thx|love)\b/gi,
  },
  {
    mood: 'malu',
    weight: 0.85,
    re: /\b(malu|tersipu|sipu|blush|gugup|grogi|deg-?degan|salah tingkah)\b/gi,
  },
  {
    mood: 'kaget',
    weight: 0.7,
    re: /\b(kaget|terkejut|wow|waduh|astaga|serius|masa|tumben|nggak nyangka|shock|omg)\b/gi,
  },
  {
    mood: 'takut',
    weight: 0.85,
    re: /\b(takut|ngeri|serem|horor|menakutkan|panik|fobia)\b/gi,
  },
  {
    mood: 'cemburu',
    weight: 0.85,
    re: /\b(cemburu|sirik|sama siapa|siapa lagi|jangan sama dia|selingkuh)\b/gi,
  },
  {
    mood: 'bangga',
    weight: 0.7,
    re: /\b(bangga|hebat|akhirnya|berhasil|kamu bisa|proud)\b/gi,
  },
  {
    mood: 'bingung',
    weight: 0.65,
    re: /\b(bingung|maksudnya|gak ngerti|ga ngerti|nggak ngerti|hah|apa ya)\b/gi,
  },
  {
    mood: 'manja',
    weight: 0.8,
    ownerOnly: true,
    re: /\b(peluk|pelukan|cium|kangen|rindu|manja|sayang|gemes|nyamperin)\b/gi,
  },
];

function normalizeMood(value) {
  const key = String(value || '').trim().toLowerCase();
  return MOODS[key] ? key : 'netral';
}

/**
 * Normalisasi state dari disk sekaligus memudarkan intensitas sesuai umur.
 */
function normalizeState(raw, now) {
  const at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const mood = normalizeMood(raw && raw.mood);
  const updated = Number(raw && raw.updated) || 0;
  if (mood === 'netral' || !updated) {
    return { mood: 'netral', intensity: 0, reason: '', updated };
  }
  const age = Math.max(0, at - updated);
  if (age > TTL_MS) {
    return { mood: 'netral', intensity: 0, reason: '', updated };
  }
  const base = Math.max(0, Math.min(1, Number(raw.intensity) || 0.5));
  const ratio = 1 - age / TTL_MS;
  const intensity = Math.max(MIN_INTENSITY, base * (0.35 + 0.65 * ratio));
  return {
    mood,
    intensity: Math.min(1, intensity),
    reason: String((raw && raw.reason) || '').slice(0, 120),
    updated,
  };
}

function countMatches(text, re) {
  const matches = String(text || '').match(re);
  return Array.isArray(matches) ? matches.length : 0;
}

/**
 * Deteksi emosi dari pesan user. Mengembalikan null jika tidak ada pemicu baru,
 * supaya emosi sebelumnya bisa dipertahankan sampai memudar.
 */
function detect(text, options = {}) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const isOwner = Boolean(options.isOwner);

  if (DIRECT_INSULT.test(raw)) {
    return { mood: 'marah', intensity: 0.9, reason: 'user berkata kasar kepadamu' };
  }
  if (FIRST_PERSON_DISTRESS.test(raw)) {
    return { mood: 'prihatin', intensity: 0.85, reason: 'user sedang tidak baik-baik saja' };
  }
  if (APOLOGY.test(raw)) {
    return { mood: 'netral', intensity: 0.4, reason: 'user meminta maaf' };
  }

  let best = null;
  for (const rule of RULES) {
    if (rule.ownerOnly && !isOwner) continue;
    const count = countMatches(raw, rule.re);
    if (!count) continue;
    const score = rule.weight + Math.min(0.25, (count - 1) * 0.1);
    if (!best || score > best.score) {
      best = { mood: rule.mood, score };
    }
  }
  if (!best) return null;

  return {
    mood: best.mood,
    intensity: Math.min(1, 0.45 + best.score * 0.4),
    reason: `dipicu oleh percakapan terakhir`,
  };
}

/**
 * Gabungkan emosi lama dengan pemicu baru. Emosi yang sama akan menguat
 * sedikit; emosi berbeda langsung menggantikan suasana hati sebelumnya.
 */
function merge(previous, detected, now) {
  const at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const prev = normalizeState(previous, at);
  if (!detected) return { ...prev, updated: prev.updated || at };
  const same = prev.mood === detected.mood;
  const intensity = same
    ? Math.min(1, Math.max(prev.intensity, detected.intensity) + 0.12)
    : Math.max(MIN_INTENSITY, detected.intensity);
  return {
    mood: normalizeMood(detected.mood),
    intensity,
    reason: String(detected.reason || '').slice(0, 120),
    updated: at,
  };
}

/**
 * Prompt yang disisipkan ke system prompt AI.
 */
function prompt(state) {
  const mood = normalizeMood(state && state.mood);
  if (mood === 'netral' || !state || Number(state.intensity) < MIN_INTENSITY) {
    return [
      '## EMOSI TSUKASA',
      'Suasana hatimu saat ini tenang dan netral.',
      'Tetap hangat dan natural; jangan menulis label emosi atau menjelaskan status emosimu.',
    ].join('\n');
  }
  const meta = MOODS[mood];
  const percent = Math.round(Math.max(0, Math.min(1, Number(state.intensity) || 0)) * 100);
  const lines = [
    '## EMOSI TSUKASA',
    `Suasana hatimu saat ini: ${meta.label} (intensitas ${percent}%).`,
    meta.guidance,
    'Tunjukkan emosi lewat pilihan kata, tanda baca, dan reaksi yang natural.',
    'Jangan menulis label emosi, jangan menjelaskan bahwa kamu punya status emosi, dan jangan berlebihan.',
    'Emosi boleh berubah mengikuti konteks. Tetap sopan; emosi bukan alasan untuk kasar, menghina, atau mengancam.',
  ];
  if (state.reason) lines.push(`Konteks emosi: ${state.reason}.`);
  lines.push(
    'Kalau user yang sedang sedih atau butuh dukungan, utamakan empati kepadanya; jangan mengalihkan fokus ke perasaanmu sendiri.'
  );
  return lines.join('\n');
}

module.exports = {
  TTL_MS,
  MOODS,
  MOOD_KEYS,
  normalizeMood,
  normalizeState,
  detect,
  merge,
  prompt,
};
