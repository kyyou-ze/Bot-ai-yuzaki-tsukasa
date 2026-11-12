import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const quotes = [
    'Kegagalan hari ini adalah pondasi kemenangan besar esok hari. Semangat terus!',
    'Jangan bandingkan prosesmu dengan orang lain, bunga mekar di musimnya masing-masing.',
    'Bahagia itu sederhana: bersyukur atas hal kecil yang kita punya hari ini. ♡',
    'Lelah itu wajar, istirahatlah sejenak tapi jangan pernah menyerah. (˶ᵔ ᵕ ᵔ˶)'
  ]
  const handler = async (m) => {
    const q = quotes[Math.floor(Math.random() * quotes.length)]
    await m.reply(`╭─── ୨୧ KATA BIJAK ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა motivasi hari ini!\n╰─────────────────────────╯\n\n${q}`)
  }
  handler.help = ['katabijak']
  handler.tags = ['fun']
  handler.command = ['katabijak']
  return handler
}

rbRegister("fun/katabijak", feature)

let handler = (m, ctx) => rbRun("fun/katabijak", m, ctx)

handler.command = ['katabijak']
handler.help = ["katabijak"]
handler.tags = ['fun']

export default handler
