import { pickMedia } from '../../lib/core/file.js'
import { compressMedia } from '../../lib/engine/plugins.js'

let handler = async (m, { sock, text, reply, prefix, command }) => {
    const media = pickMedia(m)
    if (!media?.mime) return reply(`Reply media + mode:\n\n${prefix}${command} auto|hd|ultra`)

    const mode = (text || 'auto').toLowerCase()

    try {
        const result = await compressMedia(await media.download(), media.mime, mode)
        const caption = `✅ Selesai (Mode: ${mode.toUpperCase()})`

        if (result.type === 'image') {
            await sock.sendMessage(m.chat, { image: result.buffer, caption }, { quoted: m })
        } else {
            await sock.sendMessage(m.chat, { video: result.buffer, mimetype: result.mimetype, fileName: result.fileName, caption }, { quoted: m })
        }
    } catch (e) {
        console.error(e)
        reply('❌ Error: ' + (e.message || e))
    }
}

handler.command = ['compressvid']
handler.help = ['compressvid']
handler.tags = ['convert']

handler.limit = true

export default handler
