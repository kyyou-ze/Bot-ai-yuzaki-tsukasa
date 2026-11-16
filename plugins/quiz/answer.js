/**
 * answer.js — plugin pasif untuk jawaban kuis ALYA.
 *
 * Hanya memproses pesan biasa saat ada kuis berjalan di chat tersebut.
 * Kalau tidak ada kuis, plugin mengembalikan false supaya pesan tetap
 * diteruskan ke penangan lain (game tebak, AI, dll).
 */

import { handleQuizAnswer } from './_engine.js';

const handler = (m, ctx) => handleQuizAnswer(m, ctx);

handler.tags = ['quiz'];
handler.customPrefix = /^[\s\S]+$/;

export default handler;
