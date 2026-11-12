// Audio / video -> voice note (opus) dengan waveform asli
import { reactTo } from '../../lib/core/file.js'
import { buildVoiceNote } from '../../lib/engine/plugins.js'

let handler = async (m, { sock, reply }) => {
    const q = m.quoted
    if (!q) return reply('Reply MP3 / MP4 / audio dengan perintah ini.')

    const mime = q.mimetype || ''
    if (!mime.startsWith('audio/') && !mime.startsWith('video/')) {
        return reply('Media yang direply harus berupa audio atau video.')
    }

    try {
        await reactTo(sock, m, '⏳')

        const media = await q.download()
        if (!media?.length) throw new Error('Gagal download media.')

        const { audio, waveform } = await buildVoiceNote(media, mime)

        await sock.sendMessage(m.chat, {
            audio,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            waveform
        }, { quoted: m })

        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[VOICE WAVEFORM]', e)
        await reactTo(sock, m, '❌')
        reply(`Gagal membuat voice note:\n${e.message}`)
    }
}

handler.command = ['voice']
handler.help = ['voice']
handler.tags = ['convert']

export default handler
