/**
 * Kaguya Multi Device — Store
 * .pesanan — pesanan (owner)
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { storeReply, sendBtn, quick, pick, row } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { getDB, rp, tagOf, ACTIVE, STATUS, ago, expireOrders } from '../../lib/store/shop.js'

// ===== .pesanan (owner) =====
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
    const list = Object.values(d.orders).filter(o => ACTIVE.has(o.status)).sort((a, b) => (a.status === 'waiting' ? -1 : 1) - (b.status === 'waiting' ? -1 : 1) || a.createdAt - b.createdAt)
    if (!list.length) return btn('Tidak ada pesanan yang menunggu.', [quick('📊 Rekap', S('rekap')), katalogBtn])
    const lines = list.map(o => `🧾 *${o.id}* — ${o.name}\n   ${rp(o.total)}  |  ${STATUS[o.status]}  |  @${tagOf(o.buyer)}  |  ${ago(o.createdAt)}`)
    const orderRows = list.slice(0, 10).map(o => (sub) => row(cut(`${o.id} • ${o.name}`, 24), S(sub, o.id), cut(`${rp(o.total)} • ${STATUS[o.status]}`, 72)))
    return btn(
        `*Pesanan aktif (${list.length})*\n\n${lines.join('\n\n')}\n\nPilih pesanan lewat tombol di bawah.` +
        (list.length > 10 ? `\n_Tombol menampilkan 10 pertama. Lainnya: ${S('acc', '<id>')}_` : ''),
        [
            pick('✅ ACC Pesanan', [{ title: 'Setujui pesanan', rows: orderRows.map(f => f('acc')) }]),
            pick('❌ Tolak Pesanan', [{ title: 'Tolak pesanan', rows: orderRows.map(f => f('tolak')) }]),
            quick('📊 Rekap', S('rekap')),
            katalogBtn
        ],
        { mentions: list.map(o => o.buyer) }
    )
}

handler.command = ['pesanan']
handler.tags = ['store']
handler.help = ['pesanan']
handler.owner = true

export default handler
