'use strict';

/**
 * Deteksi inisiatif percakapan "hot"/flirty dari owner.
 *
 * Regex ini HANYA dipakai untuk menentukan apakah mode dewasa perlu diaktifkan
 * di chat pribadi owner. Tidak dipakai untuk menghasilkan konten apa pun.
 * Konten tetap dibatasi oleh prompt di src/llm.js (sugestif, bukan eksplisit,
 * dan menolak keterlibatan anak di bawah umur).
 */
const HOT_CUE =
  /\b(hot|ecchi|etchi|seksi|sexy|spicy|nakal|mesum|vulgar|berahi|nafsu|goda|godain|menggoda|flirt|flirty|cium|ciuman|kiss|peluk|pelukan|ranjang|tidur\s*bareng|bobok|telanjang|bugil|tanpa\s*baju|bra|desah|erotis|sensual|foreplay|sex|seks|ngewe|entot|coli|masturbasi|orgasme|18\+|mode\s*dewasa|horny|mesra|bercumbu|cumbu|bikin\s*panas|turn\s*on|one\s*night)\b/i;

/** Pemicu untuk kembali ke obrolan normal. */
const STOP_CUE =
  /\b(stop|berhenti|matikan|nonaktifkan|mode\s*normal|biasa\s*aja|jangan\s*hot|jangan\s*ecchi|cukup\s*dulu)\b/i;

function isHotCue(text) {
  return HOT_CUE.test(String(text || ''));
}

function isStopCue(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  // "jangan berhenti" bukan perintah berhenti.
  if (/\b(jangan|jgn|don'?t)\s+(stop|berhenti|matikan|nonaktifkan)\b/i.test(s)) return false;
  return STOP_CUE.test(s);
}

module.exports = { isHotCue, isStopCue };
