/**
 * Kaguya Multi Device — Store
 * .produk — daftar produk & detail produk
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { storeReply, sendBtn, quick, pick, row } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { STORE_NAME, getDB, rp, expireOrders, available, stockLabel } from '../../lib/store/shop.js'

// ===== .produk [kode] =====
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
    const list = Object.values(d.products)
    if (!list.length) return reply(isOwner ? `Katalog kosong. Tambah dengan:\n${p}addproduk kode|nama|harga|deskripsi` : 'Katalog masih kosong.')

    if (body) {
        const pr = d.products[body.toLowerCase()]
        if (!pr) return btn(`Produk "${body}" tidak ditemukan.`, [katalogBtn])
        return btn(
            `╭─▣「 *${pr.name}* 」▣─╮\n` +
            `┃ 🔖 Kode  : ${pr.code}\n` +
            `┃ 💰 Harga : ${rp(pr.price)}\n` +
            `┃ 📦 Stok  : ${stockLabel(pr, isOwner)}\n` +
            `╰─────────────➤\n` +
            `${pr.desc ? `\n${pr.desc}\n` : ''}`,
            [...(available(pr) > 0 ? [quick('🛒 Beli Sekarang', S('beli', pr.code))] : []), katalogBtn]
        )
    }

    const lines = list.map(pr =>
        `🔖 *${pr.code}* — ${pr.name}\n   💰 ${rp(pr.price)}  |  📦 ${stockLabel(pr, isOwner)}${pr.desc ? `\n   ${pr.desc.split('\n')[0].slice(0, 80)}` : ''}`
    )
    const rows = list.slice(0, 10).map(pr => row(cut(pr.name, 24), S('produk', pr.code), cut(`${rp(pr.price)} • stok ${stockLabel(pr, isOwner)}`, 72)))
    return btn(
        `╭─▣「 *${STORE_NAME.toUpperCase()}* 」▣─╮\n╰─────────────➤\n\n${lines.join('\n\n')}\n\nPilih produk lewat tombol di bawah.` +
        (list.length > 10 ? `\n_Tombol menampilkan 10 produk pertama. Lainnya: ${S('produk', '<kode>')}_` : ''),
        [
            pick('🛒 Pilih Produk', [{ title: 'Katalog produk', rows }]),
            riwayatBtn,
            ...(isOwner ? [quick('📦 Pesanan', S('pesanan')), quick('📊 Rekap', S('rekap'))] : [])
        ]
    )
}

handler.command = ['produk']
handler.tags = ['store']
handler.help = ['produk']

export default handler
