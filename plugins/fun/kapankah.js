import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    if (!text) return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Tanya kapankah apa manis? Contoh: *.kapankah aku kaya?*')
    const num = Math.floor(Math.random() * 50) + 1
    const units = ['detik lagi', 'menit lagi', 'jam lagi', 'hari lagi', 'minggu lagi', 'bulan lagi', 'tahun lagi', 'abad lagi']
    const unit = units[Math.floor(Math.random() * units.length)]
    await m.reply(`╭─── ୨୧ KAPANKAH ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა tanya ${global.namebot}!\n╰─────────────────────╯\n\n୨ৎ Pertanyaan: ${text}\n୨ৎ Jawaban: *${num} ${unit}*`)
  }
  handler.help = ['kapankah <pertanyaan>']
  handler.tags = ['fun']
  handler.command = ['kapankah']
  return handler
}

rbRegister("fun/kapankah", feature)

let handler = (m, ctx) => rbRun("fun/kapankah", m, ctx)

handler.command = ['kapankah']
handler.help = ["kapankah <pertanyaan>"]
handler.tags = ['fun']

export default handler
