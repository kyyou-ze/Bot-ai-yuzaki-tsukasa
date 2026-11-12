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
    const types = ['Tembem bersih pink ♡', 'Hitam legam berurat', 'Mulus wangi stroberi', 'Jembot lebat berhutan', 'Segar kencang premium', 'Kering keriput']
    const res = types[Math.floor(Math.random() * types.length)]
    await m.reply(`╭─── ୨୧ CEK MEMEK ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა cek kocak!\n╰───────────────────────╯\n\n୨ৎ Target: ${target.name}\n୨ৎ Tipe: *${res}*`, null, { mentions: target.mentions })
  }
  handler.help = ['cekmemek [@tag/nama]']
  handler.tags = ['cek']
  handler.command = ['cekmemek']
  return handler
}

rbRegister("cek/cekmemek", feature)

let handler = (m, ctx) => rbRun("cek/cekmemek", m, ctx)

handler.command = ['cekmemek']
handler.help = ["cekmemek [@tag/nama]"]
handler.tags = ['cek']

export default handler
