/**
 * Kaguya Multi Device — Store
 * .riwayatorder — riwayatorder — semua pembelian: toko, sewa, donasi
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { storeReply, cfg, STATUS, rp, quick, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn, entriesOf } from '../../lib/store/order.js'

// ===== .riwayatorder — semua pembelian: toko, sewa, donasi =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    const buyer = await toPN(sock, m.sender)
    const mine = entriesOf(buyer).sort((a, b) => b.o.createdAt - a.o.createdAt).slice(0, 10)
    return send({
        text: mine.length
            ? `🍧 *Riwayat kamu*\n\n${mine.map(e => `${e.emoji} *${e.o.id}* — ${e.label}\n   ${rp(e.o.total)}  |  ${STATUS[e.o.status] || e.o.status}`).join('\n\n')}`
            : 'Kamu belum punya riwayat pembelian.',
        buttons: [quick('Katalog Produk', `${p}order`), quick('🧾 Cek Order', `${p}cekorder`), homeBtn(p)]
    })
}

handler.command = ['riwayatorder']
handler.tags = ['store']
handler.help = ['riwayatorder']

export default handler
