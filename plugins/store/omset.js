/**
 * Kaguya Multi Device — Store
 * .omset — omset (owner)
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { storeReply, cfg, rp, quick, sendBtn, storeDB, merchantDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { dayKey, homeBtn } from '../../lib/store/order.js'

// ===== .omset (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    const sets = [
        { name: '🛍️ Toko', rows: Object.values(d.orders).filter(o => o.status === 'done') },
        { name: '🤖 Sewa', rows: Object.values(global.db?.sewa?.orders || {}).filter(o => o.status === 'done') },
        { name: '💝 Donasi', rows: Object.values(merchantDB().donations).filter(o => o.status === 'done') }
    ]
    const today = dayKey(Date.now())
    const month = today.slice(0, 7)
    const sum = (arr) => arr.reduce((a, o) => a + (o.total || 0), 0)
    const stamp = (o) => o.doneAt || o.paidAt || o.createdAt
    const all = sets.flatMap(s => s.rows)
    const dToday = all.filter(o => dayKey(stamp(o)) === today)
    const dMonth = all.filter(o => dayKey(stamp(o)).startsWith(month))
    const auto = all.filter(o => o.paidVia === 'gopay-auto')
    return send({
        text:
            `╭─▣「 *OMSET* 」▣─╮\n` +
            `┃ 📅 Hari ini  : ${dToday.length} trx • ${rp(sum(dToday))}\n` +
            `┃ 🗓️ Bulan ini : ${dMonth.length} trx • ${rp(sum(dMonth))}\n` +
            `┃ 📊 Semua     : ${all.length} trx • ${rp(sum(all))}\n` +
            `┃ ⚡ Otomatis  : ${auto.length} trx • ${rp(sum(auto))}\n` +
            `╰─────────────➤\n\n` +
            sets.map(s => `${s.name}: ${s.rows.length} trx • ${rp(sum(s.rows))}`).join('\n'),
        buttons: [quick('📋 Menunggu Bayar', `${p}orderaktif`), quick('📅 Ringkasan GoBiz', `${p}ringkasan`), homeBtn(p)]
    })
}

handler.command = ['omset']
handler.tags = ['store']
handler.help = ['omset']

export default handler
