// .imgtoteks / .scanread — ekstrak teks dari gambar (layanan ScanRead.ai, hasil format markdown)
// Cara pakai:
//   kirim foto dengan caption .imgtoteks
//   reply foto dengan .imgtoteks
//   .imgtoteks https://link-gambar.jpg
// Sumber awal: STARLABS (img to teks)
import { getMedia } from '../../lib/group/sosial.js'

const AKUNLABS = 'https://akunlabs.my.id'
const SCANREAD = 'https://scanread.ai'
const POLL_INTERVAL = 3000
const MAX_TIMEOUT = 120000
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const EXT_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

// request JSON dengan timeout; tidak melempar error untuk status non-2xx supaya pesan servernya bisa dibaca
async function req(url, { method = 'GET', headers = {}, body, cookie } = {}) {
    const res = await fetch(url, {
        method,
        headers: {
            'User-Agent': UA,
            Accept: 'application/json',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000)
    })
    const raw = await res.text()
    let json = null
    try { json = JSON.parse(raw) } catch {}
    return { status: res.status, raw, json }
}

// ambil gambar: dari kiriman / reply, atau dari link di teks perintah
async function getImage(m, text) {
    const media = await getMedia(m, ['image']).catch(() => null)
    if (media?.buffer) {
        const mime = /^image\//.test(media.mime) ? media.mime.split(';')[0] : 'image/jpeg'
        return { buffer: media.buffer, mime, name: `image.${mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1] || 'jpg'}` }
    }
    const url = String(text || '').trim().split(/\s+/)[0]
    if (/^https?:\/\//i.test(url)) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(60000) })
        if (!res.ok) throw new Error(`Gagal mengunduh gambar (${res.status}).`)
        const type = (res.headers.get('content-type') || '').split(';')[0]
        const ext = (new URL(url).pathname.split('.').pop() || '').toLowerCase()
        const mime = type.startsWith('image/') ? type : EXT_MIME[ext]
        if (!mime) throw new Error('Link itu bukan gambar.')
        const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'image.jpg'
        return { buffer: Buffer.from(await res.arrayBuffer()), mime, name }
    }
    return null
}

async function scanImage({ buffer, mime, name }) {
    // 1) token akses (+ cookie sesi)
    const auth = await req(`${AKUNLABS}/api/scanread`)
    const token = auth.json?.tokens?.access_token
    if (!token) throw new Error(`Gagal ambil token (status ${auth.status}).`)
    const cookie = auth.json.cookies && typeof auth.json.cookies === 'object'
        ? Object.entries(auth.json.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
        : ''
    const authz = { Authorization: `Bearer ${token}` }

    // 2) minta URL upload
    const presign = await req(`${SCANREAD}/api/scan/presign`, {
        method: 'POST', headers: authz, cookie,
        body: { fileName: name, fileSize: buffer.length, contentType: mime }
    })
    if (!presign.json?.uploadUrl || !presign.json?.fileUrl) throw new Error('Gagal mendapat URL upload dari ScanRead.')

    // 3) upload gambar
    const up = await fetch(presign.json.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime, 'User-Agent': 'Mozilla/5.0' },
        body: buffer,
        signal: AbortSignal.timeout(60000)
    })
    if (!up.ok) throw new Error(`Upload gambar gagal (${up.status}).`)

    // 4) mulai proses scan
    const scan = await req(`${SCANREAD}/api/scan`, {
        method: 'POST', headers: authz, cookie,
        body: { fileUrl: presign.json.fileUrl, fileName: name, fileType: mime, pageCount: 1, targetLanguage: 'auto', outputFormat: 'markdown' }
    })
    if (!scan.json?.taskId) throw new Error('Gagal memulai proses scan.')

    // 5) tunggu hasil
    const start = Date.now()
    while (Date.now() - start < MAX_TIMEOUT) {
        const st = await req(`${SCANREAD}/api/scan/${scan.json.taskId}`, { headers: authz, cookie })
        if (st.json?.status === 'done' && st.json?.fileResult) {
            const out = await fetch(st.json.fileResult, { signal: AbortSignal.timeout(60000) })
            if (!out.ok) throw new Error(`Gagal mengambil hasil (${out.status}).`)
            return (await out.text()).trim()
        }
        if (st.json?.status === 'failed' || st.json?.errorMessage) throw new Error(`OCR gagal: ${st.json.errorMessage || 'tidak diketahui'}`)
        await sleep(POLL_INTERVAL)
    }
    throw new Error('Waktu habis, proses OCR belum selesai.')
}

let handler = async (m, { text, prefix, command, reply }) => {
    try {
        const img = await getImage(m, text)
        if (!img) {
            return reply(`Kirim atau reply *gambar* dengan caption ${prefix || '.'}${command}\nAtau pakai link: ${prefix || '.'}${command} https://contoh.com/gambar.jpg`)
        }
        if (img.buffer.length > MAX_SIZE) return reply('Gambar terlalu besar (maks 10 MB).')

        await reply('⏳ Membaca teks dari gambar, tunggu sebentar...')
        const result = await scanImage(img)
        if (!result) return reply('Tidak ada teks yang terbaca di gambar itu.')

        return reply(`*IMG TO TEKS*\n\n${result.length > 60000 ? result.slice(0, 60000) + '\n\n_...dipotong_' : result}`)
    } catch (e) {
        return reply(`[ ! ] ${e.message || 'Terjadi kesalahan.'}`)
    }
}

handler.command = ['imgtoteks']
handler.help = ['imgtoteks']
handler.tags = ['convert']
handler.limit = true

export default handler
