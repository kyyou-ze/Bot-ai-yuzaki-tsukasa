/**
 * Kaguya Multi Device — Store
 * .batalbayar — batalbayar — batalkan order yang belum dibayar (toko, sewa, donasi)
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, cfg, quick, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn, entriesOf } from '../../lib/store/order.js'

// ===== .batalbayar — batalkan order yang belum dibayar (toko, sewa, donasi) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    const buyer = await toPN(sock, m.sender)
    const pending = entriesOf(buyer).filter(e => e.o.gw && e.o.status === 'pending')
    if (!pending.length) return send({ text: 'Tidak ada order otomatis yang bisa dibatalkan.', buttons: [homeBtn(p)] })
    for (const e of pending) e.o.status = 'cancelled'
    saveDB(global.db)
    return send({
        text: `🚫 Dibatalkan: ${pending.map(e => `${e.emoji} *${e.o.id}*`).join(', ')}\nJangan bayar QR yang sudah dikirim ya.`,
        buttons: [quick('Katalog Produk', `${p}order`), homeBtn(p)]
    })
}

handler.command = ['batalbayar']
handler.tags = ['store']
handler.help = ['batalbayar']

export default handler
