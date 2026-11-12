import { pickMedia } from '../../lib/core/file.js'
import { identifyAudio } from '../../lib/services/scraper.js'

let handler = async (m, { reply, prefix, command }) => {
    const media = pickMedia(m)
    if (!media || !/audio|video/.test(media.mime)) {
        return reply(`Kirim atau reply audio/video dengan perintah *${prefix}${command}*`)
    }

    try {
        await reply('🔍 Mendeteksi musik...')
        const track = await identifyAudio(await media.download())
        if (!track) return reply('❌ Lagu tidak ditemukan / tidak terdeteksi.')

        const out = `— *SONG IDENTIFIED* —\n\n` +
            `🎵 *Judul:* ${track.title || '-'}\n` +
            `👤 *Artis:* ${track.artist || '-'}\n` +
            `💿 *Album:* ${track.album || '-'}\n` +
            `📅 *Rilis:* ${track.release_date || '-'}\n` +
            (track.spotify?.external_urls?.spotify ? `\n🟢 Spotify: ${track.spotify.external_urls.spotify}` : '')

        await reply(out.trim())
    } catch (e) {
        reply(`❌ Error: ${e.message}`)
    }
}

handler.command = ['whatmusic']
handler.help = ['whatmusic']
handler.tags = ['tools']

handler.limit = true

export default handler
