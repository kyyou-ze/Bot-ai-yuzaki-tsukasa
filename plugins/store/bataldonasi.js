/**
 * Kaguya Multi Device — Store
 * .bataldonasi — bataldonasi
 * Satu file = satu command. Helper bersama: lib/store/donate.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, cfg, quick, sendBtn, merchantDB } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { homeBtn, donations } from '../../lib/store/donate.js'

// ===== .bataldonasi =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const db = merchantDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    const buyer = await toPN(sock, m.sender)
    const don = donations().find(d => d.buyer === buyer && d.status === 'pending')
    if (!don) return send({ text: 'Tidak ada donasi yang bisa dibatalkan.', buttons: [quick('💝 Donasi', `${p}donasi`)] })
    don.status = 'cancelled'
    saveDB(global.db)
    return send({ text: `🚫 Donasi *${don.id}* dibatalkan.\nJangan bayar QR yang sudah dikirim ya.`, buttons: [quick('💝 Donasi', `${p}donasi`), homeBtn(p)] })
}

handler.command = ['bataldonasi']
handler.tags = ['store']
handler.help = ['bataldonasi']

export default handler
