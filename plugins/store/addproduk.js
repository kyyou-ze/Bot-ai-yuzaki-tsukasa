/**
 * Kaguya Multi Device — Store
 * .addproduk — addproduk kode|nama|harga|deskripsi
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { MIN_PRICE, getDB, rp, expireOrders } from '../../lib/store/shop.js'

// ===== .addproduk kode|nama|harga|deskripsi =====
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
    const [codeRaw, name, priceRaw, ...descParts] = body.split('|').map(s => s.trim())
    const code = String(codeRaw || '').toLowerCase()
    const price = Number(String(priceRaw || '').replace(/[.,\s]/g, ''))
    if (!/^[a-z0-9-]{1,12}$/.test(code) || !name || !Number.isInteger(price)) {
        return reply(`Format: ${p}addproduk kode|nama|harga|deskripsi\nContoh: ${p}addproduk netflix|Netflix 1 Bulan|25000|Akun sharing 1 profil\n\nKode: huruf kecil/angka/-, maks 12 karakter.`)
    }
    if (price < MIN_PRICE) return reply(`Harga minimal ${rp(MIN_PRICE)}.`)
    if (d.products[code]) return reply(`Kode "${code}" sudah dipakai. Ubah produknya dengan ${p}editproduk.`)
    d.products[code] = { code, name, price, desc: descParts.join('|').trim(), stock: null, createdAt: Date.now() }
    saveDB(global.db)
    return reply(`✅ Produk ditambahkan.\n\n🔖 ${code} — ${name}\n💰 ${rp(price)}\n\nIsi stok (opsional, untuk pengiriman otomatis):\n${p}addstok ${code} <item>`)
}

handler.command = ['addproduk']
handler.tags = ['store']
handler.help = ['addproduk']
handler.owner = true

export default handler
