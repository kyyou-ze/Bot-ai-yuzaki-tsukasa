/**
 * Kaguya Multi Device — Store
 * .editproduk — editproduk kode|field|nilai
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { MIN_PRICE, getDB, rp, expireOrders } from '../../lib/store/shop.js'

// ===== .editproduk kode|field|nilai =====
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
    const [codeRaw, fieldRaw, ...rest] = body.split('|').map(s => s.trim())
    const pr = d.products[String(codeRaw || '').toLowerCase()]
    const value = rest.join('|').trim()
    const field = String(fieldRaw || '').toLowerCase()
    if (!pr || !['nama', 'harga', 'deskripsi'].includes(field) || !value) {
        return reply(`Format: ${p}editproduk kode|nama/harga/deskripsi|nilai baru\nContoh: ${p}editproduk netflix|harga|27000`)
    }
    if (field === 'nama') pr.name = value
    if (field === 'deskripsi') pr.desc = value
    if (field === 'harga') {
        const price = Number(value.replace(/[.,\s]/g, ''))
        if (!Number.isInteger(price) || price < MIN_PRICE) return reply(`Harga tidak valid (minimal ${rp(MIN_PRICE)}).`)
        pr.price = price
    }
    saveDB(global.db)
    return reply(`✅ ${pr.code}: ${field} diubah.`)
}

handler.command = ['editproduk']
handler.tags = ['store']
handler.help = ['editproduk']
handler.owner = true

export default handler
