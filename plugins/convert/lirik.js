/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Search — Lyrics Finder (lirik lagu dari lrclib.net)
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  .lyrics bunga maaf
 */

import axios from 'axios'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

const MAX_LYRICS = 3500 // supaya muat di satu pesan (Telegram maks 4096)

async function lyrics(title) {
    if (!title) throw new Error('Judul lagu diperlukan!')
    const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`, {
        headers: {
            referer: `https://lrclib.net/search/${encodeURIComponent(title)}`,
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        },
        timeout: 30000
    })
    return data
}

let handler = async (m, { text, usedPrefix }) => {
    const q = (text || '').trim()
    if (!q) return m.reply(`Masukkan judul lagu!\n\nContoh: ${usedPrefix || '.'}lyrics bunga maaf`)

    try {
        const res = await lyrics(q)
        if (!Array.isArray(res) || !res.length) return m.reply('❌ Lirik tidak ditemukan!')

        // utamakan hasil yang punya lirik
        const song = res.find(s => s.plainLyrics) || res[0]

        let lirik = song.plainLyrics || 'Tidak ada lirik tersedia.'
        if (lirik.length > MAX_LYRICS) lirik = lirik.slice(0, MAX_LYRICS).trimEnd() + '\n\n...(lirik dipotong)'

        return m.reply(
            `🎵 *Lyrics Finder*\n\n` +
            `*Judul:* ${song.trackName || '-'}\n` +
            `*Artis:* ${song.artistName || '-'}\n` +
            `*Album:* ${song.albumName || '-'}\n\n` +
            `📑 *Lirik:*\n${lirik}`
        )
    } catch (e) {
        return m.reply(`❌ Error: ${e.message}`)
    }
}

handler.help = ['lyrics <judul>']
handler.tags = ['search']
handler.command = ['lyrics', 'lirik']
handler.limit = true

const __plugin = wrapClassic(handler)
__plugin.tags = ['search']

// satu command = nama file; `lirik` tetap bisa dipakai sebagai alias
export default oneCommand(__plugin, 'lyrics', { subs: true })
