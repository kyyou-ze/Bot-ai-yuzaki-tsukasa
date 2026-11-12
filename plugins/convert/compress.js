import { pickImage } from '../../lib/core/file.js'
import { compressImageSmall } from '../../lib/engine/plugins.js'

let handler = async (m, { sock, reply, prefix, command }) => {
    const image = pickImage(m)
    if (!image) return reply(`Reply atau kirim gambar dengan caption ${prefix}${command}.`)

    try {
        const media = await image.download()
        const result = await compressImageSmall(media)

        await sock.sendMessage(m.chat, {
            image: result,
            caption: `Compressed\nBefore: ${(media.length / 1024).toFixed(1)} KB\nAfter: ${(result.length / 1024).toFixed(1)} KB`
        }, { quoted: m })
    } catch (e) {
        console.error(e)
        reply('❌ Gagal mengompres gambar.')
    }
}

handler.command = ['compress']
handler.help = ['compress']
handler.tags = ['convert']

handler.limit = true

export default handler
