/**
 * Kaguya Multi Device — Store
 * .rekap — rekap (owner)
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { storeReply, sendBtn, quick } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { STORE_NAME, getDB, rp, ACTIVE, dayKey, expireOrders } from '../../lib/store/shop.js'

// ===== .rekap (owner) =====
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
    const done = Object.values(d.orders).filter(o => o.status === 'done')
    const today = dayKey(Date.now())
    const month = today.slice(0, 7)
    const sum = (arr) => arr.reduce((a, o) => a + o.total, 0)
    const dToday = done.filter(o => dayKey(o.doneAt) === today)
    const dMonth = done.filter(o => dayKey(o.doneAt).startsWith(month))

    const count = {}
    for (const o of dMonth) count[o.name] = (count[o.name] || 0) + 1
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([n, c], i) => `${i + 1}. ${n} (${c}x)`).join('\n') || '-'
    const waiting = Object.values(d.orders).filter(o => ACTIVE.has(o.status)).length

    return btn(
        `╭─▣「 *REKAP ${STORE_NAME.toUpperCase()}* 」▣─╮\n` +
        `┃ 📅 Hari ini  : ${dToday.length} order • ${rp(sum(dToday))}\n` +
        `┃ 🗓️ Bulan ini : ${dMonth.length} order • ${rp(sum(dMonth))}\n` +
        `┃ 📊 Semua     : ${done.length} order • ${rp(sum(done))}\n` +
        `┃ ⏳ Menunggu  : ${waiting} pesanan\n` +
        `╰─────────────➤\n\n*Terlaris bulan ini*\n${top}\n\n_Total termasuk kode unik._`,
        [quick('📦 Pesanan', S('pesanan')), katalogBtn]
    )
}

handler.command = ['rekap']
handler.tags = ['store']
handler.help = ['rekap']
handler.owner = true

export default handler
