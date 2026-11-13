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
import sharp from 'sharp'
import { prepareWAMessageMedia } from '@whiskeysockets/baileys'

const URL = 'https://devcukurukuk.biz.id'
const THUMB_URL = global.thumb?.utama || 'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png'
const URL_SADBOY = 'https://raw.githubusercontent.com/zxrow/Asupan/refs/heads/main/gabut/sadboy1.json'

let cache = []
let lastFetch = 0
const TTL = 5 * 60 * 1000

async function getSadboy() {
  const now = Date.now()
  if (cache.length && now - lastFetch < TTL) return cache
  try {
    const res = await fetch(URL_SADBOY)
    const json = await res.json()
    if (!Array.isArray(json)) return []
    cache = json
    lastFetch = now
    return cache
  } catch {
    return []
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

let handler = async (m, { conn, sock }) => {
  const client = conn || sock
  const list = await getSadboy()
  if (!list.length) return m.reply('Quote sadboy lagi kosong 😔')
  const quote = pickRandom(list)

  const thumb = await getThumbUrl(THUMB_URL)
  const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
  const invisible = '\u200B'.repeat(400)
  const caption = `乂  *S A D B O Y  Q U O T E S*\n\n"${quote}"`

  await client.sendMessage(
    m.chat,
    {
      text: `${URL}${invisible}\n\n${caption}`,
      linkPreview: {
        'matched-text': URL,
        matchedText: URL,
        canonicalUrl: URL,
        title: '「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐒𝐀𝐃𝐁𝐎𝐘 」',
        description: 'Cerita Malam & Ruang Sunyi',
        previewType: 0,
        jpegThumbnail: thumb,
        highQualityThumbnail,
        thumbnailUrl: THUMB_URL,
        linkPreviewMetadata: {
          linkMediaDuration: 0,
          socialMediaPostType: 4
        }
      },
      favicon: {
        url: THUMB_URL
      }
    },
    { quoted: global.fmeta || m }
  )
}

handler.help = ['sadboy']
handler.tags = ['quotes']
handler.command = ['sadboy']
handler.limit = false
handler.register = true

export default handler

let cachedThumb = null
async function getThumbUrl(url) {
  if (cachedThumb) return cachedThumb
  try {
    const res = await fetch(url)
    const raw = Buffer.from(await res.arrayBuffer())

    cachedThumb = await sharp(raw)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer()
    return cachedThumb
  } catch {
    return Buffer.alloc(0)
  }
}

async function createHighQualityThumbnail(conn, thumb) {
  try {
    if (!thumb || !thumb.length) return null

    const { imageMessage } = await prepareWAMessageMedia(
      { image: thumb },
      {
        upload: conn.waUploadToServer,
        mediaTypeOverride: 'thumbnail-link'
      }
    )

    imageMessage.width = 1280
    imageMessage.height = 720

    return imageMessage
  } catch {
    return null
  }
}