import { pickMedia } from '../../lib/core/file.js'
import { sendPtv } from '../../lib/engine/plugins.js'

// Kirim media yang di-reply sebagai video bulat (PTV)
let handler = async (m, { sock, jid, reply, prefix, command }) => {
    const media = pickMedia(m)
    if (!media || !/webp|image|video|gif|viewOnce/.test(media.mime)) {
        return reply(`Reply Media dengan perintah\n\n${prefix}${command}`)
    }

    try {
        await sendPtv(sock, jid, await media.download(), m)
    } catch (e) {
        console.error('[TOPTV]', e)
        reply('Gagal mengirim video bulat.')
    }
}

handler.command = ['toptv']
handler.help = ['toptv']
handler.tags = ['convert']

export default handler
