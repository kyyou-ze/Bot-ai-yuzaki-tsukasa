import { getMeta, memberId } from '../../lib/platform/wa.js'

const MEDIA = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker' }

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
        const buffer = await q.download()
        const payload = { [kind]: buffer, mentions }
        if (kind === 'image' || kind === 'video') payload.caption = text || q.text || ''
        return sock.sendMessage(jid, payload)
    }

    const message = text || q?.text
    if (!message) return reply('Isi pesannya dulu, atau reply pesan yang mau disebar.')
    return sock.sendMessage(jid, { text: message, mentions })
}

handler.command = ['tag', 'tagall', 'hidetag', 'h']
handler.as = 'tagall'
handler.tags = ['group']
handler.admin = true
handler.owner = true
handler.group = true

export default handler
