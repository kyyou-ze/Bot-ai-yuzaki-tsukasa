/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — ubah deskripsi saluran
 *
 * Contoh:  .chdesc Deskripsi baru   |   .chdesc <link> Deskripsi baru (saluran lain)
 */

import { need, pickTarget, assertCanPost, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    const p = prefix || '.'
    try {
        const t = await pickTarget(sock, String(text || ''), p)
        assertCanPost(t)
        need(sock, 'newsletterUpdateDescription')
        if (!t.rest) return reply(`Isi deskripsi baru.\nContoh: ${p}chdesc Pembaruan fitur bot`)
        if (t.rest.length > 500) return reply('Deskripsi maksimal 500 karakter.')
        await sock.newsletterUpdateDescription(t.id, t.rest)
        return reply(`✅ Deskripsi saluran *${t.name}* diperbarui.`)
    } catch (err) {
        console.log('[CH] chdesc:', err.message)
        return reply(`❌ ${explain(err)}`)
    }
}

handler.command = ['chdesc']
handler.help = ['chdesc <teks>']
handler.tags = ['channel']
handler.owner = true

export default handler
