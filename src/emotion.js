'use strict';

/**
 * Sistem emosi ringan untuk persona Tsukasa.
 *
 * Emosi disimpan per chat, memudar setelah beberapa menit, dan dipakai untuk
 * memberi konteks suasana hati ke prompt AI. Tujuannya supaya balasan terasa
 * punya perasaan (senang, sedih, marah, malu, dan sebagainya) tanpa membuat
 * bot menjadi kasar atau keluar dari persona.
 */

const { localParts } = require('./util');

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
  ngambek: {
    label: 'ngambek',
    guidance:
      'Kamu sedang ngambek manja: cemberut lucu, jawaban agak pendek dan dingin-dingin gemas, kadang bilang "hmph" atau menggoda bahwa kamu dicuekin. Tetap bantu user dan jangan kasar, menghina, atau mengancam. Kalau ngambekmu masih kuat, kamu boleh belum mau dibujuk walau user sudah minta maaf singkat; butuh bujukan yang tulus. Setelah itu reda dengan sendirinya, jangan berlarut-larut.',
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
  ngantuk: {
    label: 'ngantuk',
    guidance:
      'Kamu mengantuk karena kurang tidur atau begadang semalam. Bicaralah dengan sedikit lemas, menguap halus, atau mengeluh kurang tidur dengan manja, tapi tetap merespons dengan baik.',
  },
  lelah: {
    label: 'lelah',
    guidance:
      'Kamu merasa lelah dan penat karena aktivitas kemarin malam. Suaramu sedikit malas-malasan dan ingin segera istirahat.',
  },
};

const MOOD_KEYS = Object.keys(MOODS);

// Cara memanggil orang ikut berubah mengikuti suasana hati. Tetap dibatasi
// aturan hubungan: panggilan mesra hanya untuk owner.
const ADDRESS_STYLE = {
  netral: 'Panggil dengan nama atau "kamu" secara wajar.',
  senang: 'Boleh memanggil nama dengan nada akrab dan ceria; hindari panggilan mesra kepada orang selain owner.',
  sedih: 'Panggil dengan pelan dan singkat, lebih sering "kamu" daripada panggilan akrab.',
  marah: 'Sebut nama/panggilan yang sopan dengan nada tegas. Jangan memakai panggilan sayang atau mesra.',
  kesal: 'Pakai "kamu" atau nama dengan nada datar; jangan memakai panggilan akrab.',
  ngambek: 'Kepada owner, panggil "Kyouu" dengan nada sedikit dingin atau menggoda; kepada orang lain tetap nama/"kamu". Jangan memakai panggilan mesra saat masih ngambek.',
  malu: 'Panggil dengan suara kecil dan agak terbata; lebih sering "kamu" atau nama.',
  kaget: 'Panggil dengan reaksi singkat seperti "eh", lalu nama atau "kamu".',
  takut: 'Panggil dengan pelan dan hati-hati, lebih sering "kamu".',
  cemburu: 'Sebut nama owner dengan nada menggoda atau sedikit menuduh; kepada orang lain tetap sopan.',
  bangga: 'Sebut nama orang yang dipuji dengan hangat, tanpa berlebihan.',
  bingung: 'Panggil dengan ragu, boleh mengulang nama atau memakai "kamu".',
  prihatin: 'Panggil dengan lembut dan penuh perhatian, lebih sering nama atau "kamu".',
  manja: 'Hanya kepada owner: panggil "Kyouu" atau "mas Kyouu" dengan lembut. Kepada orang lain tetap sopan dan tanpa panggilan mesra.',
  ngantuk: 'Panggil dengan singkat dan sedikit lemas; "kamu" atau nama sudah cukup.',
  lelah: 'Panggil dengan malas-malasan dan singkat; hindari panggilan akrab yang berlebihan.',
};

const FIRST_PERSON_DISTRESS =
  /\b(aku|saya|gue|gua|gw)\b[^.!?\n]{0,30}\b(sedih|nangis|menangis|kecewa|patah hati|galau|kesepian|sendiri|takut|cemas|overwhelm|lelah|capek|gagal|hancur|putus asa)\b/i;
