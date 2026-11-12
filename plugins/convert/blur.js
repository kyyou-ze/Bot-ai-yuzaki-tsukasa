import { pickMedia, reactTo } from '../../lib/core/file.js'
import { popcatBlur } from '../../lib/services/scraper.js'

let handler = async (m, { sock, reply, prefix, command }) => {
    try {
        await reactTo(sock, m, '🌫️')

        const media = pickMedia(m)
        if (!media || !/image/.test(media.mime)) {
            return reply(`Reply/kirim gambar dengan caption\n\nContoh:\n${prefix}${command}`)
        }

        const url = await popcatBlur(await media.download())
        await sock.sendMessage(m.chat, { image: { url }, caption: '🌫️ Blur done' }, { quoted: m })
    } catch (e) {
        console.error(e)
        reply('❌ Error bang')
    }
}

handler.command = ['blur']
handler.help = ['blur']
handler.tags = ['convert']

handler.limit = true

export default handler
