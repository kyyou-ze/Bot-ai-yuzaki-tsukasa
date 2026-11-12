/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — ambil ID & nama saluran dari link (dengan tombol salin ID)
 *
 * Contoh:  .idch https://whatsapp.com/channel/0029VaXXXXXXXXXX
 *
 * Catatan: command .cekidch sudah dipakai plugins/tools/cekid.js, jadi plugin ini
 * memakai .idch supaya tidak bentrok.
 */

import axios from 'axios'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let handler = async (m, { sock, text, prefix, reply, example }) => {
    const url = String(text || '').trim().split(/\s+/)[0]
    if (!url) return example('https://whatsapp.com/channel/0029VaXXXXXXXXXX')
    const code = url.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i)?.[1]
    if (!code) return reply('⚠️ Link tautan tidak valid!')

    try {
        const res = await sock.newsletterMetadata('invite', code)
        if (!res?.id) return reply('Tidak dapat menemukan ID channel dari link tersebut.')
        const channelId = res.id

        // nama dari metadata; kalau kosong, ambil dari <title> halaman publik
        let channelName = res.thread_metadata?.name?.text || res.name?.text || ''
        if (!channelName) {
            try {
                const { data } = await axios.get(`https://whatsapp.com/channel/${code}`, { headers: { 'User-Agent': UA }, timeout: 15000 })
                const t = String(data).match(/<title>(.*?)<\/title>/i)?.[1]
                if (t) channelName = t.replace(/<\/?[^>]+(>|$)/g, '').split('|')[0].trim()
            } catch {}
        }
        channelName ||= 'WhatsApp Channel'

        const teks = `*• Nama Channel:* ${channelName}\n*• Channel ID:* ${channelId}`
        try {
            return await sock.sendButtons(m.chat, {
                text: teks,
                footer: global.namebot || 'Kaguya MD',
                buttons: [{ type: 'copy', text: 'Salin ID Channel', code: channelId }]
            }, { quoted: m })
        } catch {
            return reply(teks)
        }
    } catch (err) {
        console.error('❌ idch Error:', err)
        return reply('Terjadi kesalahan saat mengambil ID channel!')
    }
}

handler.command = ['idch']
handler.help = ['idch <link channel>']
handler.tags = ['channel']
handler.limit = true

export default handler
