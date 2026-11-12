/**
 * Kaguya Multi Device — Store
 * .isitoko — isitoko (owner) — tambah produk contoh
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { storeReply, quick, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { seedProducts, autoSeed } from '../../lib/store/catalog.js'
import { homeBtn } from '../../lib/store/toko.js'

// ===== .isitoko (owner) — tambah produk contoh =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    const n = seedProducts()
    return send({
        text: n ? `✅ ${n} produk contoh ditambahkan.\n\nHarga dan deskripsi bisa diubah dengan ${p}editproduk. Atur pengiriman otomatis dengan ${p}setkirim.` : (global.storeProducts && Object.keys(global.storeProducts).length ? 'Katalog sudah diatur lewat config.js (global.storeProducts), jadi produk contoh tidak ditambahkan. Ubah produk di config.js.' : 'Semua produk contoh sudah ada di katalog.'),
        buttons: [quick('📖 Panduan Owner', `${p}tokopanduan`), homeBtn(p)]
    })
}

handler.command = ['isitoko']
handler.tags = ['store']
handler.help = ['isitoko']
handler.owner = true

export default handler
