/**
 * Kaguya Multi Device — Store
 * .cekdonasi — cekdonasi [id]
 * Satu file = satu command. Helper bersama: lib/store/donate.js
 */

import { storeReply, cfg, STATUS, rp, quick, sendBtn, pollNow, merchantDB } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { donations } from '../../lib/store/donate.js'

// ===== .cekdonasi [id] =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const db = merchantDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    const buyer = await toPN(sock, m.sender)
    const digits = body.replace(/\D/g, '')
    const don = digits
        ? db.donations[`DON-${digits.padStart(4, '0')}`]
        : donations().filter(d => d.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!don || (!isOwner && don.buyer !== buyer)) return send({ text: 'Kamu belum punya donasi.', buttons: [quick('💝 Donasi', `${p}donasi`)] })
    if (don.status === 'done') return send({ text: `✅ Donasi *${don.id}* (${rp(don.total)}) sudah diterima. Terima kasih! 🙏`, buttons: [quick('🏆 Daftar Donatur', `${p}donatur`)] })
    if (!['pending', 'waiting', 'expired'].includes(don.status)) return send({ text: `Donasi *${don.id}* berstatus: ${STATUS[don.status] || don.status}.`, buttons: [quick('💝 Donasi', `${p}donasi`)] })

    await pollNow()
    if (db.donations[don.id].status === 'done') return // pesan terima kasih sudah dikirim otomatis
    return send({
        text: `⏳ Donasi *${don.id}* (${rp(don.total)}) belum terdeteksi.\nSistem mengecek otomatis tiap ${c.pollSec} detik, tunggu sebentar setelah membayar.`,
        buttons: [quick('🔄 Cek Lagi', `${p}cekdonasi ${don.id}`), quick('🚫 Batalkan', `${p}bataldonasi`)]
    })
}

handler.command = ['cekdonasi']
handler.tags = ['store']
handler.help = ['cekdonasi']

export default handler
