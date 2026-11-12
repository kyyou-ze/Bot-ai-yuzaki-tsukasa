import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Tanya bagaimanakah apa manis?')
    const answers = ['Jalani aja seperti air mengalir~', 'Mending tidur aja dulu ( ˘͈ ᵕ ˘͈ )', 'Gas terus jangan kasih kendor!', 'Coba bicarakan baik-baik yaa ♡', 'Sabar, semua ada waktunya']
    const res = answers[Math.floor(Math.random() * answers.length)]
    await m.reply(`╭─── ୨୧ BAGAIMANAKAH ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა tanya ${global.namebot}!\n╰─────────────────────────╯\n\n୨ৎ Pertanyaan: ${text}\n୨ৎ Saran: *${res}*`)
  }
  handler.help = ['bagaimanakah <pertanyaan>']
  handler.tags = ['fun']
  handler.command = ['bagaimanakah']
  return handler
}

rbRegister("fun/bagaimanakah", feature)

let handler = (m, ctx) => rbRun("fun/bagaimanakah", m, ctx)

handler.command = ['bagaimanakah']
handler.help = ["bagaimanakah <pertanyaan>"]
handler.tags = ['fun']

export default handler
