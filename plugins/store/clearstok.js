/**
 * Kaguya Multi Device — Store
 * .clearstok — clearstok kode
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, expireOrders } from '../../lib/store/shop.js'

// ===== .clearstok kode =====
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
    const pr = d.products[body.toLowerCase()]
    if (!pr) return reply(`Format: ${p}clearstok kode`)
    const n = Array.isArray(pr.stock) ? pr.stock.length : 0
    pr.stock = []
    saveDB(global.db)
    return reply(`🗑️ ${n} item stok ${pr.code} dihapus (produk sekarang habis).`)
}

handler.command = ['clearstok']
handler.tags = ['store']
handler.help = ['clearstok']
handler.owner = true

export default handler
