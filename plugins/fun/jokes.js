import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const jokes = [
    'Kenapa superman bajunya ketat?\nKarena kalau longgar namanya super jumbo! 🦸‍♂️',
    'Ikan apa yang matanya banyak?\nIkan teri sekilo! 🐟',
    'Bebek apa yang jalannya muter ke kiri terus?\nBebek dikunci stang! 🦆',
    'Minyak apa yang bikin mabuk?\nMinyaksikan senyum manismu! (˶ᵔ ᵕ ᵔ˶)'
  ]
  const handler = async (m) => {
    const j = jokes[Math.floor(Math.random() * jokes.length)]
    await m.reply(`╭─── ୨୧ JOKES BAPAK-BAPAK ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა ketawa dulu yuk!\n╰──────────────────────────────╯\n\n${j}`)
  }
  handler.help = ['jokes']
  handler.tags = ['fun']
  handler.command = ['jokes']
  return handler
}

rbRegister("fun/jokes", feature)

let handler = (m, ctx) => rbRun("fun/jokes", m, ctx)

handler.command = ['jokes']
handler.help = ["jokes"]
handler.tags = ['fun']

export default handler
