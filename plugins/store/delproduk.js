/**
 * Kaguya Multi Device — Store
 * .delproduk — delproduk kode
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, expireOrders, activeOrdersOf } from '../../lib/store/shop.js'

// ===== .delproduk kode =====
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
    const code = body.toLowerCase()
    if (!d.products[code]) return reply(`Produk "${body}" tidak ditemukan.`)
    if (activeOrdersOf(code).length) return reply('Masih ada order aktif untuk produk ini. Selesaikan dulu lewat .pesanan.')
    delete d.products[code]
    saveDB(global.db)
    return reply(`🗑️ Produk ${code} dihapus.`)
}

handler.command = ['delproduk']
handler.tags = ['store']
handler.help = ['delproduk']
handler.owner = true

export default handler
