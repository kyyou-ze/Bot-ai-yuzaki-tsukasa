/**
 * Kaguya Multi Device — Sewa Bot
 * .sewamode — sewamode on|off (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply } from '../../lib/store/merchant.js'
import { updateConfigValue } from '../../lib/core/file.js'
import { sewaData, listRentals } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { expireOrders } from '../../lib/store/sewa.js'

// ===== .sewamode on|off (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const arg = body.split(/\s+/)[0].toLowerCase()
        const on = /^(on|1|true|aktif)$/i.test(arg)
        const off = /^(off|0|false|mati|nonaktif)$/i.test(arg)
        if (!on && !off) {
            return reply(
                `*▢ MODE SEWA*\nStatus: ${global.sewamode === true ? '✅ ON (grup wajib sewa)' : '❌ OFF'}\n` +
                `Grup penyewa aktif: ${listRentals().filter(r => r.until === null || r.until > Date.now()).length}\n\n` +
                `${p}sewamode on  → grup yang belum sewa tidak dilayani\n${p}sewamode off`
            )
        }
        if ((global.sewamode === true) === on) return reply(`･ﾟ✦ sewamode sudah ${on ? 'aktif' : 'nonaktif'}.`)
        global.sewamode = on
        const saved = updateConfigValue('sewamode', on)
        return reply(
            `･ﾟ✦ sewamode ${on ? 'diaktifkan' : 'dimatikan'}.` +
            (on ? `\n⚠️ Mulai sekarang grup yang belum sewa (atau sewanya habis) tidak dilayani. Daftarkan grup yang sudah ada dengan ${p}addsewa di grup masing-masing.` : '') +
            (saved ? '' : '\n\n_Gagal menyimpan ke config.js, pengaturan kembali seperti semula setelah restart._')
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['sewamode']
handler.tags = ['sewa-bot']
handler.help = ['sewamode']
handler.owner = true

export default handler
