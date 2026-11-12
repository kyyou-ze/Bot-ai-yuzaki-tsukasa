/**
 * Kaguya Multi Device — Store
 * .riwayat — riwayat
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { syncLedger } from '../../lib/store/ledger.js'
import { HISTORY_LIMIT, getDB, rp, STATUS, ago, expireOrders } from '../../lib/store/shop.js'

// ===== .riwayat =====
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
    const buyer = await toPN(sock, m.sender)
    // riwayat lengkap dari ledger: toko, sewa bot, donasi, sociabuzz, panel (permanen, tidak ikut terhapus)
    syncLedger(global.db)
    const num = String(buyer || '').split('@')[0].split(':')[0]
    const KIND = { store: '🛍️', sewa: '🤖', donate: '💝', sociabuzz: '💳', panel: '🖥️' }
    const mine = Object.values(global.db.ledger?.transactions || {})
        .filter(t => String(t.buyer || '').split('@')[0].split(':')[0] === num)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, HISTORY_LIMIT)
    if (!mine.length) return btn('Kamu belum punya riwayat pembelian.', [katalogBtn])
    const lines = mine.map(t => `${KIND[t.kind] || '🧾'} *${t.ref}* — ${t.name}\n   ${rp(t.total || 0)}  |  ${STATUS[t.status] || t.status}  |  ${ago(t.createdAt)}`)
    const hasPending = mine.some(t => t.kind === 'store' && t.status === 'pending')
    return btn(`*Riwayat pembelian kamu*\n\n${lines.join('\n\n')}`, [katalogBtn, ...(hasPending ? [quick('🚫 Batalkan Order', S('batalorder'))] : [])])
}

handler.command = ['riwayat']
handler.tags = ['store']
handler.help = ['riwayat']

export default handler
