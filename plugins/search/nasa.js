/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Search — NASA Image Library (images-api.nasa.gov)
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  .nasa sun   |   .nasa mars rover | 2   |   .nasa apollo | 1 | video
 */

import axios from 'axios'

const MAX_LIST = 8

async function searchNasa(query, mediaType = 'image', page = 1) {
    const { data } = await axios.get('https://images-api.nasa.gov/search', {
        params: { q: query, media_type: mediaType, page },
        headers: { Accept: 'application/json, text/plain, */*' },
        timeout: 15000
    })
    return data
}

let handler = async (m, { sock, text, reply, example }) => {
    const [q, pg, mt] = String(text || '').split('|').map(s => s.trim())
    if (!q) return example('sun | 1 | image   (media: image / video / audio)')

    const page = Math.max(1, parseInt(pg) || 1)
    const mediaType = ['image', 'video', 'audio'].includes((mt || '').toLowerCase()) ? mt.toLowerCase() : 'image'

    let data
    try {
        data = await searchNasa(q, mediaType, page)
    } catch (e) {
        return reply(`❌ NASA API error: ${e.response?.status || e.message}`)
    }

    const col = data?.collection || {}
    const items = col.items || []
    if (!items.length) return reply(`Tidak ada hasil untuk "${q}".`)

    const shown = items.slice(0, MAX_LIST)
    let out = `🌌 *NASA ${mediaType.toUpperCase()} SEARCH*\n\n🔎 Query: ${q}\n📄 Halaman: ${page}\n📊 Total: ${col.metadata?.total_hits || 0}\n📦 Ditampilkan: ${shown.length}\n\n━━━━━━━━━━━━━━━━━━━━`

    shown.forEach((item, i) => {
        const info = item.data?.[0] || {}
        const preview = (item.links || []).find(l => l.rel === 'preview')
        out += `\n\n${i + 1}. ${info.title || 'No Title'}\n🆔 ${info.nasa_id || '-'}\n🏛️ ${info.center || '-'}\n📅 ${info.date_created || '-'}\n🖼️ ${preview?.href || '-'}`
    })

    if ((col.links || []).some(l => l.rel === 'next')) out += `\n\n━━━━━━━━━━━━━━━━━━━━\n➡️ Halaman berikutnya: .nasa ${q} | ${page + 1}`

    const firstPreview = (shown[0]?.links || []).find(l => l.rel === 'preview')?.href
    if (mediaType === 'image' && firstPreview) {
        try {
            return await sock.sendMessage(m.chat, { image: { url: firstPreview }, caption: out }, { quoted: m })
        } catch {}
    }
    return reply(out)
}

handler.command = ['nasa']
handler.help = ['nasa <query> | <halaman> | <image/video/audio>']
handler.tags = ['search']
handler.limit = true

export default handler
