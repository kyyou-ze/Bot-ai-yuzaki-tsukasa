/**
 * Kaguya Multi Device — Store
 * .tolak — tolak <id> [alasan]
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, STATUS, normId, expireOrders } from '../../lib/store/shop.js'

// ===== .tolak <id> [alasan] =====
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
    const [idRaw, ...why] = body.split(/\s+/)
    const id = normId(idRaw)
    const order = id && d.orders[id]
    if (!order) return reply(`Format: ${p}tolak <id> [alasan]   contoh: ${p}tolak INV-0001 nominal tidak sesuai`)
    if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa ditolak.`)
    order.status = 'rejected'
    order.reason = why.join(' ').trim()
    saveDB(global.db)
    await sendBtn(sock, order.buyer, {
        text: `❌ *ORDER DITOLAK*\n\n🧾 ${order.id}\n🛍️ ${order.name}\n${order.reason ? `📝 Alasan: ${order.reason}\n` : ''}\nKalau merasa sudah membayar, hubungi owner dengan menyertakan bukti bayar.`,
        buttons: [katalogBtn, riwayatBtn]
    })
    return btn(`❌ ${id} ditolak dan pembeli diberi tahu.`, [quick('📦 Pesanan', S('pesanan')), quick('📊 Rekap', S('rekap'))])
}

handler.command = ['tolak']
handler.tags = ['store']
handler.help = ['tolak']
handler.owner = true

export default handler
