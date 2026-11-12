import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const sharp = (__m => __m.default ?? __m)((await import('sharp')))

  async function generateProfilePictureFull(mediaBuffer) {
    const meta = await sharp(mediaBuffer).metadata()
    const max = Math.max(meta.width || 720, meta.height || 720)
    const min = Math.min(meta.width || 720, meta.height || 720)

    const img = await sharp(mediaBuffer)
      .resize(max, max, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .jpeg({ quality: 90 })
      .toBuffer()

    const preview = await sharp(mediaBuffer)
      .resize(min, min, {
        fit: 'cover'
      })
      .jpeg({ quality: 75 })
      .toBuffer()

    return { img, preview }
  }

  let handler = async (m, { sock, conn, usedPrefix, command }) => {
    const client = conn || sock
    const quoted = m.quoted || m
    const mime = quoted.mimetype || m.mimetype || ''
    const isImage = /image/i.test(mime)

    if (!isImage) {
      return m.reply(`Kirim atau balas (reply) foto dengan command:\n${usedPrefix}${command}`)
    }

    let buffer
    try {
      buffer = typeof quoted.download === 'function' ? await quoted.download() : await m.download()
    } catch (e) {
      return m.reply(`Gagal mengunduh gambar: ${e.message || e}`)
    }

    if (!buffer || !Buffer.isBuffer(buffer)) {
      return m.reply('Buffer gambar tidak valid.')
    }

    try {
      const { img, preview } = await generateProfilePictureFull(buffer)
      const botJid = client.user?.id || client.authState?.creds?.me?.id

      await client.query({
        tag: 'iq',
        attrs: {
          to: '@s.whatsapp.net',
          type: 'set',
          xmlns: 'w:profile:picture'
        },
        content: [
          {
            tag: 'picture',
            attrs: { type: 'image' },
            content: img
          }
        ]
      })

      return m.reply('✓ Sukses memperbarui Foto Profil Bot (Full Size / Panjang)!')
    } catch (e) {
      try {
        await client.updateProfilePicture(client.user?.id, buffer)
        return m.reply('✓ Sukses memperbarui Foto Profil Bot!')
      } catch (err) {
        return m.reply(`Gagal memperbarui Foto Profil Bot:\n${err.message || err}`)
      }
    }
  }

  handler.command = ['setpp']
  handler.owner = true
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("owner/setpp", feature)

let handler = (m, ctx) => rbRun("owner/setpp", m, ctx)

handler.command = ['setpp']
handler.tags = ['owner']
handler.owner = true

export default handler
