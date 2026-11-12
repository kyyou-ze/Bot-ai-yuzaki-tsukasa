// ───────── tovideo ─────────
// Dipecah dari plugins/sticker/sticker.js (dulu digabung dengan fitur lain dalam satu file)

import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'
import { webp2mp4, ffmpeg } from '../../lib/services/scraper.js'

const _tovideo = (() => {
let handler = async (m, { conn, usedPrefix, command }) => {
    if (!m.quoted) throw `Balas stiker/audio yang ingin diubah menjadi video dengan perintah ${usedPrefix + command}`
    let mime = m.quoted.mimetype || ''
    if (!/webp|audio/.test(mime)) throw `Balas stiker/audio yang ingin diubah menjadi video dengan perintah ${usedPrefix + command}`
    let media = await m.quoted.download()
    let out = Buffer.alloc(0)
    if (/webp/.test(mime)) {
        out = await webp2mp4(media)
    } else if (/audio/.test(mime)) {
        out = await ffmpeg(media, [
            '-filter_complex', 'color',
            '-pix_fmt', 'yuv420p',
            '-crf', '51',
            '-c:a', 'copy',
            '-shortest'
        ], 'mp3', 'mp4')
    }
    await conn.sendFile(m.chat, out, 'out.mp4', '*DONE*', m, 0, { thumbnail: out })
}

handler.help = ['tovideo']
handler.tags = ['sticker']

handler.command = ['tovideo']
handler.register = true
handler.limit = 2

const __plugin = wrapClassic(handler)

  return __plugin
})()

_tovideo.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
export default oneCommand(_tovideo, 'tovideo')
