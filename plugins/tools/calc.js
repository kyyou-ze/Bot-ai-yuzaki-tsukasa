import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) {
      return m.reply(
        `🧮 *KALKULATOR PINTAR ${global.namebot}*\n\n` +
        `Contoh penggunaan:\n` +
        `• *.calc 50 * 20*\n` +
        `• *.calc 1000 / 4 + 150*\n` +
        `• *.kalkulator (25 + 75) * 5*`
      )
    }

    const clean = text.replace(/[^0-9+\-*/().\s]/g, '')
    if (!clean.trim()) return m.reply('❌ Format perhitungan matematika tidak valid!')

    try {
      const result = Function(`'use strict'; return (${clean})`)()
      await m.reply(
        `╭─── ୨୧ KALKULATOR ୨୧ ───╮\n` +
        `│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა hasil hitung!\n` +
        `╰─────────────────────────╯\n\n` +
        `୨ৎ Soal  : *${clean.trim()}*\n` +
        `୨ৎ Hasil : *${result.toLocaleString('id-ID')}*`
      )
    } catch {
      await m.reply('❌ Gagal menghitung ekspresi matematika tersebut!')
    }
  }

  handler.help = ['calc <ekspresi>', 'kalkulator <ekspresi>']
  handler.tags = ['tools']
  handler.command = ['calc']
  return handler
}

rbRegister("tools/calc", feature)

let handler = (m, ctx) => rbRun("tools/calc", m, ctx)

handler.command = ['calc']
handler.help = ["calc <ekspresi>", "kalkulator <ekspresi>"]
handler.tags = ['tools']

export default handler
