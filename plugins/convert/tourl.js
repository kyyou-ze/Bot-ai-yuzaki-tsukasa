import axios from 'axios'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'
import { isType, mediaNode } from '../../lib/core/system.js'

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']

// ───────── Upload ke https://cdn.zass.in (sama seperti bot nero) ─────────
const UPLOAD_URL = 'https://cdn.zass.in/upload'

async function zassUpload(buffer, fileName, knownMime) {
    const detected = await fileTypeFromBuffer(buffer).catch(() => null)
    const ext = detected?.ext || fileName?.split('.').pop()?.toLowerCase() || 'bin'
    const mime = knownMime || detected?.mime || 'application/octet-stream'
    const name = fileName || `file_${Date.now()}.${ext}`

    const form = new FormData()
    form.append('file', buffer, { filename: name, contentType: mime })

    const { data } = await axios.post(UPLOAD_URL, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    })

    if (!data?.success || !data?.url) throw new Error(data?.message || 'Upload gagal')
    return { url: data.url, fileName: data.fileName || name, size: data.size }
}

// ───────── plugin ─────────
let handler = async (m, { sock, jid, reply, example }) => {
    const type = MEDIA_TYPES.find(t => isType(m, t))
    if (!type) return example('(kirim/reply gambar, video, audio, sticker, atau dokumen)')

    const media = mediaNode(m, type)
    const loading = await reply(global.mess?.wait || 'Sedang mengunggah...')

    let step = 'download'
    try {
        const buffer = await media.download()
        if (!buffer?.length) throw new Error('Media kosong / gagal diunduh')

        step = 'upload'
        const result = await zassUpload(buffer, undefined, media.node?.mimetype)
        const sizeKb = ((result.size || buffer.length) / 1024).toFixed(2)

        step = 'kirim'
        const info = `BERHASIL UPLOAD\n\nURL: ${result.url}\nNama File: ${result.fileName}\nUkuran: ${sizeKb} KB`

        try {
            // pesan tombol tidak bisa di-edit dari pesan teks, jadi hapus pesan loading lalu kirim baru
            await sock.sendMessage(jid, { delete: loading.key }).catch(() => null)
            await sock.sendButtons(jid, {
                text: info,
                footer: 'Klik tombol di bawah',
                buttons: [
                    { type: 'copy', text: 'Salin URL', code: result.url },
                    { type: 'url', text: 'Buka URL', url: result.url }
                ]
            }, { quoted: m })
        } catch (btnErr) {
            console.error('[tourl] tombol gagal, kirim teks biasa:', btnErr.stack || btnErr)
            await reply(info)
        }
    } catch (e) {
        console.error(`[tourl] gagal di langkah "${step}" (tipe: ${type}):`, e.stack || e)
        await sock.sendMessage(jid, { text: `Gagal (${step}): ${e.message}`, edit: loading.key })
    }
}

handler.command = ['tourl']
handler.tags = ['convert']

export default handler
