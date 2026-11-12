import { isType, mediaNode } from '../../lib/core/system.js'

// .imgbb [durasi]            kirim/reply gambar -> diunggah ke ImgBB
// .imgbb <url> [durasi]      unggah dari link gambar
// durasi: 5m 15m 30m 1h 3h 6h 12h 1d 2d..6d 1w 2w 3w 1mo..6mo, atau never (default)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const EXPIRATION_MAP = {
    never: '', '0': '',
    '5m': 'PT5M', '5min': 'PT5M', '15m': 'PT15M', '15min': 'PT15M', '30m': 'PT30M', '30min': 'PT30M',
    '1h': 'PT1H', '3h': 'PT3H', '6h': 'PT6H', '12h': 'PT12H',
    '1d': 'P1D', '2d': 'P2D', '3d': 'P3D', '4d': 'P4D', '5d': 'P5D', '6d': 'P6D',
    '1w': 'P1W', '2w': 'P2W', '3w': 'P3W',
    '1mo': 'P1M', '2mo': 'P2M', '3mo': 'P3M', '4mo': 'P4M', '5mo': 'P5M', '6mo': 'P6M',
    '1month': 'P1M', '2months': 'P2M', '3months': 'P3M', '4months': 'P4M', '5months': 'P5M', '6months': 'P6M'
}

function normalizeExpiration(exp) {
    if (!exp) return ''
    const clean = String(exp).trim().toLowerCase()
    if (EXPIRATION_MAP[clean] !== undefined) return EXPIRATION_MAP[clean]
    const upper = String(exp).trim().toUpperCase()
    return Object.values(EXPIRATION_MAP).includes(upper) ? upper : ''
}
const isKnownExpiration = (x) => EXPIRATION_MAP[String(x).toLowerCase()] !== undefined || Object.values(EXPIRATION_MAP).includes(String(x).toUpperCase())

async function getSessionAndToken() {
    const res = await fetch('https://id.imgbb.com/', { headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' } })
    const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean)
    const cookies = raw.map(c => c.split(';')[0]).join('; ')
    const html = await res.text()
    const match = html.match(/PF\.obj\.config\.auth_token\s*=\s*"([^"]+)"/)
    if (!match) throw new Error('Gagal mengambil auth_token dari ImgBB.')
    return { authToken: match[1], cookies }
}

async function uploadImgbb(input, { expiration = '', filename = 'image.png' } = {}) {
    const { authToken, cookies } = await getSessionAndToken()
    const expCode = normalizeExpiration(expiration)
    const form = new FormData()
    form.append('action', 'upload')
    form.append('auth_token', authToken)
    if (expCode) form.append('expiration', expCode)
    if (Buffer.isBuffer(input)) {
        form.append('type', 'file')
        form.append('source', new Blob([input], { type: 'application/octet-stream' }), filename)
    } else {
        form.append('type', 'url')
        form.append('source', String(input))
    }

    const res = await fetch('https://id.imgbb.com/json', {
        method: 'POST',
        headers: { 'User-Agent': UA, Referer: 'https://id.imgbb.com/', Accept: 'application/json', Cookie: cookies },
        body: form
    })
    const body = await res.text()
    let json
    try { json = JSON.parse(body) } catch { throw new Error('Respon tidak valid dari ImgBB: ' + body.slice(0, 100)) }
    if (json.status_code !== 200 || !json.image) throw new Error(json.error?.message || json.status_txt || 'Gagal mengunggah gambar ke ImgBB.')
    const img = json.image
    return {
        directUrl: img.url, viewerUrl: img.url_viewer, deleteUrl: img.delete_url,
        thumbUrl: img.thumb?.url || img.display_url, filename: img.filename,
        size: img.size_formatted || `${img.size} bytes`, width: img.width, height: img.height,
        expirationCode: expCode || 'never'
    }
}

let handler = async (m, { text, reply, prefix, command }) => {
    const p = prefix || '.'
    const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)
    const urlToken = tokens.find(t => /^https?:\/\//i.test(t))
    const expToken = tokens.find(t => t !== urlToken && isKnownExpiration(t))
    const hasImage = isType(m, 'imageMessage')

    if (!urlToken && !hasImage) {
        return reply(
            `🖼️ *ImgBB Uploader*\n\n` +
            `• Kirim/reply gambar dengan *${p}${command} [durasi]*\n` +
            `• Atau *${p}${command} <url gambar> [durasi]*\n\n` +
            `Durasi: 5m 15m 30m 1h 3h 6h 12h 1d 1w 1mo 6mo, atau never (default)\nContoh: ${p}${command} 1d`
        )
    }

    await reply(global.mess?.wait || 'Sedang mengunggah...')
    try {
        let input = urlToken
        if (!input) {
            const buffer = await mediaNode(m, 'imageMessage').download()
            if (!buffer?.length) throw new Error('Gambar kosong / gagal diunduh')
            input = buffer
        }
        const r = await uploadImgbb(input, { expiration: expToken || 'never' })
        return reply(
            `✅ *Upload ImgBB berhasil*\n\n` +
            `🔗 Link langsung: ${r.directUrl}\n` +
            `👁️ Viewer: ${r.viewerUrl}\n` +
            `🗑️ Hapus: ${r.deleteUrl}\n\n` +
            `📐 ${r.width}x${r.height} • ${r.size}\n⏳ Kedaluwarsa: ${r.expirationCode}`
        )
    } catch (e) {
        return reply(`⚠️ ${e.message}`)
    }
}

handler.command = ['imgbb']
handler.help = ['imgbb [durasi]']
handler.tags = ['convert']
handler.limit = true

export default handler
