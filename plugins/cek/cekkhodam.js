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
    const khodams = ['Kucing Oren Berpeci', 'Naga Salju Sakti', 'Kuntilanak Merah Lembut', 'Harimau Putih Berjas', 'Tuyul Pembalap', 'Pocong Lincah', 'Kera Sakti Gunung']
    const res = khodams[Math.floor(Math.random() * khodams.length)]
    await m.reply(`╭─── ୨୧ CEK KHODAM ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა pendamping gaib!\n╰────────────────────────╯\n\n୨ৎ Target: ${target.name}\n୨ৎ Khodam: *${res}* 👻`, null, { mentions: target.mentions })
  }
  handler.help = ['cekkhodam [@tag/nama]']
  handler.tags = ['cek']
  handler.command = ['cekkhodam']
  return handler
}

rbRegister("cek/cekkhodam", feature)

let handler = (m, ctx) => rbRun("cek/cekkhodam", m, ctx)

handler.command = ['cekkhodam']
handler.help = ["cekkhodam [@tag/nama]"]
handler.tags = ['cek']

export default handler
