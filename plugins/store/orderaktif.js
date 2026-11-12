/**
 * Kaguya Multi Device — Store
 * .orderaktif — orderaktif (owner) — semua yang menunggu pembayaran
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { storeReply, cfg, ACTIVE, STATUS, rp, tagOf, quick, sendBtn, storeDB, merchantDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn } from '../../lib/store/order.js'

// ===== .orderaktif (owner) — semua yang menunggu pembayaran =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    const all = [
        ...Object.values(d.orders).map(o => ({ ...o, label: o.name })),
        ...Object.values(global.db?.sewa?.orders || {}).map(o => ({ ...o, label: `Sewa ${o.planName}` })),
        ...Object.values(merchantDB().donations).map(o => ({ ...o, label: 'Donasi' }))
    ].filter(o => ACTIVE.has(o.status)).sort((a, b) => a.createdAt - b.createdAt)
    const lines = all.map(o => `🧾 *${o.id}* — ${o.label}\n   ${rp(o.total)}  |  ${STATUS[o.status]}  |  @${tagOf(o.buyer)}${o.gw ? '  |  ⚡auto' : ''}`)
    return send({
        text: all.length ? `*Menunggu pembayaran (${all.length})*\n\n${lines.join('\n\n')}` : 'Tidak ada yang menunggu.',
        mentions: all.map(o => o.buyer),
        buttons: [quick('🔄 Refresh', `${p}orderaktif`), quick('🩺 Cek Gateway', `${p}merchantcek`), homeBtn(p)]
    })
}

handler.command = ['orderaktif']
handler.tags = ['store']
handler.help = ['orderaktif']

export default handler
