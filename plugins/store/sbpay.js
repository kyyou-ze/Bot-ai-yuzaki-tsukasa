/**
 * Kaguya Multi Device — Store
 * .sbpay — sbpay <metode> <nominal> [nama | pesan]
 * Satu file = satu command. Helper bersama: lib/store/sociabuzz.js
 */

import QRCode from 'qrcode'
import { saveDB } from '../../lib/core/system.js'
import { MAX_HISTORY, METHODS, rp, quick, copyBtn, urlBtn, parseNominal, db, createPayment, sendBtn, buildText } from '../../lib/store/sociabuzz.js'

// ===== .sbpay <metode> <nominal> [nama | pesan] =====
let handler = async (m, { sock, text, command, prefix, reply }) => {
    const p = prefix || '.'
    const body = (text || '').trim()
    // ===== .sbpay <metode> <nominal> [nama | pesan] =====
    const args = body.split(/\s+/).filter(Boolean)
    const method = (args[0] || '').toLowerCase()
    if (!method || !METHODS[method]) {
        return reply(`Format:\n${p}sbpay <metode> <nominal> [nama | pesan]\nContoh: ${p}sbpay qris 10000\n\nLihat metode: ${p}sbmethod`)
    }
    const pm = METHODS[method]

    const nominal = parseNominal(args[1])
    if (!nominal) return reply(`Nominal tidak valid.\nContoh: ${p}sbpay ${method} 10000  atau  ${p}sbpay ${method} 10k`)
    if (nominal < pm.min) return reply(`Minimal ${rp(pm.min)} untuk ${method}.`)

    let rest = args.slice(2)
    let phone
    if (pm.need_phone) {
        phone = (rest.shift() || '').replace(/\D/g, '')
        if (phone.startsWith('62')) phone = '0' + phone.slice(2)
        if (!/^08\d{8,12}$/.test(phone)) return reply(`${method.toUpperCase()} wajib nomor HP.\nContoh: ${p}sbpay ${method} ${nominal} 08123456789`)
    }
    const [namePart, ...msgParts] = rest.join(' ').split('|')
    const name = (namePart || '').trim().slice(0, 40) || m.pushName || 'Donatur'
    const message = msgParts.join('|').trim().slice(0, 100)

    await reply(global.mess?.wait || 'Tunggu sebentar...')

    let trx
    try {
        trx = await createPayment(nominal, name, message, method, { phone })
    } catch (e) {
        console.error('[sociabuzz]', e?.message || e)
        return reply(`Gagal membuat pembayaran: ${e?.message || e}`)
    }

    trx.sender = m.sender
    trx.chat = m.chat
    const store = db()
    store.trx[trx.id] = trx
    const ids = Object.keys(store.trx)
    if (ids.length > MAX_HISTORY) {
        ids.sort((a, b) => new Date(store.trx[a].created) - new Date(store.trx[b].created))
            .slice(0, ids.length - MAX_HISTORY).forEach(k => delete store.trx[k])
    }
    try { saveDB(global.db) } catch {}

    const pi = trx.payment
    const buttons = []
    if (pi.account_number) buttons.push(copyBtn('📋 Salin No. VA', pi.account_number))
    else if (pi.payment_code) buttons.push(copyBtn('📋 Salin Kode', pi.payment_code))
    buttons.push(copyBtn('💵 Salin Nominal', trx.total))
    if (pi.redirect_url) buttons.unshift(urlBtn('🔗 Buka Pembayaran', pi.redirect_url))
    else if (pi.group !== 'qris') buttons.unshift(urlBtn('🔗 Halaman Pembayaran', trx.payment_url))
    buttons.push(quick('🧾 Cek Transaksi', `${p}sbcek ${trx.id}`))

    let image
    if (pi.qr_string) {
        try { image = await QRCode.toBuffer(pi.qr_string, { width: 600, margin: 2 }) } catch {}
    }

    return sendBtn(sock, m, { text: buildText(trx, p), ...(image ? { image } : {}), buttons })
}

handler.command = ['sbpay']
handler.tags = ['store']
handler.help = ['sbpay']

export default handler
