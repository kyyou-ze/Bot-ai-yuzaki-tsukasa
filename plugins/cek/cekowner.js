import { isOwnerNumber } from '../../lib/core/system.js'
import { isPremiumUser } from '../../lib/core/data.js'

// .cekowner [@user / reply / nomor]  → cek role (owner / premium / free)
let handler = async (m, { sock, text, reply }) => {
    let jid = m.quoted?.sender || m.mentionedJid?.[0]
    if (!jid) {
        const num = String(text || '').replace(/[^0-9]/g, '')
        jid = num ? `${num.startsWith('0') ? '62' + num.slice(1) : num}@s.whatsapp.net` : m.sender
    }
    const number = jid.split('@')[0]
    const isOwner = await isOwnerNumber(sock, number).catch(() => false)
    const isPremium = isOwner || await isPremiumUser(sock, m, jid).catch(() => false)

    const roles = []
    if (isOwner) roles.push('👑 Owner')
    if (isPremium && !isOwner) roles.push('💎 Premium')
    if (!roles.length) roles.push('👤 Free User')

    await sock.sendMessage(m.chat, {
        text: `📋 *CEK USER INFO*\n\n👤 User: @${number}\n🏷️ Role: *${roles.join(' • ')}*`,
        mentions: [jid]
    }, { quoted: m })
}

handler.command = ['cekowner', 'ownerinfo']
handler.help = ['cekowner [@user]']
handler.tags = ['cek']
handler.premium = true

export default handler
