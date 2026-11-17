import { getMeta, memberId } from '../../lib/platform/wa.js'

const MEDIA = {
    imageMessage: 'image',
    videoMessage: 'video',
    audioMessage: 'audio',
    stickerMessage: 'sticker',
    documentMessage: 'document',
}

/** Unduh media quote; balikan null kalau media tidak bisa diunduh. */
async function safeDownload(quoted) {
    if (!quoted || typeof quoted.download !== 'function') return null
    try {
        const buffer = await quoted.download()
        return Buffer.isBuffer(buffer) && buffer.length ? buffer : null
    } catch {
        return null
    }
}

let handler = async (m, { sock, text, command, jid, reply }) => {
    const meta = await getMeta(sock, jid, true)
    const mentions = meta.participants.map(p => p.id)

    if (command === 'tagall') {
        const list = mentions.map(id => `-▢ @${memberId(id)}`).join('\n')
        const note = text ? `\n${text}\n` : ''
        return reply(`📢 *TAG ALL* (${mentions.length})${note}\n${list}`, { mentions })
    }

    // hidetag: pesan terlihat biasa, semua member tetap dapat notifikasi
    const q = m.quoted
    const kind = MEDIA[q?.mtype]
    if (kind) {
        const buffer = await safeDownload(q)
        if (buffer) {
            const payload = { [kind]: buffer, mentions }
            if (kind === 'image' || kind === 'video' || kind === 'document') {
                payload.caption = text || q.text || ''
            }
            if (kind === 'audio') {
                payload.mimetype = q.msg?.mimetype || q.raw?.mimetype || 'audio/ogg; codecs=opus'
                payload.ptt = Boolean(q.msg?.ptt || q.raw?.ptt)
            }
            if (kind === 'document') {
                payload.mimetype = q.msg?.mimetype || q.raw?.mimetype || 'application/octet-stream'
                payload.fileName = q.msg?.fileName || q.raw?.fileName || 'file'
            }
            return sock.sendMessage(jid, payload)
        }
        // Media tidak bisa diunduh (mis. foto sekali lihat yang sudah kedaluwarsa).
        // Jangan gagalkan plugin: sebarkan teksnya saja kalau ada.
    }

    const message = text || q?.text
    if (!message) {
        return reply(
            'Isi pesannya dulu, atau reply pesan yang mau disebar.\n' +
            'Kalau media yang di-reply (mis. foto sekali lihat) tidak bisa diunduh, ' +
            'kirim teksnya juga: .hidetag <pesan>'
        )
    }
    return sock.sendMessage(jid, { text: message, mentions })
}

handler.command = ['tag', 'tagall', 'hidetag', 'h']
handler.as = 'tagall'
handler.tags = ['group']
handler.admin = true
handler.owner = true
handler.group = true

export default handler
