/**
 * _engine.js — mesin kuis ALYA MD (brainout, riddle, whoami, what*, dll).
 *
 * Soal dibaca dari `assets/quiz/*.json` (aset ALYA MD). Setiap chat hanya boleh
 * punya satu kuis berjalan. Jawaban diperiksa oleh plugin pasif `answer.js`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUIZ_DIR = path.resolve(HERE, '..', '..', 'assets', 'quiz');
const TIMEOUT_MS = 90_000;
const MIN_REWARD = 1500;
const MAX_REWARD = 3000;

/**
 * command -> pengaturan kuis.
 * `question` dipakai kalau soalnya tidak ada di JSON (kuis bergambar).
 */
export const QUIZZES = {
  brainout: {
    file: 'brainout.json', title: 'BRAINOUT', emoji: '🧠',
    questionField: 'pertanyaan', answerField: 'jawaban',
  },
  caklontong: {
    file: 'caklontong.json', title: 'CAKLONTONG', emoji: '🤪',
    questionField: 'pertanyaan', answerField: 'jawaban',
  },
  heroff: {
    file: 'heroff.json', title: 'HERO FF', emoji: '👤', media: 'img',
    question: 'Hero Free Fire mana ini?', answerField: 'jawaban',
  },
  heroml: {
    file: 'heroml.json', title: 'HERO ML', emoji: '👤', media: 'image',
    question: 'Hero Mobile Legends mana ini?', answerField: 'name',
  },
  jkt48: {
    file: 'jkt48.json', title: 'JKT-48', emoji: '🙆🏻‍♀️', media: 'img',
    question: 'Siapa dia?', answerField: 'jawaban',
  },
  drakor: {
    file: 'koreandrama.json', title: 'KOREAN DRAMA', emoji: '💕', media: 'img',
    questionField: 'deskripsi', answerField: 'jawaban',
  },
  riddle: {
    file: 'riddle.json', title: 'RIDDLE', emoji: '🔎',
    questionField: 'pertanyaan', answerField: 'jawaban',
  },
  whatanimal: {
    file: 'whatanimal.json', title: 'WHAT ANIMAL', emoji: '🐱',
    questionField: 'soal', answerField: 'jawaban',
  },
  whatchemistry: {
    file: 'whatchemistry.json', title: 'WHAT CHEMISTRY', emoji: '🧪',
    questionField: 'lambang', answerField: 'unsur',
  },
  whatcountry: {
    file: 'whatcountry.json', title: 'WHAT COUNTRY', emoji: '🗺️',
    questionField: 'soal', answerField: 'jawaban',
  },
  whatfilm: {
    file: 'whatfilm.json', title: 'WHAT FILM', emoji: '🎥',
    questionField: 'soal', answerField: 'jawaban',
  },
  whatflag: {
    file: 'whatflag.json', title: 'WHAT FLAG', emoji: '🇮🇩', media: 'img',
    question: 'Bendera negara mana ini?', answerField: 'name',
  },
  whatfood: {
    file: 'whatfood.json', title: 'WHAT FOOD', emoji: '🍽️', media: 'img',
    questionField: 'deskripsi', answerField: 'jawaban',
  },
  whatlyric: {
    file: 'whatlyric.json', title: 'WHAT LYRIC', emoji: '🎼',
    questionField: 'soal', answerField: 'jawaban',
  },
  whatpicture: {
    file: 'whatpicture.json', title: 'WHAT PICTURE', emoji: '🖼️', media: 'img',
    questionField: 'deskripsi', answerField: 'jawaban',
  },
  whatprofession: {
    file: 'whatprofession.json', title: 'WHAT PROFESSION', emoji: '👩🏻‍🚒',
    questionField: 'soal', answerField: 'jawaban',
  },
  whatword: {
    file: 'whatword.json', title: 'WHAT WORD', emoji: '💬',
    questionField: 'acak', answerField: 'jawaban',
  },
  whoami: {
    file: 'whoami.json', title: 'WHO AM I', emoji: '❔',
    questionField: 'pertanyaan', answerField: 'jawaban',
  },
};

// Singkatan nama command ALYA yang tidak ditampilkan di menu.
export const QUIZ_ALIASES = {
  tebakff: 'heroff',
  tebakml: 'heroml',
  tekateki: 'riddle',
  drakor: 'drakor',
};

const sessions = new Map();
const cache = new Map();

function loadQuiz(name) {
  const key = QUIZ_ALIASES[name] || name;
  const quiz = QUIZZES[key];
  if (!quiz) return null;
  if (!cache.has(key)) {
    const rows = JSON.parse(fs.readFileSync(path.join(QUIZ_DIR, quiz.file), 'utf8'));
    cache.set(key, Array.isArray(rows) ? rows : []);
  }
  return { key, quiz, rows: cache.get(key) };
}

function clean(value) {
  return String(value ?? '').trim();
}

function pickRow(rows, quiz) {
  const valid = rows.filter((row) => row && clean(row[quiz.answerField] ?? '') !== '');
  return valid.length ? valid[Math.floor(Math.random() * valid.length)] : null;
}

function entryAnswer(quiz, row) {
  return clean(row[quiz.answerField]);
}

function entryQuestion(quiz, row) {
  return clean(quiz.question || row[quiz.questionField] || '');
}

function entryMedia(quiz, row) {
  if (!quiz.media) return '';
  const raw = row[quiz.media];
  if (Array.isArray(raw)) return clean(raw[0]);
  return clean(raw);
}

export function normalizeAnswer(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function closeEnough(input, answer) {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(answer);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  // Jarak edit sederhana: toleransi 1 salah ketik untuk jawaban panjang.
  if (b.length < 5) return false;
  let diff = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) diff += 1;
    if (diff > 1) return false;
  }
  return diff <= 1;
}

