/**
 * Kaguya Multi Device — Store
 * .sbcek — sbcek [id]
 * Satu file = satu command. Helper bersama: lib/store/sociabuzz.js
 */

import { rp, db, wib } from '../../lib/store/sociabuzz.js'

// ===== .sbcek [id] =====
let handler = async (m, { sock, text, command, prefix, reply }) => {
    const p = prefix || '.'
    const body = (text || '').trim()
    const list = Object.values(db().trx)
    const trx = body
        ? db().trx[body.toUpperCase()]
        : list.filter(t => t.sender === m.sender).sort((a, b) => new Date(b.created) - new Date(a.created))[0]
    if (!trx) return reply('Transaksi tidak ditemukan.')
    const expired = Date.now() > new Date(trx.expired).getTime()
    return reply(
        `🧾 *${trx.id}*\n\n` +
        `Metode : ${trx.method.toUpperCase()}\n` +
        `Total  : ${rp(trx.total)}\n` +
        `Dibuat : ${wib(trx.created)} WIB\n` +
        `Batas  : ${wib(trx.expired)} WIB\n` +
        `Status : ${expired ? '⌛ Kedaluwarsa' : '⏳ Menunggu pembayaran'}\n\n` +
        `_Status pembayaran dicek manual lewat link/aplikasi pembayaranmu._`
    )
}

handler.command = ['sbcek']
handler.tags = ['store']
handler.help = ['sbcek']

export default handler