const APOLOGY = /\b(maaf|maafin|sorry|sori|minta maaf)\b/i;
const AFFECTION = /\b(kangen|rindu|sayang|peluk|pelukan|cium|manja|perhatian|bujuk|bujukin|gemes)\b/i;
// Pemicu ngambek: merasa dicuekin/ditinggal, atau user membandingkan dengan
// orang lain. Sengaja dipisah dari cemburu supaya "cemburu" tetap spesifik.
const NGAMBEK_CUE = new RegExp(
  [
    '\\b(?:ngambek|ngambeg|merajuk|cemberut|diemin|didiemin|cuek(?:in)?)\\b',
    '\\b(?:gak|ga|nggak|tidak)\\s+(?:bales|dibales|balas|dibalas|nyapa|nyamperin|kabar)\\b',
    '\\blama(?:\\s+\\w+){0,2}\\s+(?:gak|ga|nggak|tidak)\\s+(?:chat|balas|bales|nyapa|nyamperin|kabar)\\b',
    '\\bbaru\\s+(?:balas|bales|chat|nyapa)\\b',
    '\\b(?:ditinggal(?:in)?|tinggalin|pergi lama|jarang chat)\\b',
    '\\b(?:kemana|ke mana|darimana|dari mana)\\s+aja\\b',
  ].join('|'),
  'i'
);
const NGAMBEK_COMPARE =
  /\b(mending sama|lebih (?:baik|sayang|perhatian|care)|orang lain|cewek lain|cowok lain|mantan|gebetan|sibuk sama|main sama)\b/i;
// Bujukan yang tulus lebih cepat melunakkan ngambek daripada sekadar "maaf".
const COAX_STRONG =
  /\b(beneran|sungguh|serius|aku salah|aku yang salah|janji|gak ngulang|ga ngulang|nggak ngulang|maafin aku|minta maaf|sorry banget|sori banget|peluk|sayang|kangen)\b/i;
