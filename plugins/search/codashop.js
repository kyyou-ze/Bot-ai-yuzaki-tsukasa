// ───────── codashop: cek harga top up game ─────────
// Skrep asli: JH a.k.a Dhika - FIONY BOT (Credits to all Fiony's Bot Admin)
import axios from 'axios'
import { wrapPlugin } from '../../lib/engine/plugins.js'

const BASE = 'https://www.codashop.com'
const UA = 'Mozilla/5.0 (Linux; Android 13; 23021RAA2Y Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.43 Mobile Safari/537.36'

const rupiah = (n) => 'Rp. ' + Number(n).toLocaleString('id-ID')

async function searchGame(q) {
  const { data, status } = await axios.post(
    'https://order-sg.codashop.com/search',
    JSON.stringify({ countryCode: '360', q }),
    {
      headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'User-Agent': UA },
      validateStatus: () => true,
      timeout: 30000
    }
  )
  if (status >= 400 || !data) throw new Error(`Search API error (HTTP ${status})`)
  if (!Array.isArray(data)) throw new Error('Format balasan search tidak valid')
  if (!data.length) throw new Error('Game tidak ditemukan')

  return data.map(i => ({
    name: i.productName || 'Unknown',
    image: i.productImage || '',
    url: i.productUrl ? BASE + i.productUrl : ''
  }))
}

async function getDetail(input) {
  let target = input.trim()
  if (!/^https?:\/\//i.test(target)) target = BASE + (target.startsWith('/') ? '' : '/') + target

  const { data: html, status } = await axios.get(target, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'User-Agent': UA
    },
    validateStatus: () => true,
    timeout: 30000
  })
  if (status >= 400 || !html) throw new Error(`Detail error (HTTP ${status})`)

  let publisher = 'Unknown Publisher', description = '', rating = '0', reviews = '0'
  const ldRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let ld
  while ((ld = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(ld[1])
      for (const obj of Array.isArray(parsed) ? parsed : [parsed]) {
        if (obj && obj['@type'] === 'Product') {
          if (obj.brand?.name) publisher = obj.brand.name
          if (obj.description) description = obj.description
          if (obj.aggregateRating) {
            rating = String(obj.aggregateRating.ratingValue ?? rating)
            reviews = String(obj.aggregateRating.ratingCount ?? reviews)
          }
        }
      }
    } catch {}
  }

  const nuxt = html.match(/<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/i)
  if (!nuxt?.[1]) throw new Error('NUXT_DATA tidak ditemukan di halaman')

  let arr
  try { arr = JSON.parse(nuxt[1]) } catch { throw new Error('Gagal parse NUXT_DATA') }
  if (!Array.isArray(arr)) throw new Error('NUXT_DATA bukan array')

  let title = '', cover = ''
  for (const v of arr) {
    if (v && typeof v === 'object' && v.productTagline !== undefined && v.thumbnailUrl !== undefined) {
      if (typeof arr[v.name] === 'string') title = arr[v.name]
      if (typeof arr[v.thumbnailUrl] === 'string') cover = arr[v.thumbnailUrl]
      if (title && cover) break
    }
  }

  const channels = {}
  for (const it of arr) {
    if (it && typeof it === 'object' && it.displayName !== undefined && it.imageUrl !== undefined) {
      const id = arr[it.id], name = arr[it.displayName]
      if (id !== undefined && typeof name === 'string') channels[id] = name
    }
  }

  const items = []
  for (const obj of arr) {
    if (!(obj && typeof obj === 'object' && obj.title !== undefined && obj.pricePoints !== undefined)) continue
    const name = typeof arr[obj.title] === 'string' ? arr[obj.title] : ''
    if (!name) continue
    const points = Array.isArray(arr[obj.pricePoints]) ? arr[obj.pricePoints] : []
    const payments = []
    for (const idx of points) {
      const pp = arr[idx]
      if (!pp || typeof pp !== 'object') continue
      const price = typeof arr[pp.price] === 'number' ? arr[pp.price] : 0
      if (price > 0) payments.push({ method: channels[arr[pp.paymentChannelId]] || 'Unknown Payment', price })
    }
    if (payments.length) items.push({ name, payments: payments.sort((a, b) => a.price - b.price) })
  }
  if (!items.length) throw new Error('Gagal mengekstrak daftar item')

  return { title: title || 'Unknown Game', publisher, rating, reviews, description, cover, items }
}

const pluginConfig = {
  name: 'codashop',
  alias: [],
  category: 'search',
  description: 'Cari game & cek harga top up di Codashop',
  usage: '.codashop <nama game> | .codashop detail <url/slug>',
  example: '.codashop free fire',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true
}

async function handler(m, { sock }) {
  let text = String(m.text || '').trim()
  if (!text) {
    m.react('❌')
    return m.reply(
      `📌 Contoh:\n*${m.prefix + m.command} free fire* (cari game)\n` +
      `*${m.prefix + m.command} detail /id/free-fire* (cek harga)`
    )
  }

  m.react('🕕')
  try {
    const detailMatch = text.match(/^detail\s+(.+)$/i)
    const looksLikeLink = /^https?:\/\//i.test(text) || text.startsWith('/')

    if (detailMatch || looksLikeLink) {
      const d = await getDetail(detailMatch ? detailMatch[1] : text)

      const lines = d.items.slice(0, 25).map((it, i) => {
        const best = it.payments[0]
        return `${i + 1}. *${it.name}*\n   ${rupiah(best.price)} (${best.method})`
      })

      const caption =
        `🎮 *${d.title}*\n` +
        `- Publisher: ${d.publisher}\n` +
        `- Rating: ${d.rating} (${d.reviews} ulasan)\n\n` +
        `*Harga termurah per item:*\n${lines.join('\n')}` +
        (d.items.length > 25 ? `\n\n...dan ${d.items.length - 25} item lainnya` : '') +
        `\n\n💡 Harga bisa berbeda per metode pembayaran.`

      if (d.cover) {
        await sock.sendMessage(m.chat, { image: { url: d.cover }, caption }, { quoted: m })
      } else {
        await m.reply(caption)
      }
    } else {
      const results = await searchGame(text)
      const list = results.slice(0, 10).map((r, i) =>
        `${i + 1}. *${r.name}*\n   ${m.prefix + m.command} detail ${r.url.replace(BASE, '')}`
      ).join('\n')
      await m.reply(`🔎 *Hasil "${text}"*\n\n${list}\n\nSalin perintah di bawah game untuk lihat harga.`)
    }
    m.react('✅')
  } catch (e) {
    console.error('[Codashop] Error:', e)
    m.react('❌')
    m.reply(`❌ ${e.message}`)
  }
}

export default wrapPlugin(pluginConfig, handler)
