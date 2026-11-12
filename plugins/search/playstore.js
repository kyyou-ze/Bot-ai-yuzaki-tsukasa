// Google Play Store — detail aplikasi lengkap
//   .playstore <package id | link Play Store>
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
const clean = (h) => decode(String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim()
const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n))

export async function scrapePlay(input) {
    const raw = String(input || '').trim()
    const pkg = (raw.match(/[?&]id=([a-zA-Z0-9._]+)/) || raw.match(/details\/([a-zA-Z0-9._]+)/) || raw.match(/^([a-zA-Z0-9._]+)$/))?.[1]
    if (!pkg) throw new Error('Package ID / link tidak valid. Contoh: com.snowcorp.stickerly.android')

    const res = await fetch(`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=id&gl=ID`, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' }, signal: AbortSignal.timeout(20000)
    })
    if (res.status === 404) throw new Error(`Aplikasi "${pkg}" tidak ditemukan di Google Play.`)
    if (!res.ok) throw new Error(`Google Play merespons HTTP ${res.status}.`)
    const html = await res.text()

    let ld = {}
    try { ld = JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '{}') } catch {}

    let info = null
    try {
        const af = html.match(/AF_initDataCallback\s*\(\s*\{key:\s*['"]ds:5['"][\s\S]*?data:\s*([\s\S]*?)\s*,\s*sideChannel:/)
        if (af) info = JSON.parse(af[1])?.[1]?.[2] || null
    } catch {}

    const cnt = parseInt(ld.aggregateRating?.ratingCount || '0', 10) || 0
    const price = ld.offers?.[0]?.price
    return {
        pkg,
        title: info?.[0]?.[0] || ld.name || 'Aplikasi Android',
        summary: clean(info?.[73]?.[0]?.[1] || ''),
        description: clean(info?.[72]?.[0]?.[1] || ld.description || ''),
        category: (() => { const c = info?.[79]?.[0]?.[0] || ld.applicationCategory || ''; return Array.isArray(c) ? c[0] : c })(),
        developer: info?.[37]?.[0] || ld.author?.name || '-',
        email: info?.[69]?.[1]?.[0] || null,
        rating: parseFloat(ld.aggregateRating?.ratingValue || '0') || 0,
        reviews: short(cnt),
        installs: info?.[13]?.[0] || '-',
        price: !price || price === '0' ? 'Gratis' : `${ld.offers?.[0]?.priceCurrency || ''} ${price}`.trim(),
        contentRating: ld.contentRating || '-',
        updated: info?.[145]?.[0]?.[0] || '-',
        whatsNew: clean(info?.[144]?.[1]?.[1] || ''),
        icon: info?.[95]?.[0]?.[3]?.[2] || ld.image || null,
        url: `https://play.google.com/store/apps/details?id=${pkg}`
    }
}

let handler = async (m, { sock, text, reply, prefix, command }) => {
    const input = String(text || m.quoted?.text || '').trim()
    if (!input) return reply(`🛍️ *GOOGLE PLAY STORE*\n\nPenggunaan: *${prefix + command} <package id / link>*\nContoh: ${prefix + command} com.snowcorp.stickerly.android`)
    try {
        const a = await scrapePlay(input)
        const caption =
            `🛍️ *${a.title}*\n${a.summary ? `_${a.summary}_\n` : ''}\n` +
            `• Package : ${a.pkg}\n• Kategori : ${a.category || '-'}\n• Developer : ${a.developer}\n${a.email ? `• Email : ${a.email}\n` : ''}` +
            `• Rating : ⭐ ${a.rating || '-'} (${a.reviews} ulasan)\n• Instal : ${a.installs}\n• Harga : ${a.price}\n• Usia : ${a.contentRating}\n• Update : ${a.updated}\n` +
            (a.whatsNew ? `\n*Yang baru*\n${a.whatsNew.slice(0, 400)}\n` : '') +
            (a.description ? `\n*Deskripsi*\n${a.description.slice(0, 600)}${a.description.length > 600 ? '…' : ''}\n` : '') +
            `\n🔗 ${a.url}`
        if (a.icon) return sock.sendMessage(m.chat, { image: { url: a.icon }, caption }, { quoted: m }).catch(() => reply(caption))
        return reply(caption)
    } catch (e) {
        return reply(`❌ ${e.message || 'Gagal mengambil data'}`)
    }
}

handler.command = ['playstore']
handler.help = ['playstore <package>']
handler.tags = ['search']
handler.limit = true

export default handler
