/**
 * Kaguya Multi Device — Store
 * .addstok — addstok kode item (satu item per baris)
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, expireOrders } from '../../lib/store/shop.js'

// ===== .addstok kode item (satu item per baris) =====
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
    const lines = body.split('\n')
    const first = (lines.shift() || '').trim()
    const code = (first.split(/\s+/)[0] || '').toLowerCase()
    const rest = first.slice(code.length).trim()
    const pr = d.products[code]
    if (!pr) return reply(`Format: ${p}addstok kode <item>\nUntuk banyak item, taruh satu item per baris:\n${p}addstok netflix\nakun1@mail.com|pass1\nakun2@mail.com|pass2`)
    const items = [rest, ...lines].map(s => s.trim()).filter(Boolean)
    if (!items.length) return reply('Itemnya kosong. Tulis item di baris berikutnya (satu item per baris).')
    if (!Array.isArray(pr.stock)) pr.stock = []
    pr.stock.push(...items)
    saveDB(global.db)
    return reply(`✅ ${items.length} item ditambahkan ke ${pr.code}.\nTotal stok: ${pr.stock.length}`)
}

handler.command = ['addstok']
handler.tags = ['store']
handler.help = ['addstok']
handler.owner = true

export default handler
