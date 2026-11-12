import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Mau rate apa manis? Contoh: *.rate kecantikan aku*')
    const score = Math.floor(Math.random() * 101)
    await m.reply(`╭─── ୨୧ RATE ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა rating bot!\n╰───────────────────╯\n\n୨ৎ Target: ${text}\n୨ৎ Nilai: *${score} / 100%*`)
  }
  handler.help = ['rate <hal>']
  handler.tags = ['fun']
  handler.command = ['rate']
  return handler
}

rbRegister("fun/rate", feature)

let handler = (m, ctx) => rbRun("fun/rate", m, ctx)

handler.command = ['rate']
handler.help = ["rate <hal>"]
handler.tags = ['fun']

export default handler
