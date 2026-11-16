/**
 * quiz.js — kuis gaya ALYA MD.
 *
 * Soal diambil dari `assets/quiz/*.json`. Jawaban diketik tanpa prefix dan
 * ditangani oleh plugin pasif `plugins/quiz/answer.js`.
 */

import { QUIZZES, QUIZ_ALIASES, startQuiz } from './_engine.js';

const COMMANDS = [
  'brainout',
  'caklontong',
  'heroff',
  'heroml',
  'jkt48',
  'drakor',
  'riddle',
  'whatanimal',
  'whatchemistry',
  'whatcountry',
  'whatfilm',
  'whatflag',
  'whatfood',
  'whatlyric',
  'whatpicture',
  'whatprofession',
  'whatword',
  'whoami',
  // alias singkat ala ALYA
  'tebakff',
  'tebakml',
  'tekateki',
];

const handler = async (m, ctx) => startQuiz(ctx.command, m, ctx);

handler.help = COMMANDS.slice();
handler.tags = ['quiz'];
handler.description = 'Kuis tebak-tebakan: brainout, riddle, whoami, what animal, dll.';
handler.limit = true;

handler.command = [
  'brainout',
  'caklontong',
  'heroff',
  'heroml',
  'jkt48',
  'drakor',
  'riddle',
  'whatanimal',
  'whatchemistry',
  'whatcountry',
  'whatfilm',
  'whatflag',
  'whatfood',
  'whatlyric',
  'whatpicture',
  'whatprofession',
  'whatword',
  'whoami',
  'tebakff',
  'tebakml',
  'tekateki',
];

// Pastikan daftar di atas sinkron dengan mesin kuis (deteksi kesalahan saat load).
for (const name of COMMANDS) {
  if (!QUIZZES[name] && !QUIZ_ALIASES[name]) {
    throw new Error(`[quiz] command "${name}" tidak punya data kuis`);
  }
}

export default handler;
