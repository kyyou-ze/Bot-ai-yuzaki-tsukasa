/**
 * ai.js — command `.ai` gaya ALYA MD.
 *
 * Meneruskan pertanyaan ke LLM yang sama dengan persona Tsukasa. Command ini
 * berguna saat pengguna ingin bertanya langsung tanpa menunggu trigger chat AI.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const llm = require('../../src/llm.js');

const handler = async (m, { text, prefix, reply }) => {
  const question = String(text || '').trim();
  if (!question) {
    return reply(
      `🤖 *AI TSUKASA*\n\n` +
        `Contoh:\n` +
        `› ${prefix}ai jelaskan cara kerja panel\n` +
        `› ${prefix}ai buatkan caption singkat\n\n` +
        `_Balas pesan atau tulis pertanyaan langsung setelah command._`
    );
  }

  await m.react?.('🕕').catch?.(() => {});
  const answer = await llm.askTextAsTsukasa(question).catch(() => '');
  await m.react?.('✅').catch?.(() => {});

  if (!answer) {
    return reply('❌ AI sedang tidak bisa menjawab. Coba lagi beberapa saat lagi.');
  }
  return reply(answer);
};

handler.command = ['ai'];
handler.help = ['ai <pertanyaan>'];
handler.tags = ['main'];
handler.description = 'Tanya AI Tsukasa langsung lewat command';
handler.limit = true;

export default handler;
