import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text }) => {
    const choices = ['batu', 'gunting', 'kertas']
    if (!text || !choices.includes(text.toLowerCase().trim())) {
      return m.reply('૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Pilih pilihanmu manis: *batu*, *gunting*, atau *kertas*!\nContoh: *.suit batu*')
    }
    const userChoice = text.toLowerCase().trim()
    const botChoice = choices[Math.floor(Math.random() * choices.length)]
    let result = ''
    if (userChoice === botChoice) result = 'Seri! Kita sehati ♡'
    else if (
      (userChoice === 'batu' && botChoice === 'gunting') ||
      (userChoice === 'gunting' && botChoice === 'kertas') ||
      (userChoice === 'kertas' && botChoice === 'batu')
    ) result = 'Kamu Menang! Hebat banget (˶ᵔ ᵕ ᵔ˶)'
    else result = `${global.namebot} Menang! Jangan nangis yaa ><`

    await m.reply(`╭─── ୨୧ SUIT PVP ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა suit game!\n╰──────────────────────╯\n\n୨ৎ Pilihan Kamu : *${userChoice}*\n୨ৎ Pilihan ${global.namebot}: *${botChoice}*\n\n୨ৎ Hasil: *${result}*`)
  }
  handler.help = ['suit <batu/gunting/kertas>']
  handler.tags = ['fun']
  handler.command = ['suit']
  return handler
}

rbRegister("fun/suit", feature)

let handler = (m, ctx) => rbRun("fun/suit", m, ctx)

handler.command = ['suit']
handler.help = ["suit <batu/gunting/kertas>"]
handler.tags = ['fun']

export default handler
