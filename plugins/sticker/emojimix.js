import axios from 'axios'
import { config } from '../../lib/engine/plugins.js'

// .emojimix 😀+😍   atau   .emojimix 😀 😍   (Emoji Kitchen dari Google)

const TENOR_KEY = process.env.TENOR_KEY || 'AIzaSyACvEq5cnT7AGKTWIIMyIB1HjcBLwnlH8k'

const findEmoji = (str) => {
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' })
  return [...seg.segment(String(str || ''))]
    .map(s => s.segment)
    .filter(g => /\p{Extended_Pictographic}/u.test(g))
}

const mix = async (a, b) => {
  const { data } = await axios.get('https://tenor.googleapis.com/v2/featured', {
    params: {
      key: TENOR_KEY,
      contentfilter: 'high',
      media_filter: 'png_transparent',
      component: 'proactive',
      collection: 'emoji_kitchen_v5',
      q: `${a}_${b}`
    },
    timeout: 15000
  })
  return data?.results?.[0]?.media_formats?.png_transparent?.url || null
}

let handler = async (m, { sock, text, reply, prefix, usedPrefix }) => {
  const p = usedPrefix ?? prefix ?? '.'
  const em = findEmoji(text)

  if (em.length < 2) {
    return reply(`😀 *EMOJI MIX*\n\nGabungkan dua emoji jadi stiker.\nContoh: ${p}emojimix 😀+😍`)
  }

  const [a, b] = em
  try {
    let url = await mix(a, b)
    if (!url) url = await mix(b, a)
    if (!url) return reply(`❌ Kombinasi ${a} + ${b} belum tersedia. Coba emoji lain.`)

    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 })
    await sock.sendImageAsSticker(m.chat, Buffer.from(res.data), m, {
      packname: config.sticker.packname,
      author: config.sticker.author
    })
  } catch (e) {
    console.error('[emojimix]', e?.message || e)
    return reply('❌ Gagal mengambil emoji mix. Server Google/Tenor mungkin sedang bermasalah, coba lagi nanti.')
  }
}

handler.command = ['emojimix', 'emix']
handler.help = ['emojimix 😀+😍']
handler.tags = ['sticker']
handler.limit = true

export default handler
