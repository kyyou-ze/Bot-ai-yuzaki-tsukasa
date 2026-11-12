import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  let handler = async (m, { sock, conn, usedPrefix, command }) => {
    const client = conn || sock
    const quoted = m.quoted || m
    const mime = quoted.mimetype || m.mimetype || ''

    if (!mime || (!/image/i.test(mime) && !/video/i.test(mime) && !/audio/i.test(mime))) {
      return m.reply(`Kirim atau balas (reply) media dengan command:\n${usedPrefix}${command}`)
    }

    let buffer
    try {
      buffer = typeof quoted.download === 'function' ? await quoted.download() : await m.download()
    } catch (e) {
      return m.reply(`Gagal mengunduh media: ${e.message || e}`)
    }

    if (!buffer || !Buffer.isBuffer(buffer)) {
      return m.reply('Buffer media tidak valid.')
    }

    const caption = quoted.caption || quoted.text || m.text || ''

    try {
      if (/video/i.test(mime)) {
        return await client.sendMessage(
          m.chat,
          {
            video: buffer,
            caption: caption || undefined,
            mimetype: mime,
            viewOnce: true
          },
          { quoted: m.raw }
        )
      }

      if (/audio/i.test(mime)) {
        return await client.sendMessage(
          m.chat,
          {
            audio: buffer,
            mimetype: mime,
            viewOnce: true
          },
          { quoted: m.raw }
        )
      }

      return await client.sendMessage(
        m.chat,
        {
          image: buffer,
          caption: caption || undefined,
          mimetype: mime || 'image/jpeg',
          viewOnce: true
        },
        { quoted: m.raw }
      )
    } catch (e) {
      return m.reply(`Gagal mengirim media View Once: ${e.message || e}`)
    }
  }

  handler.command = ['svo']
  handler.owner = false
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("tools/svo", feature)

let handler = (m, ctx) => rbRun("tools/svo", m, ctx)

handler.command = ['svo']
handler.tags = ['tools']

export default handler
