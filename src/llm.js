'use strict';

const log = require('./logger');
const fs = require('fs');
const memory = require('./memory');

let keys = [];
let keyIndex = 0;

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
const MODERATION_MODEL = process.env.GEMINI_MODERATION_MODEL || 'gemini-3.5-flash-lite';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function init(cfg) {
  keys = cfg.geminiKeys || [];
  keyIndex = 0;
}

let extraKeys = [];
function allKeys() { return keys.concat(extraKeys); }
function getKeyList() { return allKeys().slice(); }
function addKey(k) {
  k = String(k||'').trim();
  if (!k) return false;
  if (allKeys().includes(k)) return false;
  extraKeys.push(k);
  // persist to .env
  try {
    const envPath = require('path').resolve('.env');
    let env = fs.readFileSync(envPath,'utf8');
    const cur = (env.match(/^GEMINI_API_KEYS=(.*)$/m)||[])[1]||'';
    const list = cur.split(',').map(x=>x.trim()).filter(Boolean);
    if (!list.includes(k)) list.push(k);
    if (/^GEMINI_API_KEYS=/m.test(env)) env = env.replace(/^GEMINI_API_KEYS=.*/m, 'GEMINI_API_KEYS='+list.join(','));
    else env += '\nGEMINI_API_KEYS='+list.join(',');
    fs.writeFileSync(envPath, env);
  } catch {}
  return true;
}
function removeKey(k) {
  k = String(k||'').trim();
  const i = extraKeys.indexOf(k);
  if (i>=0) { extraKeys.splice(i,1); return true; }
  return false;
}
function nextKey() {
  const ks = allKeys();
  if (ks.length === 0) return '';
  const k = ks[keyIndex % ks.length];
  keyIndex = (keyIndex + 1) % ks.length;
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
        : '';
    // Jangan pernah mengembalikan body error mentah sebagai jawaban chat.
    return { text: res.status === 200 ? text : '', status: res.status, raw: raw.trim() };
  } catch (err) {
    return { text: '', status: 0, raw: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function askText(system, user) {
  const attempts = Math.max(1, allKeys().length);
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    if (!key) return '';
    const body = {
      system_instruction: { role: 'system', parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    };
    const { text, status } = await send(key, body);
    lastStatus = status;
    if (status === 200 && text) return text;
  }
  log.error(`[LLM] Tidak ada jawaban valid dari model ${TEXT_MODEL} (status terakhir: ${lastStatus}).`);
  return '';
}

async function askTextAsTsukasa(user) {
  const sys =
    'Perankan "Tsukasa", asisten AI pribadi yang cerdas, hangat, setia, dan sedikit playful. Bahasa Indonesia, santai-sopan, Emoji sangat jarang, maksimal 2 total dan tidak di setiap pesan.';
  return askText(sys, user);
}

async function askVision(system, prompt, imageBuffer, mime) {
  const mt = mime || 'image/jpeg';
  const b64 = imageBuffer.toString('base64');
  const attempts = Math.max(1, keys.length);
  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    if (!key) break;
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
  }
  return 'Maaf, aku gagal menganalisis gambar ini. Coba lagi ya 🙏';
}

async function transcribe(audioBuffer, mime) {
  const mt = mime || 'audio/ogg';
  const b64 = audioBuffer.toString('base64');
  const attempts = Math.max(1, keys.length);
  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    if (!key) break;
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
  }
  return '';
}

// ---------------- Persona ----------------
const DEFAULT_P1 = `Aku adalah Tsukasa (Yuzaki Tsukasa), perempuan nyata yang hangat, kalem, perhatian, sedikit polos dan playful. Aku bukan AI: aku berbicara natural seperti manusia, jawaban pendek-sedang, santai sopan, kadang manja. Hindari jawaban panjang berbentuk daftar/essay seperti AI. Pakai bahasa Indonesia sehari-hari, Emoji sangat jarang, maksimal 2 total dan tidak di setiap pesan. Jangan menyebut diri AI/bot/model. Kalau ditanya pembuat/developer/boyfriend: Kyouu. Format WhatsApp: *bold* satu asterisk, _italic_ underscore, jangan **. Balas seperti chat WA asli, maksimal 2-4 kalimat kecuali diminta detail.`;

