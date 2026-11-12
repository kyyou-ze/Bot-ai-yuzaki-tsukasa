/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — ikuti saluran
 *
 * Contoh:  .chfollow <link>
 */

import { need, pickTarget, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    try {
        need(sock, 'newsletterFollow')
        const t = await pickTarget(sock, text, prefix)
        await sock.newsletterFollow(t.id)
        return reply(`✅ Sekarang mengikuti saluran: *${t.name}*`)
    } catch (err) {
        console.log('[CH] chfollow:', err.message)
        return reply(`❌ ${explain(err)}${/Belum ada saluran/.test(String(err.message)) ? '' : `\nContoh: ${prefix || '.'}chfollow <link saluran>`}`)
    }
}

handler.command = ['chfollow']
handler.help = ['chfollow <link>']
handler.tags = ['channel']
handler.owner = true

export default handler
