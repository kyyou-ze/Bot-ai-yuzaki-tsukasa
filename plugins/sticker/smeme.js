/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */
import axios from 'axios'
import FormData from 'form-data'
import { config, uploadToCatboxFile, sendImageAsSticker } from '../../lib/engine/plugins.js'
import { pickImage, uploadFile, reactTo } from '../../lib/core/file.js'

// unggah ke beberapa hosting bergantian, lalu pastikan URL-nya benar-benar mengembalikan gambar
// (memegen.link membalas 415 kalau background bukan file gambar langsung)
async function uploadUguu(buffer, ext) {
  const form = new FormData()
  form.append('files[]', buffer, { filename: `meme.${ext}` })
  const res = await axios.post('https://uguu.se/upload.php', form, { headers: form.getHeaders(), timeout: 30000 })
  return res.data?.files?.[0]?.url
}

async function isDirectImage(url) {
  try {
    const r = await axios.get(url, { responseType: 'stream', timeout: 15000, validateStatus: () => true })
    r.data.destroy()
    return r.status === 200 && /^image\//i.test(String(r.headers['content-type'] || ''))
  } catch {
    return false
  }
}

async function uploadForMeme(buffer, mime) {
  const ext = /png/.test(mime) ? 'png' : 'jpg'
  const hosts = [
    () => uploadToCatboxFile(buffer, `meme.${ext}`),
    () => uploadUguu(buffer, ext),
    () => uploadFile(buffer)
  ]
  for (const up of hosts) {
    try {
      const url = await up()
      if (url && await isDirectImage(url)) return url
    } catch {}
  }
  return null
}

// .smeme teks atas|teks bawah   (kirim / reply foto)
// cek register & limit sudah ditangani handler (handler.limit = true)

// format teks sesuai aturan memegen.link
const formatMemegenText = (str) => {
  if (!str || !str.trim()) return '_'
  return str.trim()
    .replace(/_/g, '__')
    .replace(/-/g, '--')
    .replace(/ /g, '_')
    .replace(/\?/g, '~q')
    .replace(/%/g, '~p')
    .replace(/#/g, '~h')
    .replace(/\//g, '~s')
    .replace(/\\/g, '~b')
    .replace(/"/g, "''")
    .replace(/&/g, '~a')
}

let handler = async (m, { sock, text, reply, prefix, usedPrefix, command }) => {
  const p = usedPrefix ?? prefix ?? '.'
  const image = pickImage(m)

  if (!image) {
    return reply(`Kirim/Balas gambar dengan teks:\n${p}${command || 'smeme'} teks atas|teks bawah\n\n❌ Hanya bisa digunakan untuk Gambar (Bukan Stiker)!`)
  }

  const [atas, bawah] = text ? String(text).split('|') : ['', '']

  await reactTo(sock, m, '⏳')
  await reply(global.mess?.wait || 'Tunggu sebentar ya...')

  try {
    const mediaBuffer = await image.download()
    if (!mediaBuffer?.length) throw new Error('Gagal mengunduh gambar, coba kirim ulang.')

    const imageUrl = await uploadForMeme(mediaBuffer, image.mime || '')
    if (!imageUrl) throw new Error('Gagal mengunggah gambar ke hosting (semua server gagal), coba lagi nanti.')

    const encodedAtas = encodeURIComponent(formatMemegenText(atas))
    const encodedBawah = encodeURIComponent(formatMemegenText(bawah))
    const apiUrl = `https://api.memegen.link/images/custom/${encodedAtas}/${encodedBawah}.png?background=${encodeURIComponent(imageUrl)}`

    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })

    const resultBuffer = Buffer.from(response.data)

    await sendImageAsSticker(sock, m.chat, resultBuffer, m, {
      packname: config.sticker.packname,
      author: config.sticker.author
    })

    await reactTo(sock, m, '✅')
  } catch (error) {
    console.error('[SMEME ERROR]', error?.message || error)
    await reactTo(sock, m, '❌')
    return reply(`❌ ${error?.message || global.mess?.error || 'Terjadi kesalahan.'}`)
  }
}

handler.command = ['smeme', 'stikermeme']
handler.help = ['smeme atas|bawah']
handler.tags = ['sticker']
handler.limit = true

export default handler
