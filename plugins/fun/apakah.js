import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Mau tanya apakah apa manis? Contoh: *.apakah aku ganteng?*')
    const answers = ['Iya banget! ♡', 'Kayaknya iya deh (˶ᵔ ᵕ ᵔ˶)', 'Bisa jadi iya bisa jadi ngga~', 'Mungkin ngga sih..', 'Pasti ngga dong! ><', 'Coba tanya lagi nanti yaa ♡']
    const res = answers[Math.floor(Math.random() * answers.length)]
    await m.reply(`╭─── ୨୧ APAKAH ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა tanya ${global.namebot}!\n╰─────────────────────╯\n\n୨ৎ Pertanyaan: ${text}\n୨ৎ Jawaban: *${res}*`)
  }
  handler.help = ['apakah <pertanyaan>']
  handler.tags = ['fun']
  handler.command = ['apakah']
  return handler
}

rbRegister("fun/apakah", feature)

let handler = (m, ctx) => rbRun("fun/apakah", m, ctx)

handler.command = ['apakah']
handler.help = ["apakah <pertanyaan>"]
handler.tags = ['fun']

export default handler
