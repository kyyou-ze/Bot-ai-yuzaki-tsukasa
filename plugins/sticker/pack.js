// ───────── pack ─────────
// Dipecah dari plugins/sticker/pack.js (dulu digabung dengan fitur lain dalam satu file)

import axios from 'axios'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'
import sharp from 'sharp'
import FormData from 'form-data'

const _pack = (() => {
async function toWebp(buffer) {
  return await sharp(buffer)
    .webp({ quality: 80 })
    .toBuffer()
}

async function uploadUguu(buffer) {
  let form = new FormData()
  form.append('files[]', buffer, 'file.webp')

  let res = await axios.post('https://uguu.se/upload.php', form, {
    headers: form.getHeaders()
  })

  return res.data.files[0].url
}

let handler = async (m, { conn }) => {
  try {
    if (!m.quoted) return m.reply('Reply gambar / sticker')

    let mime = m.quoted.mimetype || ''
    if (!/image|webp/.test(mime)) {
      return m.reply('Harus reply gambar atau sticker')
    }

    let media = await m.quoted.download()
    let webp = await toWebp(media)
    let url = await uploadUguu(webp)

    if (typeof conn.sendStickerPack !== 'function') {
      throw new Error('Fitur sticker pack tidak tersedia pada socket bot')
    }

    await conn.sendStickerPack(
      m.chat,
      [webp],
      m,
      {
        name: global.namebot || 'Bot',
        publisher: `\n\n\n\n${global.ownername || 'Owner'}`,
        description: 'ytta acumalaka'
      }
    )
  } catch (e) {
    console.error(e)
    m.reply('Error bikin sticker pack')
  }
}

handler.help = ['pack']
handler.tags = ['sticker']
handler.command = ['pack']
const __plugin = wrapClassic(handler)

  return __plugin
})()

_pack.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
export default oneCommand(_pack, 'pack')
