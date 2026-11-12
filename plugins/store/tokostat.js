/**
 * Kaguya Multi Device — Store
 * .tokostat — tokostat (owner) — ringkasan otomatisasi seluruh toko
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { storeReply, gwReady, gwDown, merchantDB, ACTIVE, quick, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { listRentals } from '../../lib/core/data.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn } from '../../lib/store/toko.js'

// ===== .tokostat (owner) — ringkasan otomatisasi seluruh toko =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    const products = Object.values(d.products)
    const isAuto = (pr) => Array.isArray(pr.stock) || !!pr.deliver || !!pr.file || !!pr.url
    const manual = products.filter(pr => !isAuto(pr))
    const empty = products.filter(pr => Array.isArray(pr.stock) && !pr.stock.length)
    const sewaOrders = Object.values(global.db?.sewa?.orders || {})
    const donasi = Object.values(merchantDB().donations)
    const waiting = [
        ...Object.values(d.orders).filter(o => ACTIVE.has(o.status)),
        ...sewaOrders.filter(o => ACTIVE.has(o.status)),
        ...donasi.filter(o => ACTIVE.has(o.status))
    ].length
    const rentals = listRentals()
    const rentalOn = rentals.filter(r => r.until === null || r.until > Date.now()).length
    const plans = Array.isArray(global.sewaPlans) ? global.sewaPlans.length : 0
    return send({
        text:
            `📈 *STATUS TOKO*\n\n` +
            `Gateway GoBiz : ${gwReady() ? (gwDown() ? '⚠️ error, sementara pakai mode manual (QRIS statis)' : '✅ siap, bayar & kirim otomatis') : '➖ belum diisi, pakai mode manual (QRIS statis + bukti)'}\n` +
            `Produk : ${products.length} (otomatis ${products.length - manual.length}, manual ${manual.length})\n` +
            `Sewa bot : ${plans} paket, ${rentalOn} grup aktif\n` +
            `🍥 Donasi : ${donasi.filter(x => x.status === 'done').length} masuk\n` +
            `⏳ Menunggu bayar : ${waiting}\n` +
            (empty.length ? `\n⚠️ Stok habis: ${empty.map(pr => pr.code).join(', ')}  (isi dengan ${p}addstok)` : '') +
            (manual.length ? `\n Belum otomatis: ${manual.slice(0, 8).map(pr => pr.code).join(', ')}${manual.length > 8 ? ', ...' : ''}\n   Atur dengan ${p}setkirim kode|link` : '\n Semua produk sudah otomatis.'),
        buttons: [quick('🩺 Cek Gateway', `${p}merchantcek`), quick('📊 Omset', `${p}omset`), homeBtn(p)]
    })
}

handler.command = ['tokostat']
handler.tags = ['store']
handler.help = ['tokostat']
handler.owner = true

export default handler
