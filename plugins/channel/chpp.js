/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — ubah foto profil saluran
 *
 * Contoh:  .chpp (reply foto)   |   .chpp <link> (reply foto, saluran lain)
 */

import { pickImage } from '../../lib/core/file.js'
import { need, pickTarget, assertCanPost, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    const p = prefix || '.'
    try {
        const t = await pickTarget(sock, String(text || ''), p)
        assertCanPost(t)
        need(sock, 'newsletterUpdatePicture')
        const img = pickImage(m)
        if (!img) return reply(`Kirim atau reply sebuah gambar dengan ${p}chpp.`)
        const buffer = await img.download()
        if (!Buffer.isBuffer(buffer)) return reply('Gagal mengunduh gambar. Coba kirim ulang.')
        await sock.newsletterUpdatePicture(t.id, buffer)
        return reply(`✅ Foto saluran *${t.name}* diperbarui.`)
    } catch (err) {
        console.log('[CH] chpp:', err.message)
        return reply(`❌ ${explain(err)}`)
    }
}

handler.command = ['chpp']
handler.help = ['chpp (reply foto)']
handler.tags = ['channel']
handler.owner = true

export default handler
