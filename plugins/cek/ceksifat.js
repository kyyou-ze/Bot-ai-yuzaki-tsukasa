import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  function getTarget(m, text) {
    if (m.mentionedJid && m.mentionedJid.length > 0) {
      const jid = m.mentionedJid[0]
      const num = jid.replace(/[^0-9]/g, '')
      return { name: `@${num}`, jid, mentions: [jid] }
    }
    if (m.quoted && m.quoted.sender) {
      const jid = m.quoted.sender
      const num = jid.replace(/[^0-9]/g, '')
      return { name: `@${num}`, jid, mentions: [jid] }
    }
    if (text && text.trim()) {
      return { name: text.trim(), jid: null, mentions: [] }
    }
    const selfNum = (m.sender || '').replace(/[^0-9]/g, '')
    return { name: `@${selfNum}`, jid: m.sender, mentions: [m.sender] }
  }

  const handler = async (m, { text }) => {
    const target = getTarget(m, text)
    const traits = ['Penyayang & Romantis ♡', 'Suka menolong tapi pelupa', 'Galak tapi hatinya Hello Kitty', 'Setia sampai maut memisahkan', 'Moody tapi menggemaskan (˶ᵔ ᵕ ᵔ˶)', 'Ambisius dan pekerja keras']
    const res = traits[Math.floor(Math.random() * traits.length)]
    await m.reply(`╭─── ୨୧ CEK SIFAT ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა karakter dominan!\n╰───────────────────────╯\n\n୨ৎ Target: ${target.name}\n୨ৎ Sifat: *${res}*`, null, { mentions: target.mentions })
  }
  handler.help = ['ceksifat [@tag/nama]']
  handler.tags = ['cek']
  handler.command = ['ceksifat']
  return handler
}

rbRegister("cek/ceksifat", feature)

let handler = (m, ctx) => rbRun("cek/ceksifat", m, ctx)

handler.command = ['ceksifat']
handler.help = ["ceksifat [@tag/nama]"]
handler.tags = ['cek']

export default handler
