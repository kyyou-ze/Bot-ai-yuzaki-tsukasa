import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const gombals = [
    'Kamu punya peta nggak? Soalnya aku tersesat di dalam matamu yang indah itu. ♡',
    'Kamu itu mirip kopi deh, bikin melek dan candu terus setiap hari! (˶ᵔ ᵕ ᵔ˶)',
    'Rumah apa yang paling bikin bahagia? Rumah tangga kita berdua nanti!',
    'Jangan sering senyum dong, kasihan gula di dapur minder lihat manisnya kamu~'
  ]
  const handler = async (m) => {
    const g = gombals[Math.floor(Math.random() * gombals.length)]
    await m.reply(`╭─── ୨୧ GOMBALAN MANIS ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა buat kamu!\n╰────────────────────────────╯\n\n${g}`)
  }
  handler.help = ['gombalan']
  handler.tags = ['fun']
  handler.command = ['gombalan']
  return handler
}

rbRegister("fun/gombalan", feature)

let handler = (m, ctx) => rbRun("fun/gombalan", m, ctx)

handler.command = ['gombalan']
handler.help = ["gombalan"]
handler.tags = ['fun']

export default handler
