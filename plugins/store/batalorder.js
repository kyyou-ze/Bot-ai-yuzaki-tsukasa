/**
 * Kaguya Multi Device — Store
 * .batalorder — batalorder
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, expireOrders } from '../../lib/store/shop.js'

// ===== .batalorder =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    // id tombol = command lengkap (tiap command punya file sendiri)
    const S = (sub, args = '') => `${p}${sub}${args ? ` ${args}` : ''}`
    const btn = (text, buttons, o = {}) => sendBtn(sock, m.chat, { text, buttons, ...o }, m)
    const katalogBtn = quick('🛍 Katalog', S('produk'))
    const riwayatBtn = quick('🧾 Riwayat', S('riwayat'))
    const cut = (str, n) => (String(str).length > n ? `${String(str).slice(0, n - 1)}…` : String(str))
    autoSeed() // isi katalog contoh + terapkan global.storeProducts (config.js)
    const d = getDB()
    expireOrders()
    const buyer = await toPN(sock, m.sender)
    const order = Object.values(d.orders).find(o => o.buyer === buyer && o.status === 'pending')
    if (!order) {
        const waiting = Object.values(d.orders).find(o => o.buyer === buyer && o.status === 'waiting')
        return reply(waiting ? `Order ${waiting.id} sudah kamu kirimi bukti bayar, hubungi owner kalau mau membatalkan.` : 'Tidak ada order yang bisa dibatalkan.')
    }
    order.status = 'cancelled'
    saveDB(global.db)
    return btn(`🚫 Order ${order.id} dibatalkan.`, [katalogBtn])
}

handler.command = ['batalorder']
handler.tags = ['store']
handler.help = ['batalorder']

export default handler
