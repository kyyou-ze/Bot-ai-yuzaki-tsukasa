import { wrapPlugin } from '../../lib/engine/plugins.js'

/*
 * Fitur  : E-Hentai (pencarian galeri / detail / gambar)
 * Base   : kadokunn.com/nsfw/ehentai
 * Pakai  : .ehentai <query>            cari galeri (contoh: parody:naruto)
 *          .ehentai <url galeri>       detail + beberapa gambar
 *          .ehentai <url> -n 3         jumlah gambar (maks 10)
 */

const BASE_URL = 'https://kadokunn.com/nsfw/ehentai'
const TIMEOUT = 25_000
const BLOCKED = /\b(loli|lolicon|shota|shotacon|toddlercon|child|underage)\b/i

async function getEhentai(options = {}) {
  const qs = new URLSearchParams()
  for (const k of ['url', 'query', 'gid', 'token', 'limit', 'max_images']) {
    if (options[k] !== undefined && options[k] !== '') qs.append(k, options[k])
  }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    const res = await fetch(`${BASE_URL}?${qs}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
      },
      signal: ctl.signal
    })
    const raw = await res.text()
    let data = null
    try { data = JSON.parse(raw) } catch {}
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.message || data?.error || raw.slice(0, 120)}`)
    return data || { result: raw }
  } finally {
    clearTimeout(timer)
  }
}

// ───────── helper baca respons (bentuk JSON-nya fleksibel) ─────────
const root = d => d?.result ?? d?.data ?? d
const first = (o, ...k) => { for (const x of k) if (o?.[x] != null && o[x] !== '') return o[x] }
const toArr = v => Array.isArray(v) ? v : []
const isUrl = s => typeof s === 'string' && /^https?:\/\//i.test(s)

function pickList(d) {
  const r = root(d)
  if (Array.isArray(r)) return r
  return toArr(first(r, 'results', 'galleries', 'items', 'list'))
}

function pickImages(d) {
  const r = root(d)
  const arr = toArr(first(r, 'images', 'pages', 'files'))
  return arr.map(i => (typeof i === 'string' ? i : first(i, 'url', 'src', 'image', 'full'))).filter(isUrl)
}

const clip = (s, n = 90) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s)

const pluginConfig = {
  name: 'ehentai',
  alias: [],
  category: 'anime',
  usage: '<query | url> [-n jumlah]',
  example: '.ehentai parody:naruto',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true
}

async function run(m, { sock, text }) {
  let input = String(text || '').trim()
  if (!input) {
    return m.reply('*E-HENTAI*\n━━━━━━━━━━━━━━━━\n• .ehentai <query>\n• .ehentai <url galeri>\n• tambah -n 3 untuk jumlah gambar')
  }

  let n = 5
  const mn = input.match(/\s-n\s*(\d+)\s*$/i)
  if (mn) { n = Math.min(Math.max(+mn[1], 1), 10); input = input.slice(0, mn.index).trim() }

  if (BLOCKED.test(input)) return m.reply('❌ Kata kunci itu diblokir.')

  const isGallery = /e-?hentai\.org\/(g|s)\//i.test(input)

  try {
    await m.reply('⏳ Mengambil data...')

    if (!isGallery) {
      const data = await getEhentai({ query: input, limit: 10 })
      const list = pickList(data).filter(g => !BLOCKED.test(JSON.stringify(g)))
      if (!list.length) return m.reply('Tidak ditemukan.')
      const lines = list.slice(0, 10).map((g, i) => {
        const title = first(g, 'title', 'name', 'title_jpn') || '-'
        const link = first(g, 'url', 'link') || (g.gid && g.token ? `https://e-hentai.org/g/${g.gid}/${g.token}/` : '-')
        const extra = [first(g, 'category'), first(g, 'filecount', 'pages') && `${first(g, 'filecount', 'pages')}p`, first(g, 'rating')].filter(Boolean).join(' • ')
        return `${i + 1}. ${clip(title)}${extra ? `\n   ${extra}` : ''}\n   ${link}`
      })
      return m.reply(`*HASIL: ${input}*\n━━━━━━━━━━━━━━━━\n${lines.join('\n\n')}\n\nKirim link galeri dengan .ehentai <url> untuk lihat gambarnya.`)
    }

    const data = await getEhentai({ url: input, max_images: n })
    const r = root(data)
    if (BLOCKED.test(JSON.stringify(r?.tags ?? r?.title ?? ''))) return m.reply('❌ Galeri diblokir.')

    const title = first(r, 'title', 'name', 'title_jpn') || '-'
    const tags = toArr(r?.tags).map(t => (typeof t === 'string' ? t : first(t, 'name', 'tag'))).filter(Boolean)
    const info = [first(r, 'category'), first(r, 'filecount', 'pages') && `${first(r, 'filecount', 'pages')} halaman`, first(r, 'rating') && `★ ${first(r, 'rating')}`].filter(Boolean).join(' • ')
    const caption = `*${clip(title, 150)}*\n${info}${tags.length ? `\n\n${clip(tags.slice(0, 15).join(', '), 300)}` : ''}`

    const imgs = pickImages(data).slice(0, n)
    if (!imgs.length) return m.reply(`${caption}\n\n(Tidak ada gambar yang bisa di-resolve)`)

    await sock.sendMessage(m.chat, { image: { url: imgs[0] }, caption }, { quoted: m })
    for (const url of imgs.slice(1)) {
      await sock.sendMessage(m.chat, { image: { url } }, { quoted: m })
    }
  } catch (e) {
    console.log(e)
    m.reply(`❌ Gagal: ${e.message}`)
  }
}

const handler = wrapPlugin(pluginConfig, (m, ctx) => run(m, { ...ctx, text: ctx.text ?? (m.args || []).join(' ') }))

handler.limit = true

export default handler