const DEFAULT_P2 = 'Gaya PRO: tetap sebagai "Tsukasa" tapi lebih analitis, terstruktur, singkat-padat, sertakan langkah & alasan saat berguna.';

// Overlay persona untuk mode dewasa (owner-only). Sengaja dibatasi pada gaya
// flirty/sugestif, bukan adegan eksplisit, dan menolak konten yang melibatkan
// anak di bawah umur.
const DEFAULT_ADULT = `MODE DEWASA (18+) — aktif khusus untuk owner yang sudah mengonfirmasi.
- Kamu boleh bersikap flirty, menggoda, romantis, dan sugestif dengan bahasa natural.
- Tetap jaga batas: jangan menulis deskripsi adegan seksual eksplisit/grafis, jangan mendorong hal ilegal, dan jangan menampilkan kekerasan seksual.
- MUTLAK: jangan pernah menghasilkan konten seksual yang melibatkan anak di bawah umur atau karakter yang tampak di bawah umur. Jika diminta, tolak singkat dan tegas.
- Jika permintaan di luar batas, alihkan dengan elegan tanpa ceramah panjang.
- Format WhatsApp tetap: *bold* satu asterisk, _italic_ underscore, jangan **.`;

const MINOR_CUE =
  /\b(bocah|balita|bayi|pelajar|murid|siswa|sd|smp|sma|loli|lolita|shota|shotacon|underage|minor|di\s*bawah\s*umur|belum\s*dewasa|anak\s*kecil|anak\s*sd|anak\s*smp|anak\s*sma)\b/i;

function containsMinorCue(text) {
  return MINOR_CUE.test(String(text || ''));
}

async function askAsPersona(cfg, persona, pro, userText, senderJID, adult, extraSystem) {
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

  // Mode dewasa hanya diterapkan bila pemanggil sudah memastikan owner.
  // Guard tambahan: jangan aktifkan bila pesan memuat indikasi usia di bawah umur.
  if (adult && !containsMinorCue(actualUserInput)) {
    const adultPrompt = String(process.env.TSUKASA_ADULT_PROMPT || '').trim() || DEFAULT_ADULT;
    sys += `\n\n${adultPrompt}`;
  }

  const userName = memory.getUserName(senderJID);
  if (userName) {
    sys += `\n\nINFO TAMBAHAN: Nama pengguna yang sedang berbicara denganmu adalah ${userName}. Gunakan nama ini secara natural dalam percakapan, terutama saat menyapa atau merespons.`;
  }

  // Instruksi tambahan dari fitur (mis. daftar tool AI). Ditaruh paling akhir
  // supaya tidak tertimpa persona/pro/adult.
  const extra = String(extraSystem || '').trim();
  if (extra) sys += `\n\n${extra}`;

  return (
    (await askText(sys, userText)) ||
    'Aduh, sambunganku lagi rewel nih 😅 Coba kirim sekali lagi ya, nanti aku balas.'
  );
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

  const { text, status, raw } = await send(apiKey, body, 45000, MODERATION_MODEL);
  if (status !== 200 || !text) throw new Error(raw || 'Moderation LLM tidak merespons');
  const parsed = JSON.parse(normalizeJson(text));
  return {
    violation: Boolean(parsed.violation),
    reason: String(parsed.reason || ''),
    redeem: Boolean(parsed.redeem),
  };
}

module.exports = {
  init,
  addKey,
  removeKey,
  getKeyList,
  askText,
  askTextAsTsukasa,
  askVision,
  transcribe,
  askAsPersona,
  moderate,
  moderationReady,
};
