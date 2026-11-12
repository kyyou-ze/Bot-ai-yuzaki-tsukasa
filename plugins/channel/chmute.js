/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — bisukan saluran
 *
 * Contoh:  .chmute <link>
 */

import { need, pickTarget, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    try {
        need(sock, 'newsletterMute')
        const t = await pickTarget(sock, text, prefix)
        await sock.newsletterMute(t.id)
        return reply(`✅ Saluran dibisukan: *${t.name}*`)
    } catch (err) {
        console.log('[CH] chmute:', err.message)
        return reply(`❌ ${explain(err)}${/Belum ada saluran/.test(String(err.message)) ? '' : `\nContoh: ${prefix || '.'}chmute <link saluran>`}`)
    }
}

handler.command = ['chmute']
handler.help = ['chmute <link>']
handler.tags = ['channel']
handler.owner = true

export default handler
