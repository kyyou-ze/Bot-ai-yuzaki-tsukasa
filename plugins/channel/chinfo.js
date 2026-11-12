/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — info & ID saluran dari link
 *
 * Contoh:  .chinfo https://whatsapp.com/channel/0029VaXXXXXXXXXX   |   .chinfo (pakai saluran bawaan)
 */

import { parseRef, getCurrent, metadata, link, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    const arg = String(text || '').trim().split(/\s+/)[0]
    try {
        let ref = parseRef(arg)
        if (!ref && !arg && getCurrent()) ref = { type: 'jid', jid: getCurrent().id }
        if (!ref) return reply(`Kirim link saluran.\nContoh: ${prefix || '.'}chinfo https://whatsapp.com/channel/0029VaXXXXXXXXXX`)

        const md = await metadata(sock, ref)
        const date = md.created
            ? new Date(md.created * 1000).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })
            : '-'
        const desc = md.desc ? (md.desc.length > 300 ? `${md.desc.slice(0, 299)}…` : md.desc) : ''

        return reply(
            `ℹ️ *INFO SALURAN*\n\n` +
            `📢 *SALURAN*\n` +
            `Nama : ${md.name}${md.verified ? ' ✅' : ''}\n` +
            `Pengikut : ${md.subs.toLocaleString('id-ID')}\n` +
            `Dibuat : ${date}\n` +
            (md.role ? `Peran bot : ${md.role.toLowerCase()}\n` : '') +
            (md.invite ? `Link : ${link(md.invite)}\n` : '') +
            `\n🆔 *ID (JID)*\n${md.id}` +
            (desc ? `\n\n📝 *DESKRIPSI*\n${desc}` : '')
        )
    } catch (err) {
        console.log('[CH] chinfo:', err.message)
        return reply(`❌ ${explain(err)}`)
    }
}

handler.command = ['chinfo']
handler.help = ['chinfo <link saluran>']
handler.tags = ['channel']

export default handler
