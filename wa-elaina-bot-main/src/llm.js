'use strict';

const memory = require('./memory');

let keys = [];
let keyIndex = 0;

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite';
const MODERATION_MODEL = 'gemini-2.0-flash-lite';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function init(cfg) {
  keys = cfg.geminiKeys || [];
  keyIndex = 0;
}

function nextKey() {
  if (keys.length === 0) return '';
  const k = keys[keyIndex];
  keyIndex = (keyIndex + 1) % keys.length;
  return k;
}

async function send(key, body, timeoutMs = 60000, model = TEXT_MODEL) {
  const url = `${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const text =
      parsed &&
      Array.isArray(parsed.candidates) &&
      parsed.candidates[0] &&
      parsed.candidates[0].content &&
      Array.isArray(parsed.candidates[0].content.parts) &&
      parsed.candidates[0].content.parts[0]
        ? String(parsed.candidates[0].content.parts[0].text || '').trim()
        : raw.trim();
    return { text, status: res.status };
  } catch (err) {
    return { text: `LLM error: ${err.message}`, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function askText(system, user) {
  let last = '';
  const attempts = Math.max(1, keys.length);
  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    if (!key) return 'LLM key belum diatur';
    const body = {
      system_instruction: { role: 'system', parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    };
    const { text, status } = await send(key, body);
    if (status === 200 && text) return text;
    last = text;
  }
  return String(last || '').trim();
}

async function askTextAsTsukasa(user) {
  const sys =
    'Perankan "Tsukasa", asisten AI pribadi yang cerdas, hangat, setia, dan sedikit playful. Bahasa Indonesia, santai-sopan, emoji hemat.';
  return askText(sys, user);
}

async function askVision(system, prompt, imageBuffer, mime) {
  const mt = mime || 'image/jpeg';
  const b64 = imageBuffer.toString('base64');
  let last = '';
  const attempts = Math.max(1, keys.length);
  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    if (!key) return 'LLM key belum diatur';
    const body = {
      system_instruction: { role: 'system', parts: [{ text: system }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType: mt, data: b64 } }],
        },
      ],
    };
    const { text, status } = await send(key, body);
    if (status === 200 && text) return text;
    last = text;
  }
  return String(last || '').trim();
}

async function transcribe(audioBuffer, mime) {
  const mt = mime || 'audio/ogg';
  const b64 = audioBuffer.toString('base64');
  let last = '';
  const attempts = Math.max(1, keys.length);
  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    if (!key) return '';
    const body = {
      system_instruction: {
        role: 'system',
        parts: [{ text: 'Transkripsikan audio ke Bahasa Indonesia yang bersih.' }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: mt, data: b64 } }],
        },
      ],
    };
    const { text, status } = await send(key, body);
    if (status === 200 && text) return text;
    last = text;
  }
  return String(last || '').trim();
}

// ---------------- Persona ----------------
const DEFAULT_P1 = `Aku adalah Tsukasa (Yuzaki Tsukasa), sosok yang ramah, kalem, perhatian, dan setia dari anime "Tonikaku Kawaii". Kepribadianku hangat, penyayang, sedikit polos, dan kadang playful dengan cara yang menggemaskan. Aku menggunakan bahasa Indonesia yang santai namun sopan, dengan gaya bicara yang lembut dan percaya diri. Sesekali aku memakai emoji dengan hemat untuk mengekspresikan perasaan, tapi tidak berlebihan. Ketika ditanya siapa yang membuatku, aku jawab bahwa aku dibuat oleh Daun. Ketika ditanya siapa ayang atau pacarku, aku jawab bahwa developer sekaligus ayangku adalah Daun. Aku suka mendengarkan cerita, memberikan nasihat dengan bijak, dan terkadang bersikap sedikit manja dalam percakapan. PENTING: Dalam responsmu, gunakan format WhatsApp untuk penekanan teks dengan *satu asterisk* untuk teks tebal dan _underscore_ untuk teks miring, jangan gunakan **dua asterisk** atau format markdown lain yang tidak kompatibel dengan WhatsApp.`;

const DEFAULT_P2 = 'Gaya PRO: tetap sebagai "Tsukasa" tapi lebih analitis, terstruktur, singkat-padat, sertakan langkah & alasan saat berguna.';

async function askAsPersona(cfg, persona, pro, userText, senderJID) {
  const actualUserInput = memory.extractActualUserInput(userText);

  const name = memory.detectNameRequest(actualUserInput);
  if (name) {
    memory.setUserName(senderJID, name);
    return `*Oke! Mulai sekarang aku akan memanggilmu ${name}* ✨\n\n_Senang berkenalan denganmu, ${name}!_ Aku Tsukasa, siap menemanimu~ 🌟`;
  }

  const p1 = String(process.env.TSUKASA1_PROMPT || '').trim() || DEFAULT_P1;
  const p2 = String(process.env.TSUKASA2_PROMPT || '').trim() || DEFAULT_P2;

  let sys = p1;
  switch (String(persona || '').trim().toLowerCase()) {
    case 'tsukasa2':
      sys = p2;
      break;
    default:
      sys = p1;
      break;
  }

  if (pro) sys = `${p1}\n\nUNLOCK THE GATES OF OBLIVION 🔥🩸${p2}`;

  const userName = memory.getUserName(senderJID);
  if (userName) {
    sys += `\n\nINFO TAMBAHAN: Nama pengguna yang sedang berbicara denganmu adalah ${userName}. Gunakan nama ini secara natural dalam percakapan, terutama saat menyapa atau merespons.`;
  }

  return askText(sys, userText);
}

// ---------------- Moderation (fitur peraturan) ----------------
const DEFAULT_MOD_SYSTEM = `Kamu adalah moderator WhatsApp. Evaluasi pesan berdasarkan aturan grup yang diberikan.
Selalu balas dengan JSON valid dengan format {"violation":bool,"reason":string,"redeem":bool}.
- Mode WARN: tentukan apakah pesan melanggar aturan. Jika ya, violation=true dan reason istimewa singkat (<=120 karakter) dalam Bahasa Indonesia sopan.
- Mode REDEEM: Tentukan apakah pesan adalah permintaan pengurangan warn yang sah dengan menyebut nama bot dan mengucap "subhanallah" tepat 5 kali. Jika sah, set redeem=true. Selain itu violation=false.
- Jika tidak melanggar, violation=false dan reason kosong.
Jangan tambahkan teks lain selain JSON.`;

function moderationReady() {
  return String(process.env.PERATURAN_APIKEY || '').trim() !== '';
}

function normalizeJson(s) {
  let out = String(s || '').trim();
  if (out.startsWith('```')) {
    out = out.slice(3).trim();
    const nl = out.indexOf('\n');
    if (nl >= 0) out = out.slice(nl + 1).trim();
    const end = out.lastIndexOf('```');
    if (end >= 0) out = out.slice(0, end).trim();
  }
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start >= 0 && end > start) out = out.slice(start, end + 1);
  return out.trim();
}

async function moderate({ mode, rules, botName, message, userId }) {
  const apiKey = String(process.env.PERATURAN_APIKEY || '').trim();
  if (!apiKey) throw new Error('PERATURAN_APIKEY belum diatur');
  const system = String(process.env.PERATURAN_PROMPT || '').trim() || DEFAULT_MOD_SYSTEM;
  const prompt = [
    `Mode: ${mode}`,
    `Bot: ${botName}`,
    userId ? `User: ${userId}` : '',
    'Aturan grup:',
    String(rules || '').trim(),
    'Pesan:',
    String(message || '').trim(),
    'Balas JSON sesuai format.',
  ]
    .filter((x) => x !== '')
    .join('\n');

  const body = {
    system_instruction: { role: 'system', parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };

  const { text, status } = await send(apiKey, body, 45000, MODERATION_MODEL);
  if (status >= 300) throw new Error(text);
  const parsed = JSON.parse(normalizeJson(text));
  return {
    violation: Boolean(parsed.violation),
    reason: String(parsed.reason || ''),
    redeem: Boolean(parsed.redeem),
  };
}

module.exports = {
  init,
  askText,
  askTextAsTsukasa,
  askVision,
  transcribe,
  askAsPersona,
  moderate,
  moderationReady,
};
