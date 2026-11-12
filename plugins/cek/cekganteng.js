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
    const score = Math.floor(Math.random() * 101)
    await m.reply(`╭─── ୨୧ CEK GANTENG ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა kadar ganteng!\n╰─────────────────────────╯\n\n୨ৎ Target: ${target.name}\n୨ৎ Tingkat Kegantengan: *${score}%* 😎`, null, { mentions: target.mentions })
  }
  handler.help = ['cekganteng [@tag/nama]']
  handler.tags = ['cek']
  handler.command = ['cekganteng']
  return handler
}

rbRegister("cek/cekganteng", feature)

let handler = (m, ctx) => rbRun("cek/cekganteng", m, ctx)

handler.command = ['cekganteng']
handler.help = ["cekganteng [@tag/nama]"]
handler.tags = ['cek']

export default handler
