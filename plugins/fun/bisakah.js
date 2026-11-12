import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Tanya apa yang bisa? Contoh: *.bisakah aku jadian sama dia?*')
    const answers = ['Bisa banget dong! (˶ᵔ ᵕ ᵔ˶)', 'Kayaknya bisa dicoba ♡', 'Peluangnya 50:50 nih~', 'Agak mustahil sih ><', 'Jelas tidak bisa haha', 'Bisa asal usaha keras!']
    const res = answers[Math.floor(Math.random() * answers.length)]
    await m.reply(`╭─── ୨୧ BISAKAH ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა tanya ${global.namebot}!\n╰─────────────────────╯\n\n୨ৎ Pertanyaan: ${text}\n୨ৎ Jawaban: *${res}*`)
  }
  handler.help = ['bisakah <pertanyaan>']
  handler.tags = ['fun']
  handler.command = ['bisakah']
  return handler
}

rbRegister("fun/bisakah", feature)

let handler = (m, ctx) => rbRun("fun/bisakah", m, ctx)

handler.command = ['bisakah']
handler.help = ["bisakah <pertanyaan>"]
handler.tags = ['fun']

export default handler
