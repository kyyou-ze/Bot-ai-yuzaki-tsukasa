import { sendPremiumSticker } from '../../lib/engine/plugins.js'

// Kirim ulang sticker dengan atribut avatar / AI / premium
let handler = async (m, { sock, jid, reply }) => {
    const q = m.quoted
    if (q?.mtype !== 'stickerMessage') return reply('Reply sticker WEBP biasa dulu.')
    if (q.mimetype !== 'image/webp') return reply('Ini bukan sticker WEBP biasa. Untuk lottie/application/was beda cara.')

    try {
        const buffer = await q.download()
        await sendPremiumSticker(sock, jid, buffer, { isAnimated: q.isAnimated, quoted: m })
    } catch (e) {
        console.error('[SPREM]', e)
        reply('Gagal inject atribut sticker. Cek console.')
    }
}

handler.command = ['sprem']
handler.help = ['sprem']
handler.tags = ['sticker']

export default handler