function maskAnswer(answer, hints) {
  const chars = [...String(answer)];
  const letters = chars.filter((ch) => /[a-z0-9]/i.test(ch)).length;
  const reveal = Math.max(1, Math.min(Math.ceil((letters * 0.3) * hints), letters - 1));
  let shown = 0;
  return chars
    .map((ch) => {
      if (!/[a-z0-9]/i.test(ch)) return ch;
      const out = shown < reveal ? ch : '_';
      shown += 1;
      return out;
    })
    .join(' ');
}

function clearSession(chat) {
  const session = sessions.get(chat);
  if (session?.timer) clearTimeout(session.timer);
  sessions.delete(chat);
}

async function sendQuestion(ctx, quiz, row) {
  const { sock, chat } = ctx;
  const question = entryQuestion(quiz, row);
  const media = entryMedia(quiz, row);
  const p = ctx.prefix || '.';
  const caption = [
    `${quiz.emoji} *${quiz.title}*`,
    '',
    question,
    '',
    '⏱️ Waktu: 90 detik',
    `💡 Ketik *hint* untuk bantuan • *nyerah* untuk menyerah`,
    `_Bisa juga ${p}hint / ${p}nyerah_`,
  ].join('\n');

  if (media) {
    try {
      await sock.sendMessage(chat, { image: { url: media }, caption }, { quoted: ctx.m });
      return;
    } catch {
      // URL gambar mati → tetap kirim soalnya sebagai teks.
    }
  }
  await sock.sendMessage(chat, { text: caption }, { quoted: ctx.m });
}

export async function startQuiz(name, m, ctx) {
  const loaded = loadQuiz(name);
  if (!loaded) {
    await ctx.reply(`Kuis *${name}* tidak dikenal.`);
    return true;
  }
  const { key, quiz, rows } = loaded;
  const chat = ctx.chat || ctx.jid || m.chat;
  if (sessions.has(chat)) {
    const active = sessions.get(chat);
    await ctx.reply(
      `Masih ada kuis *${active.quiz.title}* yang belum selesai.\n` +
        `Jawab dulu, atau ketik *nyerah* untuk menyerah.`
    );
    return true;
  }

  const row = pickRow(rows, quiz);
  if (!row) {
    await ctx.reply(`❌ Soal ${quiz.title} sedang kosong.`);
    return true;
  }

  await m.react?.(quiz.emoji).catch?.(() => {});
  await sendQuestion({ ...ctx, sock: ctx.sock, chat, m }, quiz, row);

  const session = {
    quiz,
    row,
    answer: entryAnswer(quiz, row),
    hints: 0,
    chat,
    startedAt: Date.now(),
  };
  session.timer = setTimeout(async () => {
    if (sessions.get(chat) !== session) return;
    clearSession(chat);
    try {
      await ctx.sock.sendMessage(
        chat,
        { text: `⌛ *Waktu habis!*\nJawabannya: *${session.answer}*` },
        { quoted: m }
      );
    } catch {
      /* ignore */
    }
  }, TIMEOUT_MS);
  session.timer.unref?.();
  sessions.set(chat, session);
  return true;
}

export function quizHint(m, ctx) {
  const chat = ctx.chat || ctx.jid || m.chat;
  const session = sessions.get(chat);
  if (!session) return false;
  session.hints = Math.min(session.hints + 1, 3);
  ctx.reply(
    `💡 *Hint ${session.hints}/3*\n${maskAnswer(session.answer, session.hints)}\n` +
      `_(${[...session.answer].filter((c) => /[a-z0-9]/i.test(c)).length} huruf)_`
  );
  return true;
}

export function quizSkip(m, ctx) {
  const chat = ctx.chat || ctx.jid || m.chat;
  const session = sessions.get(chat);
  if (!session) return false;
  clearSession(chat);
  ctx.reply(`🏳️ Menyerah ya?\nJawabannya: *${session.answer}*`);
  return true;
}

export async function handleQuizAnswer(m, ctx) {
  const chat = ctx.chat || ctx.jid || m.chat;
  const session = sessions.get(chat);
  if (!session) return false;

  const body = String(ctx.text ?? m.text ?? '').trim();
  if (!body) return false;

  const lower = body.toLowerCase();
  if (['hint', 'clue', 'petunjuk', 'bantuan'].includes(lower)) {
    quizHint(m, ctx);
    return true;
  }
  if (['nyerah', 'skip', 'lewati', 'menyerah', 'give up'].includes(lower)) {
    quizSkip(m, ctx);
    return true;
  }

  if (!closeEnough(body, session.answer)) return false;

  clearSession(chat);
  const reward = MIN_REWARD + Math.floor(Math.random() * (MAX_REWARD - MIN_REWARD + 1));
  const { sock } = ctx;
  try {
    await m.react?.('✅');
  } catch {
    /* ignore */
  }
  await sock.sendMessage(
    chat,
    {
      text:
        `✅ *BENAR!*\n\n${session.quiz.emoji} ${session.quiz.title}\n` +
        `Jawaban: *${session.answer}*\n💰 Hadiah: Rp${reward.toLocaleString('id-ID')}`,
      mentions: [m.sender],
    },
    { quoted: m }
  );
  try {
    // Hadiah memakai ekonomi grup bila modulnya tersedia. Kegagalan hadiah
    // tidak boleh membatalkan jawaban yang sudah benar.
    const { addMoney } = await import('../../lib/group/sosial.js');
    await addMoney(sock, m.sender, m.pushName, reward).catch?.(() => {});
  } catch {
    /* hadiah opsional */
  }
  return true;
}

export function hasQuizSession(chat) {
  return sessions.has(chat);
}
