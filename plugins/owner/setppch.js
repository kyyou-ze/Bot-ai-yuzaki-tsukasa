import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  let handler = async (m, { sock, conn, text, usedPrefix, command }) => {
    const client = conn || sock
    const input = (text || '').trim()

    const quoted = m.quoted || m
    const mime = quoted.mimetype || m.mimetype || ''
    const isImage = /image/i.test(mime)

    if (!isImage) {
      return m.reply(`Kirim foto dengan caption atau balas (reply) foto dengan:\n${usedPrefix}${command} <link_saluran_atau_id_saluran>`)
    }

    if (!input) {
      return m.reply(`Harap masukkan link atau ID saluran!\nContoh:\n${usedPrefix}${command} https://whatsapp.com/channel/0029VbDO8tI2phHLTSN2ed0U\natau\n${usedPrefix}${command} 120363xxxxxxxx@newsletter`)
    }

    let channelJid = ''

    if (input.endsWith('@newsletter')) {
      channelJid = input
    } else {
      const match = input.match(/(?:whatsapp\.com\/channel\/)?([0-9A-Za-z]{20,28})/)
      if (!match || !match[1]) {
        return m.reply('Link atau ID saluran tidak valid.')
      }
      const inviteCode = match[1]
      try {
        const metadata = await client.newsletterMetadata('invite', inviteCode)
        channelJid = metadata?.id || ''
      } catch (e) {
        return m.reply(`Gagal mencari saluran dari link: ${e.message || e}`)
      }
    }

    if (!channelJid) {
      return m.reply('Gagal mendapatkan ID saluran.')
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
      await client.newsletterUpdatePicture(channelJid, buffer)
      return m.reply(`✓ Sukses memperbarui Foto Profil Saluran:\n\`${channelJid}\``)
    } catch (e) {
      return m.reply(`Gagal memperbarui Foto Profil Saluran:\n${e.message || e}\n\n_Pastikan akun bot adalah Admin/Pemilik dari saluran tersebut._`)
    }
  }

  handler.command = ['setppch']
  handler.owner = true
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("owner/setppch", feature)

let handler = (m, ctx) => rbRun("owner/setppch", m, ctx)

handler.command = ['setppch']
handler.tags = ['owner']
handler.owner = true

export default handler
