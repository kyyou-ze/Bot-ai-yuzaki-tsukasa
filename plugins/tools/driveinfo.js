// Drive Info — cek info file Google Drive (nama, ukuran, tipe) lewat listnr.ai
//   .driveinfo <link Google Drive>   (atau balas pesan berisi link)
const API_URL = 'https://bff.listnr.tech/backend/user/getInfoYT'

const fmtBytes = (b) => {
    b = Number(b)
    if (!b || isNaN(b)) return null
    const u = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)))
    return `${parseFloat((b / 1024 ** i).toFixed(2))} ${u[i]}`
}

// cari nilai pertama dari beberapa kemungkinan nama field, di level mana pun
const pick = (obj, keys) => {
    const stack = [obj]
    while (stack.length) {
        const o = stack.shift()
        if (!o || typeof o !== 'object') continue
        for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '' && typeof o[k] !== 'object') return o[k]
        stack.push(...Object.values(o))
    }
    return null
}

let handler = async (m, { text, reply, prefix, command }) => {
    const url = (String(text || '') + ' ' + (m.quoted?.text || '')).match(/https?:\/\/drive\.google\.com\/[^\s]+/i)?.[0]
    if (!url) return reply(`📁 *DRIVE INFO*\n\nPenggunaan: *${prefix + command} <link Google Drive>*\nContoh: ${prefix + command} https://drive.google.com/file/d/xxxx/view\n\n_Untuk mengunduh file gunakan .drivedl_`)

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', Origin: 'https://listnr.ai', Referer: 'https://listnr.ai/' },
            body: JSON.stringify({ url, platform: 'googledrive', type: 'file' }),
            signal: AbortSignal.timeout(20000)
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)

        const name = pick(data, ['name', 'title', 'fileName', 'filename'])
        const size = pick(data, ['size', 'fileSize', 'filesize', 'bytes'])
        const mime = pick(data, ['mimeType', 'mimetype', 'type', 'contentType'])
        const duration = pick(data, ['duration', 'length'])
        const thumb = pick(data, ['thumbnail', 'thumb', 'image', 'cover'])

        if (!name && !size && !mime) return reply('```' + JSON.stringify(data, null, 1).slice(0, 1500) + '```')
        return reply(
            `📁 *INFO FILE DRIVE*\n\n` +
            `• Nama : ${name || '-'}\n• Ukuran : ${fmtBytes(size) || size || '-'}\n• Tipe : ${mime || '-'}\n` +
            (duration ? `• Durasi : ${duration}\n` : '') + (thumb ? `• Thumbnail : ${thumb}\n` : '') + `\n🔗 ${url}`
        )
    } catch (e) {
        return reply(`❌ ${e.message || 'Gagal mengambil info file'}`)
    }
}

handler.command = ['driveinfo']
handler.help = ['driveinfo <link drive>']
handler.tags = ['tools']
handler.limit = true

export default handler
