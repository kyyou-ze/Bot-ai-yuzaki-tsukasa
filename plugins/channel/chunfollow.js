/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — berhenti ikuti saluran
 *
 * Contoh:  .chunfollow <link>
 */

import { need, pickTarget, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    try {
        need(sock, 'newsletterUnfollow')
        const t = await pickTarget(sock, text, prefix)
        await sock.newsletterUnfollow(t.id)
        return reply(`✅ Berhenti mengikuti saluran: *${t.name}*`)
    } catch (err) {
        console.log('[CH] chunfollow:', err.message)
        return reply(`❌ ${explain(err)}${/Belum ada saluran/.test(String(err.message)) ? '' : `\nContoh: ${prefix || '.'}chunfollow <link saluran>`}`)
    }
}

handler.command = ['chunfollow']
handler.help = ['chunfollow <link>']
handler.tags = ['channel']
handler.owner = true

export default handler
