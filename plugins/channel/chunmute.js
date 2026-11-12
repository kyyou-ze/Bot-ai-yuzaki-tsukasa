/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — buka bisu saluran
 *
 * Contoh:  .chunmute <link>
 */

import { need, pickTarget, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    try {
        need(sock, 'newsletterUnmute')
        const t = await pickTarget(sock, text, prefix)
        await sock.newsletterUnmute(t.id)
        return reply(`✅ Bisu saluran dibuka: *${t.name}*`)
    } catch (err) {
        console.log('[CH] chunmute:', err.message)
        return reply(`❌ ${explain(err)}${/Belum ada saluran/.test(String(err.message)) ? '' : `\nContoh: ${prefix || '.'}chunmute <link saluran>`}`)
    }
}

handler.command = ['chunmute']
handler.help = ['chunmute <link>']
handler.tags = ['channel']
handler.owner = true

export default handler
