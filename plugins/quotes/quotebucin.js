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
const THUMB_URL = global.thumb?.utama || 'https://cdn.zass.in/tlQJc8Qp8I.jpg'

let handler = async (m, { conn, sock }) => {
  const client = conn || sock
  await m.react?.('✨').catch(() => {})

  let url = `${global.APIs?.faa || 'https://api-faa.my.id'}/faa/quote-bucin`
  let res = await fetch(url)
  let json = await res.json()

  if (!json?.status || !json?.quote) return

  const thumb = await getThumbUrl(THUMB_URL)
  const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
  const invisible = '\u200B'.repeat(400)
  const caption = `乂  *Q U O T E S  B U C I N*\n\n"${json.quote.trim()}"`

  await client.sendMessage(
    m.chat,
    {
      text: `${URL}${invisible}\n\n${caption}`,
      linkPreview: {
        'matched-text': URL,
        matchedText: URL,
        canonicalUrl: URL,
        title: '「 𝐐𝐔𝐎𝐓𝐄 𝐁𝐔𝐂𝐈𝐍 」',
        description: 'Untaian Kata Manis & Romantis',
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

handler.help = ['quotebucin']
handler.tags = ['quotes']
handler.command = ['quotebucin']
handler.limit = true
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