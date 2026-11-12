// ───────── toimg ─────────
// Dipecah dari plugins/sticker/sticker.js (dulu digabung dengan fitur lain dalam satu file)

import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'
import sharp from 'sharp'

const _toimg = (() => {
let handler = async (m, { conn, usedPrefix, command }) => {
  if (!m.quoted) {
    return m.reply(`Reply sticker dengan command *${usedPrefix + command}*`)
  }

  let q = m.quoted
  let mime = q.mimetype || ''

  if (!/image\/webp/.test(mime)) {
    return m.reply('Itu bukan sticker')
  }

  try {
    let media = await q.download()

    let img = await sharp(media)
      .png({ quality: 100 })
      .toBuffer()

    await conn.sendFile(
      m.chat,
      img,
      'image.png',
      null,
      m
    )
  } catch (e) {
    console.error(e)
    m.reply('Gagal convert sticker ke image')
  }
}

handler.help = ['toimg']
handler.tags = ['sticker']
handler.command = ['toimg']
handler.register = true
handler.limit = true

const __plugin = wrapClassic(handler)

  return __plugin
})()

_toimg.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
export default oneCommand(_toimg, 'toimg')
