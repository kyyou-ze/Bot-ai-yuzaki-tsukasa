import axios from 'axios'
import FormData from 'form-data'
import { config } from '../../lib/engine/plugins.js'
import { pickImage } from '../../lib/core/file.js'
import { uploadPone } from '../../lib/services/scraper.js'

// .removebg            -> hapus background, kirim 2 pesan: dokumen PNG transparan + foto langsung
// .removebg stiker     -> hasilnya dikirim sebagai stiker
//
// Urutan: (1) remove.bg resmi kalau ada key  (2) API cadangan di CANDIDATES (tebakan, edit sesuai API-mu)
// Key remove.bg: isi di config.js -> global.APIKeys.removebg = 'KEY'  atau env REMOVEBG_KEY

const CANDIDATES = [
  (u) => `https://apiii-xrina.vercel.app/ai-image/removebg?url=${encodeURIComponent(u)}`,
  (u) => `https://api.nexray.eu.cc/tools/removebg?url=${encodeURIComponent(u)}`
]

const isImg = (t) => /^image\//i.test(String(t || ''))

// cari link http pertama di dalam JSON balasan API
const findUrl = (v) => {
  if (typeof v === 'string') return /^https?:\/\//i.test(v) ? v : null
  if (Array.isArray(v)) { for (const x of v) { const r = findUrl(x); if (r) return r } return null }
  if (v && typeof v === 'object') { for (const x of Object.values(v)) { const r = findUrl(x); if (r) return r } }
  return null
}

async function viaOfficial(buffer, key) {
  const form = new FormData()
  form.append('image_file', buffer, { filename: 'image.jpg' })
  form.append('size', 'auto')
  const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
    headers: { ...form.getHeaders(), 'X-Api-Key': key },
    responseType: 'arraybuffer',
    timeout: 60000,
    validateStatus: () => true
  })
  if (res.status !== 200 || !isImg(res.headers['content-type'])) throw new Error(`remove.bg ${res.status}`)
  return Buffer.from(res.data)
}

async function viaCandidates(url) {
  let lastErr
  for (const build of CANDIDATES) {
    try {
      const res = await axios.get(build(url), {
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        validateStatus: () => true
      })
      const type = res.headers['content-type'] || ''
      if (res.status === 200 && isImg(type)) return Buffer.from(res.data)
      if (res.status === 200 && /json/i.test(type)) {
        const link = findUrl(JSON.parse(Buffer.from(res.data).toString('utf8')))
        if (link) {
          const img = await axios.get(link, { responseType: 'arraybuffer', timeout: 60000 })
          if (isImg(img.headers['content-type'])) return Buffer.from(img.data)
        }
      }
      lastErr = new Error(`status ${res.status}`)
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('semua API gagal')
}

let handler = async (m, { sock, text, reply, prefix, usedPrefix }) => {
  const p = usedPrefix ?? prefix ?? '.'
  const image = pickImage(m)
  if (!image) {
    return reply(
      `✂️ *HAPUS BACKGROUND*\n\n` +
      `Kirim / reply foto dengan caption:\n` +
      `• ${p}removebg → PNG transparan\n` +
      `• ${p}removebg stiker → jadi stiker`
    )
  }

  let media
  try { media = await image.download() } catch { media = null }
  if (!media?.length) return reply('❌ Gagal mengunduh gambar, coba kirim ulang.')

  await reply('⏳ Menghapus background, tunggu sebentar...')

  let result
  try {
    const key = process.env.REMOVEBG_KEY || global.APIKeys?.removebg
    if (key && key !== 'YOUR-APIKEY') {
      try { result = await viaOfficial(media, key) } catch (e) { console.error('[removebg] resmi gagal:', e?.message || e) }
    }
    if (!result) {
      const url = await uploadPone(media, `rb-${Date.now()}.jpg`)
      result = await viaCandidates(url)
    }
  } catch (e) {
    console.error('[removebg]', e?.message || e)
    return reply('❌ Gagal menghapus background. API sedang bermasalah, coba lagi nanti.')
  }

  const asSticker = /^(s|stiker|sticker)$/i.test(String(text || '').trim())
  if (asSticker) {
    return sock.sendImageAsSticker(m.chat, result, m, {
      packname: config.sticker.packname,
      author: config.sticker.author
    })
  }
  // 1) dokumen PNG (transparansi tetap utuh)
  await sock.sendMessage(m.chat, {
    document: result,
    mimetype: 'image/png',
    fileName: 'removebg.png',
    caption: 'Nih hasilnya ✂️'
  }, { quoted: m })

  // 2) foto langsung (preview di chat)
  return sock.sendMessage(m.chat, {
    image: result,
    caption: 'Background berhasil dihapus ✅'
  }, { quoted: m })
}

handler.command = ['removebg', 'nobg', 'hapusbg']
handler.help = ['removebg [stiker]']
handler.tags = ['convert']
handler.limit = true

export default handler
