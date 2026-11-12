import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) return m.reply('🐚 Puja kerang ajaib! Mau tanya apa manis? Contoh: *.kerangajaib bolehkah aku makan sekarang?*')
    const answers = ['Mungkin suatu hari nanti.', 'Tidak juga.', 'Tidak.', 'Iya.', 'Coba tanya lagi.', 'Makan saja.']
    const res = answers[Math.floor(Math.random() * answers.length)]
    await m.reply(`╭─── ୨୧ KERANG AJAIB ୨୧ ───╮\n│ 🐚 Puja Kerang Ajaib!\n╰──────────────────────────╯\n\n୨ৎ Pertanyaan: ${text}\n୨ৎ Jawaban: *${res}*`)
  }
  handler.help = ['kerangajaib <pertanyaan>']
  handler.tags = ['fun']
  handler.command = ['kerangajaib']
  return handler
}

rbRegister("fun/kerangajaib", feature)

let handler = (m, ctx) => rbRun("fun/kerangajaib", m, ctx)

handler.command = ['kerangajaib']
handler.help = ["kerangajaib <pertanyaan>"]
handler.tags = ['fun']

export default handler
