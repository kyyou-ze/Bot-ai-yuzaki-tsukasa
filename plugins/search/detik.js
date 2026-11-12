// Detik.com — cari berita, terkini, terpopuler & baca artikel
//   .detik cari <kata>   |  .detik terkini  |  .detik populer  |  .detik <link artikel>
import * as cheerio from 'cheerio'

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}
const get = async (url) => {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw new Error(`detik.com merespons HTTP ${r.status}`)
    return cheerio.load(await r.text())
}
const txt = (s) => String(s || '').replace(/\s+/g, ' ').trim()

function parseList($, sel) {
    const out = [], seen = new Set()
    $(sel).each((_, el) => {
        const title = txt($(el).find('a[dtr-ttl]').first().attr('dtr-ttl') || $(el).find('h3 a, h2 a, .media__title a').first().text() || $(el).find('img').attr('alt'))
        const url = $(el).find('a[dtr-ttl], .media__link, a').last().attr('href')
        if (!title || !url || !url.startsWith('http') || seen.has(url)) return
        seen.add(url)
        out.push({ title, url, date: txt($(el).find('.media__date span').attr('title') || $(el).find('.media__date').text()) || null, desc: txt($(el).find('.media__desc').text()) || null })
    })
    return out
}

const fmtList = (head, rows) => `${head}\n\n` + rows.slice(0, 10).map((r, i) => `${i + 1}. *${r.title}*${r.date ? `\n   🕒 ${r.date}` : ''}\n   ${r.url}`).join('\n\n') + `\n\n_Baca isi: .detik <link>_`

async function detail(url) {
    const $ = await get(url.includes('?') ? `${url}&single=1` : `${url}?single=1`)
    const body = $('.itp_bodycontent, .detail__body-text, .read__content')
    body.find('script, style, .detail__body-tag, .sisip_video_ds, .paradetiks, .linksisip, div[id^="crosslink"], .banner').remove()
    const ps = []
    body.find('p').each((_, p) => {
        const t = txt($(p).text())
        if (t && !/simak juga|baca juga|scroll to continue/i.test(t)) ps.push(t)
    })
    return {
        title: txt($('h1.detail__title, h1.title, .detail__title').first().text()),
        author: txt($('.detail__author, .author').first().text()),
        date: txt($('.detail__date, .date').first().text()),
        image: $('.detail__media-image img, .detail__media img, figure img').first().attr('src') || null,
        content: ps.length ? ps.join('\n\n') : txt(body.text())
    }
}

let handler = async (m, { sock, text, reply, prefix, command }) => {
    const input = String(text || '').trim() || m.quoted?.text?.match(/https?:\/\/\S*detik\.com\S*/i)?.[0] || ''
    const p = prefix + command
    if (!input) return reply(`📰 *DETIK.COM*\n\n${p} cari <kata>\n${p} terkini\n${p} populer\n${p} <link artikel>`)

    const [a, ...rest] = input.split(/\s+/)
    const al = a.toLowerCase()
    try {
        if (/^https?:\/\//i.test(input)) {
            if (!/detik\.com/i.test(new URL(input).hostname)) return reply('❌ Hanya link detik.com yang didukung.')
            const d = await detail(input.split(/\s+/)[0])
            if (!d.title && !d.content) return reply('❌ Isi artikel tidak terbaca.')
            const body = `📰 *${d.title}*\n${d.author ? `✍️ ${d.author}\n` : ''}${d.date ? `🕒 ${d.date}\n` : ''}\n${d.content.slice(0, 3000)}${d.content.length > 3000 ? '…\n\n_(dipotong, buka link untuk lengkap)_' : ''}`
            if (d.image) return sock.sendMessage(m.chat, { image: { url: d.image }, caption: body.slice(0, 1000) }, { quoted: m }).then(() => body.length > 1000 && reply(body.slice(0, 3500))).catch(() => reply(body))
            return reply(body)
        }
        if (['terkini', 'latest', 'new'].includes(al)) {
            const rows = parseList(await get('https://news.detik.com/indeks'), '.list-content__item, .media')
            return reply(rows.length ? fmtList('🆕 *BERITA TERKINI*', rows) : 'Tidak ada berita.')
        }
        if (['populer', 'popular', 'terpopuler'].includes(al)) {
            const rows = parseList(await get('https://www.detik.com/terpopuler'), '.list-content__item')
            return reply(rows.length ? fmtList('🔥 *TERPOPULER*', rows) : 'Tidak ada berita.')
        }
        const q = ['cari', 'search'].includes(al) ? rest.join(' ') : input
        if (!q) return reply(`Format: ${p} cari <kata>`)
        const rows = parseList(await get(`https://www.detik.com/search/searchall?query=${encodeURIComponent(q)}`), '.list-content__item')
        return reply(rows.length ? fmtList(`🔎 *HASIL "${q}"*`, rows) : `Tidak ada hasil untuk "${q}".`)
    } catch (e) {
        return reply(`❌ ${e.message || 'Gagal mengambil berita'}`)
    }
}

handler.command = ['detik']
handler.help = ['detik cari <kata>', 'detik terkini', 'detik populer', 'detik <link>']
handler.tags = ['search']
handler.limit = true

export default handler
