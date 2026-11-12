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
    const sizes = ['3 cm bengkok kiri', '18 cm tebal berotot', '12 cm lurus standar', '15 cm berurat pink', '5 cm tenggelam di bulu', '20 cm super monster']
    const res = sizes[Math.floor(Math.random() * sizes.length)]
    await m.reply(`╭─── ୨୧ CEK KONTOL ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა cek kocak!\n╰────────────────────────╯\n\n୨ৎ Target: ${target.name}\n୨ৎ Ukuran: *${res}*`, null, { mentions: target.mentions })
  }
  handler.help = ['cekkontol [@tag/nama]']
  handler.tags = ['cek']
  handler.command = ['cekkontol']
  return handler
}

rbRegister("cek/cekkontol", feature)

let handler = (m, ctx) => rbRun("cek/cekkontol", m, ctx)

handler.command = ['cekkontol']
handler.help = ["cekkontol [@tag/nama]"]
handler.tags = ['cek']

export default handler