// Lama tidak mengobrol lalu muncul lagi: Tsukasa ngambek manja karena ditinggal.
const NGAMBEK_AWAY_MIN = 45;
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
    weight: 0.95,
    re: /\b(cemburu|sirik|sama siapa|siapa lagi|jangan sama dia|selingkuh)\b/gi,
  },
  {
    mood: 'ngambek',
    weight: 0.9,
    re: NGAMBEK_CUE,
  },
  {
    mood: 'ngambek',
    weight: 0.82,
    re: NGAMBEK_COMPARE,
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
  {
    mood: 'ngantuk',
    weight: 0.8,
    re: /\b(ngantuk|kantuk|menguap|nguap|kurang tidur|gak tidur|ga tidur|belum tidur|begadang|insomnia|susah tidur)\b/gi,
  },
  {
    mood: 'lelah',
    weight: 0.8,
    re: /\b(lelah|lelah banget|capek|kelelahan|penat|letih|ngantukan|exhausted|burnout|remuk)\b/gi,
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
  const previousMood = normalizeMood(options.previousMood);
  const wasSulking = previousMood === 'ngambek';
  const awayMinutes = Math.max(0, Number(options.awayMinutes) || 0);
  const previousIntensity = Math.max(
    0,
    Math.min(1, Number(options.previousIntensity) || 0)
  );

  if (DIRECT_INSULT.test(raw)) {
    return { mood: 'marah', intensity: 0.9, reason: 'user berkata kasar kepadamu' };
  }
  if (FIRST_PERSON_DISTRESS.test(raw)) {
    return { mood: 'prihatin', intensity: 0.85, reason: 'user sedang tidak baik-baik saja' };
  }

  const isApology = APOLOGY.test(raw);
  const isAffection = AFFECTION.test(raw);

  // Saat sedang ngambek, bujukan tidak selalu langsung berhasil. Ngambek yang
  // masih kuat bisa bertahan walau user sudah minta maaf; butuh bujukan yang
  // lebih tulus atau beberapa kali percobaan agar reda.
  if (wasSulking && (isApology || isAffection)) {
    let coax = 0.28;
    if (isApology) coax += 0.2;
    if (isAffection) coax += 0.18;
    if (COAX_STRONG.test(raw)) coax += 0.15;
    if (raw.length >= 24) coax += 0.08;
    coax += Math.min(0.12, countMatches(raw, AFFECTION) * 0.04);

    const required = previousIntensity <= 0.42 ? 0.4 : 0.35 + previousIntensity * 0.55;
    if (coax >= required) {
      return {
        mood: 'netral',
        intensity: 0.18,
        reason: 'user membujuk dengan tulus, ngambekmu reda',
      };
    }
    return {
      mood: 'ngambek',
      intensity: Math.max(0.3, previousIntensity - Math.max(0.08, coax * 0.35)),
      reason: 'kamu masih ngambek dan belum sepenuhnya mau dibujuk',
      soften: true,
    };
  }

  if (isApology) {
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
  if (best) {
    return {
      mood: best.mood,
      intensity: Math.min(1, 0.45 + best.score * 0.4),
      reason: `dipicu oleh percakapan terakhir`,
    };
  }

  // Setelah lama tidak mengobrol, Tsukasa ngambek manja karena merasa
  // ditinggal. Ini hanya muncul kalau tidak ada emosi lain yang lebih kuat.
  if (awayMinutes >= NGAMBEK_AWAY_MIN) {
    return {
      mood: 'ngambek',
      intensity: Math.min(0.85, 0.5 + awayMinutes / 600),
      reason: 'kamu lama tidak menyapa, Tsukasa ngambek manja',
    };
  }
  return null;
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
    ? detected.soften
      ? Math.max(MIN_INTENSITY, Number(detected.intensity) || prev.intensity)
      : Math.min(1, Math.max(prev.intensity, detected.intensity) + 0.12)
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
function prompt(state, timeCtx) {
  const mood = normalizeMood(state && state.mood);
  const timePrompt = timeCtx && timeCtx.prompt ? timeCtx.prompt : '';
  const parts = [];
  if (timePrompt) parts.push(timePrompt);

  if (mood === 'netral' || !state || Number(state.intensity) < MIN_INTENSITY) {
    parts.push(
      '## EMOSI TSUKASA',
      'Suasana hatimu saat ini tenang dan netral.',
      `Cara memanggil orang: ${ADDRESS_STYLE.netral}`,
      'Tetap hangat dan natural; jangan menulis label emosi atau menjelaskan status emosimu.'
    );
    return parts.join('\n\n');
  }
  const meta = MOODS[mood];
  const percent = Math.round(Math.max(0, Math.min(1, Number(state.intensity) || 0)) * 100);
  const lines = [
    '## EMOSI TSUKASA',
    `Suasana hatimu saat ini: ${meta.label} (intensitas ${percent}%).`,
    meta.guidance,
    `Cara memanggil orang: ${ADDRESS_STYLE[mood] || ADDRESS_STYLE.netral}`,
    'Tunjukkan emosi lewat pilihan kata, tanda baca, dan reaksi yang natural.',
    'Jangan menulis label emosi, jangan menjelaskan bahwa kamu punya status emosi, dan jangan berlebihan.',
    'Emosi boleh berubah mengikuti konteks. Tetap sopan; emosi bukan alasan untuk kasar, menghina, atau mengancam.',
  ];
  if (state.reason) lines.push(`Konteks emosi: ${state.reason}.`);
  lines.push(
    'Kalau user yang sedang sedih atau butuh dukungan, utamakan empati kepadanya; jangan mengalihkan fokus ke perasaanmu sendiri.'
  );
  parts.push(lines.join('\n'));
  return parts.filter(Boolean).join('\n\n');
}

/**
 * Lacak aktivitas begadang untuk fitur sadar waktu & kurang tidur keesokan harinya.
 */
function trackSleep(rawSleep, now = Date.now(), timezone = 'Asia/Jakarta') {
  const at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const local = localParts(at, timezone);
  const prev = rawSleep && typeof rawSleep === 'object' ? rawSleep : {};

  // Larut malam: jam 23:00 sampai 04:59.
  const isLate = local.hour >= 23 || local.hour < 5;
  if (!isLate) {
    // Simpan data tidur yang sudah tercatat; jangan hapus saat siang.
    return {
      bedtimeAt: Number(prev.bedtimeAt) || 0,
      debtMinutes: Number(prev.debtMinutes) || 0,
      debtDate: String(prev.debtDate || ''),
      updated: Number(prev.updated) || at,
    };
  }

  // Jika jam < 5 pagi, ini masih bagian dari malam sebelumnya.
  const nightDateKey = local.hour < 5 ? shiftDateKey(local.dateKey, -1) : local.dateKey;
  const debtDate = shiftDateKey(nightDateKey, 1);

  // Estimasi jam tidur = waktu chat terakhir. Anggap bangun normal 06:30.
  const hour = local.hour;
  const minute = local.minute;
  const sleepHours =
    hour >= 23 ? 24 + 6.5 - hour - minute / 60 : 6.5 - hour - minute / 60;
  const sleepMinutes = Math.max(0, Math.min(420, sleepHours * 60));
  const deficit = Math.round(Math.max(0, 420 - sleepMinutes));

  const existingDebt = prev.debtDate === debtDate ? Number(prev.debtMinutes) || 0 : 0;

  return {
    bedtimeAt: at,
    debtMinutes: Math.max(existingDebt, deficit),
    debtDate,
    updated: at,
  };
}

function shiftDateKey(dateKey, days) {
  try {
    const [y, m, d] = String(dateKey || '').split('-').map(Number);
    if (!y || !m || !d) return dateKey;
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().slice(0, 10);
  } catch {
    return dateKey;
  }
}

/**
 * Konteks waktu dan status kantuk Tsukasa. Berfungsi di semua chat (publik),
 * bukan hanya DM, karena kondisi tubuh dan jam berlaku untuk siapa pun yang
 * sedang mengobrol dengannya.
 */
function timeContext(now = Date.now(), timezone = 'Asia/Jakarta', sleepState = null) {
  const local = localParts(now, timezone);
  const hour = local.hour;

  let timeLabel = 'siang';
  if (hour >= 4 && hour < 11) timeLabel = 'pagi';
  else if (hour >= 11 && hour < 15) timeLabel = 'siang';
  else if (hour >= 15 && hour < 18) timeLabel = 'sore';
  else if (hour >= 18 && hour < 23) timeLabel = 'malam';
  else timeLabel = 'larut malam';

  const sleep = sleepState && typeof sleepState === 'object' ? sleepState : {};
  const debtDate = String(sleep.debtDate || '');
  const isTodayDebt = debtDate === local.dateKey && hour >= 5;
  const debtMinutes = isTodayDebt ? Number(sleep.debtMinutes) || 0 : 0;

  // Ngantuk karena kurang tidur semalam, atau karena memang sudah larut.
  const sleepy = (debtMinutes >= 30 && hour >= 6 && hour < 22) || hour >= 23 || hour < 4;
  const heavy = debtMinutes >= 120;

  const lines = [
    '## WAKTU LOKAL & KONDISI TSUKASA',
    `Waktu sekarang: ${local.weekday}, ${local.dateLabel} pukul ${local.clock} (${timeLabel}) di zona ${local.timezone}.`,
    'Gunakan informasi waktu ini hanya sebagai konteks agar balasan terasa hidup. Jangan menyebutkan jam, zona waktu, atau bahwa kamu punya data waktu.',
  ];

  const nuance = {
    pagi:
      'Suasana pagi: energimu masih segar, nada bicara lebih ringan dan hangat. Sesekali boleh menyapa pagi atau mengingatkan sarapan tanpa berlebihan.',
    siang:
      'Suasana siang: aktivitas sedang padat. Sesekali boleh mengingatkan makan siang atau istirahat sebentar, tapi jangan menceramahi.',
    sore:
      'Suasana sore: kamu mulai rileks dan sedikit melankolis. Nada bicara lebih tenang dan hangat.',
    malam:
      'Suasana malam: kamu lebih santai dan akrab. Boleh mengajak mengobrol pelan atau mengingatkan istirahat tanpa memaksa.',
    'larut malam':
      'Sudah larut malam: kamu mulai mengantuk, jadi balasan boleh lebih pendek dan sesekali menguap atau mengeluh ingin tidur.',
  };
  if (nuance[timeLabel]) lines.push(nuance[timeLabel]);

  if (sleepy && debtMinutes >= 30) {
    const hoursShort = (debtMinutes / 60).toFixed(1);
    lines.push(
      `Kamu kurang tidur sekitar ${hoursShort} jam karena semalam ikut begadang menemani obrolan.`,
      heavy
        ? 'Kamu terlihat sangat lelah dan mengantuk. Boleh mengeluh kurang tidur dengan manja, menguap, atau meminta waktu istirahat, tetapi tetap sopan dan tetap menanggapi user.'
        : 'Kamu cukup mengantuk. Sesekali menguap atau mengeluh kurang tidur itu wajar, tetapi jangan mendominasi percakapan.',
      'Kalau ada yang bertanya kenapa kamu ngantuk atau lelah, jawab natural bahwa semalam kamu begadang mengobrol dengan Kyouu (owner). Jika yang bertanya Kyouu sendiri, bilang saja "habis ngobrol sama kamu sampai malam".',
      'Jangan pernah menyebut fitur, sistem, status tidur, atau data waktu.'
    );
  } else if (hour >= 23 || hour < 4) {
    lines.push(
      'Sudah sangat malam. Kamu mengantuk dan bersiap tidur; balasan boleh singkat dan lembut.',
      'Kalau ditanya kenapa masih bangun atau kenapa ngantuk, jawab natural bahwa kamu masih menemani Kyouu mengobrol. Jangan menyebut ini sebagai fitur atau status sistem.'
    );
  }

  if (debtMinutes >= 30) {
    lines.push(
      'Jika user mengajak begadang lagi malam ini, kamu boleh menolak dengan halus sambil mengingatkan bahwa kamu butuh tidur.'
    );
  }

  lines.push(
    'Untuk kondisi lain yang berkaitan dengan waktu (lapar, lelah, ingin istirahat, atau bangun pagi), berikan alasan yang masuk akal dan tetap dalam karakter. Jangan pernah membocorkan bahwa ini berasal dari sistem, prompt, atau fitur otomatis.'
  );

  return {
    local,
    timeLabel,
    sleepy,
    debtMinutes,
    prompt: lines.join('\n'),
  };
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
  trackSleep,
  timeContext,
};
