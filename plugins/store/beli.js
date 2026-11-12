/**
 * Kaguya Multi Device — Store
 * .beli — beli kode
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, ACTIVE, STATUS, expireOrders, available, startStoreOrder } from '../../lib/store/shop.js'

// ===== .beli kode =====
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
    if (!body) return reply(`Format: ${p}beli <kode>\nLihat daftar: ${p}produk`)
    if (!pr) return reply(`Produk "${body}" tidak ditemukan. Ketik ${p}produk untuk melihat daftar.`)
    if (available(pr) <= 0) return btn(`Maaf, *${pr.name}* sedang habis.`, [katalogBtn])

    const buyer = await toPN(sock, m.sender)
    const running = Object.values(d.orders).find(o => o.buyer === buyer && ACTIVE.has(o.status))
    if (running) {
        return btn(
            `Kamu masih punya order *${running.id}* (${STATUS[running.status]}).\n${running.status === 'pending' ? 'Bayar dulu atau batalkan ordernya.' : 'Tunggu konfirmasi owner ya.'}`,
            running.status === 'pending' ? [quick('🚫 Batalkan Order', S('batalorder')), quick('📸 Cara Kirim Bukti', S('bukti'))] : [riwayatBtn, katalogBtn]
        )
    }

    // QRIS GoPay otomatis (global.merchantGw) kalau siap; kalau kosong / url / token error → otomatis QRIS statis + bukti manual.
    return startStoreOrder({ sock, m, pr, buyer, p, isOwner })
}

handler.command = ['beli']
handler.tags = ['store']
handler.help = ['beli']

export default handler
