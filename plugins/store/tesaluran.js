/**
 * Kaguya Multi Device — Store
 * .tesaluran — kirim contoh notif donasi + struk ke saluran (owner)
 */

import { storeReply, channelJid, notifyChannel, channelReason, makeReceipt, rp, wib } from '../../lib/store/merchant.js'

let handler = async (m, { sock, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    const jid = channelJid()
    if (!jid) return reply('donateChannel di global.merchantGw (config.js) kosong atau formatnya salah.\nIsi dengan ID saluran, contoh: 120363xxxxxxxxxxxx@newsletter')

    const now = Date.now()
    const don = { id: 'DON-TEST', price: 1000, unique: 0, total: 1000, buyer: m.sender, name: m.pushName || 'Tes', note: 'tes notif saluran', paidAt: now }
    const image = await makeReceipt('donate', don, { via: 'gopay-auto', forChannel: true })
    const ok = await notifyChannel(
        `💝 *DONASI MASUK (TES)*\n\n💳 ${rp(don.total)}\n👤 ${don.name}\n🧾 ${don.id}\n🕐 ${wib(now)} WIB\n💬 ${don.note}\n\nIni hanya contoh notif.`,
        image
    )
    if (ok) return reply(`✅ Terkirim ke saluran ${jid}${image ? ' (dengan struk)' : ' (struk gagal dibuat, teks saja)'}.\nKalau tidak muncul di saluran, cek lagi ID saluran di config.js.`)
    return reply(`❌ Tidak terkirim ke ${jid}.\nAlasan: ${channelReason() || 'tidak diketahui (lihat log bot, cari [donate])'}\n\nPastikan nomor bot (${global.nomorbot || '-'}) adalah admin/pemilik saluran itu.`)
}

handler.command = ['tesaluran']
handler.tags = ['store']
handler.help = ['tesaluran']
handler.owner = true

export default handler
