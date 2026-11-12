// Ubah media menu lewat command, otomatis tersimpan ke config.js dan langsung aktif (tanpa restart).
//
//   .setmedia                         -> lihat semua media saat ini
//   .setaudiomenu <url>               -> global.audioMenu   (atau kirim/reply audio)
//   .setthumb <utama|menu|store> <url> -> global.thumb.*    (atau kirim/reply gambar + caption)
//   .setthumbutama / .setthumbmenu / .setthumbstore <url>  (kirim/reply gambar)
//   .setvideomenu <url>               -> global.thumb.videoMenu (atau kirim/reply video)
//   .setdocmenu <url>                 -> global.thumb.docMenu   (atau kirim/reply dokumen/PDF)
//
// Kalau yang dikirim file (bukan link), file diunggah dulu ke cdn.zass.in lalu link-nya disimpan.
import axios from 'axios'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'
import { updateConfigValue, applyConfigChanges } from '../../lib/core/file.js'
import { isType, mediaNode } from '../../lib/core/system.js'

const UPLOAD_URL = 'https://cdn.zass.in/upload'

// command -> target config. kind = jenis media yang diterima
const TARGETS = {
    setaudiomenu: { key: 'audioMenu', label: 'Audio menu', kind: 'audio' },
    setthumbutama: { key: 'thumb.utama', label: 'Thumbnail utama', kind: 'image' },
    setthumbmenu: { key: 'thumb.menu', label: 'Thumbnail menu', kind: 'image' },
    setthumbstore: { key: 'thumb.store', label: 'Thumbnail store', kind: 'image' },
    setvideomenu: { key: 'thumb.videoMenu', label: 'Video menu', kind: 'video' },
    setdocmenu: { key: 'thumb.docMenu', label: 'Dokumen menu', kind: 'document' }
}

const THUMB_ALIAS = { utama: 'setthumbutama', menu: 'setthumbmenu', store: 'setthumbstore', toko: 'setthumbstore' }

const MSG_TYPE = { audio: 'audioMessage', image: 'imageMessage', video: 'videoMessage', document: 'documentMessage' }
const KIND_LABEL = { audio: 'audio', image: 'gambar', video: 'video', document: 'dokumen' }

const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim())

const getPath = (path) => path.split('.').reduce((o, k) => o?.[k], global)

function setPath(path, value) {
    const parts = path.split('.')
    const last = parts.pop()
    let obj = global
    for (const p of parts) {
        if (!obj[p] || typeof obj[p] !== 'object') obj[p] = {}
        obj = obj[p]
    }
    obj[last] = value
}

// simpan ke config.js: kunci biasa -> value, kunci bertingkat (thumb.menu) -> nested
function saveConfig(key, value) {
    if (!key.includes('.')) return updateConfigValue(key, value)
    return applyConfigChanges([{ op: 'nested', path: key, value }]).ok
}

async function zassUpload(buffer, mime) {
    const detected = await fileTypeFromBuffer(buffer).catch(() => null)
    const ext = detected?.ext || 'bin'
    const form = new FormData()
    form.append('file', buffer, { filename: `file_${Date.now()}.${ext}`, contentType: mime || detected?.mime || 'application/octet-stream' })
    const { data } = await axios.post(UPLOAD_URL, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    })
    if (!data?.success || !data?.url) throw new Error(data?.message || 'Upload gagal')
    return data.url
}

function listCurrent() {
    const rows = Object.entries(TARGETS).map(([cmd, t]) => `• *${t.label}*\n  ${getPath(t.key) || '(kosong)'}`)
    return `🖼️ *MEDIA MENU SAAT INI*\n\n${rows.join('\n\n')}`
}

let handler = async (m, { sock, text = '', command, prefix, reply, example }) => {
    const p = prefix || '.'
    const raw = String(text).trim()

    if (command === 'setmedia' && !raw) {
        return reply(
            `${listCurrent()}\n\n*Cara ubah:*\n` +
            `• ${p}setaudiomenu <url>\n` +
            `• ${p}setthumb <utama|menu|store> <url>\n` +
            `• ${p}setvideomenu <url>\n` +
            `• ${p}setdocmenu <url>\n\n` +
            `Bisa juga kirim / reply filenya langsung dengan command tersebut, nanti diunggah otomatis.`
        )
    }

    // .setthumb <jenis> <url>  /  .setmedia thumb <jenis> <url>  -> petakan ke command spesifik
    let cmd = command
    let arg = raw
    if (command === 'setmedia') {
        const [first, ...rest] = raw.split(/\s+/)
        const f = String(first || '').toLowerCase()
        const map = { audio: 'setaudiomenu', video: 'setvideomenu', doc: 'setdocmenu', dokumen: 'setdocmenu', thumb: 'setthumb' }
        cmd = map[f] || (THUMB_ALIAS[f] ? THUMB_ALIAS[f] : null)
        if (!cmd) return reply(`Jenis tidak dikenal: *${first}*.\n\nPilih: audio, thumb, video, doc.`)
        arg = rest.join(' ')
    }
    if (cmd === 'setthumb') {
        const [jenis, ...rest] = arg.split(/\s+/)
        const target = THUMB_ALIAS[String(jenis || '').toLowerCase()]
        if (!target) return example('utama https://link-gambar.jpg   (jenis: utama | menu | store)')
        cmd = target
        arg = rest.join(' ')
    }

    const t = TARGETS[cmd]
    if (!t) return

    // sumber: link di teks, atau media yang dikirim / di-reply
    let url = ''
    if (isUrl(arg)) {
        url = arg
    } else {
        const type = MSG_TYPE[t.kind]
        // dokumen: terima juga kalau pengirim memakai tipe lain yang valid (mis. PDF sebagai dokumen)
        if (!isType(m, type)) {
            return reply(`Kirim *link* atau ${KIND_LABEL[t.kind]} (kirim / reply) dengan command *${p}${cmd}*.\n\nSaat ini:\n${getPath(t.key) || '(kosong)'}`)
        }
        const media = mediaNode(m, type)
        const loading = await reply(global.mess?.wait || 'Sedang mengunggah...')
        try {
            const buffer = await media.download()
            if (!buffer?.length) throw new Error('Media kosong / gagal diunduh')
            url = await zassUpload(buffer, media.node?.mimetype)
        } catch (e) {
            console.error(`[${cmd}] upload gagal:`, e.stack || e)
            return sock.sendMessage(m.chat, { text: `Gagal mengunggah: ${e.message}`, edit: loading?.key }).catch(() => reply(`Gagal mengunggah: ${e.message}`))
        }
    }

    const before = getPath(t.key)
    setPath(t.key, url)          // langsung aktif di memori
    const saved = saveConfig(t.key, url)   // permanen di config.js

    return reply(
        `✅ *${t.label}* diubah.\n\n` +
        `Baru : ${url}\n` +
        (before ? `Lama : ${before}\n` : '') +
        `\n${saved ? 'Tersimpan ke config.js, langsung aktif tanpa restart.' : '⚠️ Aktif sekarang, tapi gagal menulis ke config.js (hilang setelah restart). Cek format config.js.'}`
    )
}

handler.help = ['setmedia', 'setaudiomenu <url>', 'setthumb <utama|menu|store> <url>', 'setvideomenu <url>', 'setdocmenu <url>']
handler.tags = ['owner']
handler.command = ['setmedia', 'setaudiomenu', 'setthumb', 'setthumbutama', 'setthumbmenu', 'setthumbstore', 'setvideomenu', 'setdocmenu']
handler.owner = true

export default handler
