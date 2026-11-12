import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text, participants }) => {
    if (!text) return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Tanya siapakah apa? Contoh: *.siapakah yang paling imut?*')
    let member = participants ? participants.map(u => u.id) : []
    let picked = member.length > 0 ? member[Math.floor(Math.random() * member.length)] : m.sender
    const num = picked.replace(/[^0-9]/g, '')
    await m.reply(`╭─── ୨୧ SIAPAKAH ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა tebak siapa!\n╰─────────────────────╯\n\n୨ৎ Pertanyaan: ${text}\n୨ৎ Yang paling cocok: *@${num}* ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა♡`, null, { mentions: [picked] })
  }
  handler.help = ['siapakah <pertanyaan>']
  handler.tags = ['fun']
  handler.command = ['siapakah']
  return handler
}

rbRegister("fun/siapakah", feature)

let handler = (m, ctx) => rbRun("fun/siapakah", m, ctx)

handler.command = ['siapakah']
handler.help = ["siapakah <pertanyaan>"]
handler.tags = ['fun']

export default handler
