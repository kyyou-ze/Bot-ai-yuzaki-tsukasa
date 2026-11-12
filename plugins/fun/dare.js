import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const dares = [
    'Kirim voice note bernyanyi lagu anak-anak ke grup ini selama 15 detik!',
    'Ganti foto profil WhatsApp kamu jadi foto kartun lucu selama 1 jam!',
    'Chat orang nomor 1 di kontakmu dengan tulisan "Aku kangen kamu" lalu kirim screenshotnya!',
    `Ketik kalimat "Aku cinta ${global.namebot}" di status WhatsApp kamu!`,
    'Telepon temanmu lalu pura-pura menangis minta tolong!'
  ]
  const handler = async (m) => {
    const d = dares[Math.floor(Math.random() * dares.length)]
    await m.reply(`╭─── ୨୧ DARE CHALLENGE ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა berani tantangan?\n╰────────────────────────────╯\n\n୨ৎ Tantangan: *${d}*`)
  }
  handler.help = ['dare']
  handler.tags = ['fun']
  handler.command = ['dare']
  return handler
}

rbRegister("fun/dare", feature)

let handler = (m, ctx) => rbRun("fun/dare", m, ctx)

handler.command = ['dare']
handler.help = ["dare"]
handler.tags = ['fun']

export default handler
