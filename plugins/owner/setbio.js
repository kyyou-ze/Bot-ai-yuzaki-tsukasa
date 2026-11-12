import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  let handler = async (m, { sock, conn, text, usedPrefix, command }) => {
    const client = conn || sock
    const input = (text || '').trim()

    if (!input) {
      return m.reply(`Harap masukkan teks bio baru!\nContoh:\n${usedPrefix}${command} Bot WhatsApp Multi-Device`)
    }

    try {
      await client.updateProfileStatus(input)
      return m.reply(`✓ Sukses mengubah Bio / Status Bot menjadi:\n"${input}"`)
    } catch (e) {
      return m.reply(`Gagal mengubah Bio Bot:\n${e.message || e}`)
    }
  }

  handler.command = ['setbio']
  handler.owner = true
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("owner/setbio", feature)

let handler = (m, ctx) => rbRun("owner/setbio", m, ctx)

handler.command = ['setbio']
handler.tags = ['owner']
handler.owner = true

export default handler
