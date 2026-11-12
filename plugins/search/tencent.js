/*
 * Tencent News — berita & artikel dari tencent.com
 * Scraper by Vamz Spectre (VamxAPI)
 *
 * .tencent                  → berita corporate terbaru
 * .tencent <kata kunci>     → cari berita (contoh: .tencent cloud)
 * .tencent <kata kunci> 2   → halaman ke-2 hasil pencarian
 * .tencent <link artikel>   → baca isi artikel
 */
import axios from 'axios'
import * as cheerio from 'cheerio'
import { reactTo } from '../../lib/core/file.js'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
}
const IS_URL = /^https?:\/\/(www\.)?tencent\.com\/.+/i
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

async function tencentScraper(queryOrUrl, page = 1) {
  const input = String(queryOrUrl || '').trim()

  // ───────── detail artikel ─────────
  if (IS_URL.test(input)) {
    const { data: html } = await axios.get(input, { headers: HEADERS, timeout: 15000 })
    const $ = cheerio.load(html)

    const title = clean($('h1').first().text()) || clean($('title').text()).replace(/\s*-\s*Tencent.*$/i, '')
    const date = clean($('.entry-header .entry-meta, .tc-blogpost-date, time').first().text())
    const thumbnail = $('article .wp-post-image').first().attr('src') || $('meta[property="og:image"]').attr('content') || null

    const categories = []
    $('.post-categories li a, .tc-blog-cats a').each((_, el) => {
      const cat = clean($(el).text())
      if (cat && !categories.includes(cat)) categories.push(cat)
    })

    const paragraphs = []
    $('article .entry-content p, .post-content p, article p').each((_, el) => {
      const p = clean($(el).text())
      if (p && !paragraphs.includes(p)) paragraphs.push(p)
    })

    return { type: 'detail', result: { title, url: input, date, thumbnail, categories, content: paragraphs.join('\n\n') } }
  }

  // ───────── search / berita terbaru ─────────
  const q = input
  const endpoint = q
    ? `https://www.tencent.com/page/${page}/?s=${encodeURIComponent(q)}`
    : `https://www.tencent.com/category/corporate/page/${page}/`

  const { data: html } = await axios.get(endpoint, { headers: HEADERS, timeout: 15000 })
  const $ = cheerio.load(html)

  const items = []
  $('article').each((_, el) => {
    const article = $(el)
    const titleEl = article.find('h2.blog-title a, h2 a, h3 a').first()
    const title = clean(titleEl.text())
    const link = titleEl.attr('href')
    if (!title || !link) return
    items.push({
      title,
      link,
      snippet: clean(article.find('.news-image p, p').first().text()) || null,
      date: clean(article.find('.tc-blogpost-date, .entry-meta').first().text()) || null
    })
  })

  return { type: q ? 'search' : 'latest', query: q, page, result: items }
}

let handler = async (m, { sock, text, reply, prefix, usedPrefix }) => {
  const p = usedPrefix ?? prefix ?? '.'
  let input = String(text || '').trim()

  // angka di akhir (setelah kata kunci) = nomor halaman
  let page = 1
  if (!IS_URL.test(input)) {
    const mt = input.match(/^(.+?)\s+(\d{1,2})$/)
    if (mt) { input = mt[1].trim(); page = Math.max(1, parseInt(mt[2], 10)) }
  }

  await reactTo(sock, m, '🕒')
  try {
    const res = await tencentScraper(input, page)

    // ───── detail ─────
    if (res.type === 'detail') {
      const r = res.result
      if (!r.title || !r.content) throw new Error('Isi artikel tidak ditemukan di link itu.')
      const caption =
        `*▢ TENCENT NEWS*\n\n` +
        `❀ Judul : ${r.title}\n` +
        (r.date ? `❀ Tanggal : ${r.date}\n` : '') +
        (r.categories.length ? `❀ Kategori : ${r.categories.join(', ')}\n` : '') +
        `❀ Link : ${r.url}\n\n` +
        cut(r.content, 2500)

      if (r.thumbnail) {
        try {
          await sock.sendMessage(m.chat, { image: { url: r.thumbnail }, caption }, { quoted: m })
          return reactTo(sock, m, '✅')
        } catch {}
      }
      await reply(caption)
      return reactTo(sock, m, '✅')
    }

    // ───── list ─────
    const items = res.result.slice(0, 10)
    if (!items.length) throw new Error(input ? `Tidak ada berita untuk "${input}".` : 'Tidak ada berita saat ini.')

    const head = input ? `*▢ TENCENT NEWS: ${input}* (hal. ${page})` : `*▢ TENCENT NEWS — Terbaru* (hal. ${page})`
    const body = items.map((x, i) =>
      `${i + 1}. *${x.title}*\n` +
      (x.date ? `   ${x.date}\n` : '') +
      (x.snippet ? `   ${cut(x.snippet, 140)}\n` : '') +
      `   ${x.link}`
    ).join('\n\n')

    await reply(`${head}\n\n${body}\n\n_Baca isi artikel: ${p}tencent <link>_`)
    return reactTo(sock, m, '✅')
  } catch (e) {
    await reactTo(sock, m, '❌')
    const status = e.response?.status
    return reply(`❌ ${status ? `Gagal mengambil data (HTTP ${status}).` : e.message}`)
  }
}

handler.command = ['tencent']
handler.help = ['tencent <kata kunci / link>']
handler.tags = ['search']
handler.limit = false

export default handler
