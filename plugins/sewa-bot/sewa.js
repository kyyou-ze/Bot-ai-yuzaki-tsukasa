/**
 * Kaguya Multi Device — Sewa Bot
 * .sewa — sewa [paket] [link grup]
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import QRCode from 'qrcode'
import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendThumb, gwUsable, quick, copyBtn, sendBtn, allocTotal, createGatewayInvoice, cfg as merchantCfg } from '../../lib/store/merchant.js'
import { formatDate, formatRemaining, sewaData, getRental } from '../../lib/core/data.js'
import { toPN } from '../../lib/engine/plugins.js'
import { waError } from '../../lib/platform/wa.js'
import { ORDER_TTL_MIN, UNIQUE_MAX, GROUP_LINK, qrisText, qrisReady, toDynamic, merchantOf, rp, ACTIVE, STATUS, plans, durLabel, expireOrders, groupName } from '../../lib/store/sewa.js'
import { sendPreview } from '../../lib/store/preview.js'

// ===== .sewa [paket] [link grup] =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const list = plans()
        if (!list.length) return reply('Paket sewa belum diatur.')

        const tokens = body.split(/\s+/).filter(Boolean)
        const link = tokens.find(t => GROUP_LINK.test(t))
        const planTok = tokens.find(t => !GROUP_LINK.test(t))

        if (!planTok) {
            const r = m.isGroup ? getRental(jid) : null
            const status = r
                ? (r.until === null || r.until > Date.now()
                    ? `\n✅ Grup ini sedang menyewa: ${r.until === null ? 'permanen' : `${formatRemaining(r.until)} lagi (s/d ${formatDate(r.until)})`}\n`
                    : `\n⌛ Sewa grup ini sudah habis sejak ${formatDate(r.until)}.\n`)
                : ''
            const rows = list.map((pl, i) => `${i + 1}. *${pl.id}* — ${durLabel(pl)}\n   💰 ${rp(pl.harga)}`)
            const auto = gwUsable()
            // Banner sewa memakai metode yang sama dengan promosi/menu:
            // link preview (kartu gambar), bukan foto terpisah.
            return sendPreview(sock, m.chat,
                `╭─▣「 *SEWA BOT TSUKASA* 」▣─╮\n╰─────────────➤\n${status}\n${rows.join('\n')}\n\n` +
                (m.isGroup
                    ? `Pesan untuk grup ini: ${p}sewa <paket>\nContoh: ${p}sewa ${list[0].id}`
                    : `Pesan: ${p}sewa <paket> <link grup>\nContoh: ${p}sewa ${list[0].id} https://chat.whatsapp.com/xxxx`) +
                (auto ? `\n\nBayar lewat QRIS GoPay, sewa aktif *otomatis* begitu pembayaran masuk.` : `\n\nBayar lewat QRIS, lalu kirim bukti dengan ${p}buktisewa.`),
                { quoted: m }
            )
        }

        const idx = /^\d+$/.test(planTok) ? Number(planTok) - 1 : -1
        const plan = list.find(pl => pl.id.toLowerCase() === planTok.toLowerCase()) || list[idx]
        if (!plan) return reply(`Paket "${planTok}" tidak ditemukan. Ketik ${p}sewa untuk melihat daftar.`)
        if (!gwUsable() && !qrisReady()) return reply(isOwner ? 'QRIS sewa belum valid. Isi global.merchantGw (otomatis) atau global.qrisStatic di config.js.' : 'Pembayaran sewa belum tersedia saat ini.')

        // grup tujuan: grup ini, atau (di private chat) grup dari link
        let group = null
        let name = ''
        let code = null
        if (m.isGroup && !link) {
            group = jid
            name = await groupName(sock, jid)
        } else {
            if (!link) return reply(`Di private chat sertakan link grup.\nContoh: ${p}sewa ${plan.id} https://chat.whatsapp.com/xxxx`)
            code = link.match(GROUP_LINK)[1]
            try {
                const info = await sock.groupGetInviteInfo(code)
                group = info.id
                name = info.subject || ''
            } catch {
                return reply('Link grup tidak valid atau sudah kedaluwarsa.')
            }
        }

        const buyer = await toPN(sock, m.sender)
        const open = Object.values(d.orders).find(o => o.buyer === buyer && ACTIVE.has(o.status))
        if (open) return reply(`Kamu masih punya order aktif *${open.id}* (${STATUS[open.status]}).\n${open.status === 'pending' ? `Selesaikan pembayarannya atau batalkan dengan ${p}batalsewa.` : 'Tunggu konfirmasi owner.'}`)

        // QRIS GoPay otomatis (global.merchantGw): pembayaran dicek bot, sewa aktif sendiri begitu lunas.
        // Kalau global.merchantGw kosong, atau url/token error, jatuh ke alur manual di bawah (QRIS statis + bukti).
        if (gwUsable()) {
            const alloc = allocTotal(Number(plan.harga))
            if (!alloc) return reply('Sedang ramai, coba lagi beberapa menit lagi ya.')
            let inv = null
            try {
                inv = await createGatewayInvoice(alloc.total)
            } catch (e) {
                console.error('[sewa] create gagal, pakai mode manual:', e?.message || e)
            }
            if (inv) {
                d.seq += 1
                const gid = `SWA-${String(d.seq).padStart(4, '0')}`
                d.orders[gid] = {
                    id: gid, buyer, group, groupName: name, code, plan: plan.id, planName: durLabel(plan), days: plan.hari,
                    price: Number(plan.harga), unique: alloc.unique, total: alloc.total, status: 'pending', createdAt: Date.now(), gw: inv.gw
                }
                saveDB(global.db)
                return sendBtn(sock, m.chat, {
                    image: inv.image,
                    text:
                        `╭─▣「 *ORDER SEWA ${gid}* 」▣─╮\n` +
                        `┃ 🤖 Paket    : ${durLabel(plan)}\n` +
                        `┃ 👥 Grup     : ${name || group}\n` +
                        `┃ 💰 Harga    : ${rp(plan.harga)}\n` +
                        (alloc.unique ? `┃ 🔢 Kode unik: ${alloc.unique}\n` : '') +
                        `┃ 💳 *Total   : ${rp(alloc.total)}*\n` +
                        `┃ ⏳ Berlaku  : ${merchantCfg().ttlMin} menit\n` +
                        `╰─────────────➤\n\n` +
                        `Scan QRIS di atas dan bayar *tepat ${rp(alloc.total)}*.\n` +
                        `Pembayaran dicek *otomatis*, sewa langsung aktif begitu lunas. Tidak perlu kirim bukti.`,
                    buttons: [
                        quick('🔄 Cek Pembayaran', `${p}cekbayarsewa ${gid}`),
                        copyBtn('📋 Salin Nominal', alloc.total),
                        quick('🚫 Batalkan Order', `${p}batalsewa`)
                    ]
                }, m)
            }
        }

        // mode manual butuh QRIS statis yang valid
        if (!qrisReady()) return reply(isOwner ? 'Gateway error dan QRIS statis belum valid. Perbaiki global.merchantGw atau isi global.qrisStatic di config.js.' : 'Pembayaran sewa belum tersedia saat ini.')

        // kode unik supaya nominal tiap order berbeda (memudahkan cek mutasi)
        const taken = new Set(Object.values(d.orders).filter(o => ACTIVE.has(o.status)).map(o => o.total))
        let unique = 0
        let total = 0
        for (let i = 0; i < 200; i++) {
            unique = 1 + Math.floor(Math.random() * UNIQUE_MAX)
            total = Number(plan.harga) + unique
            if (!taken.has(total)) break
        }

        d.seq += 1
        const id = `SWA-${String(d.seq).padStart(4, '0')}`
        d.orders[id] = {
            id, buyer, group, groupName: name, code, plan: plan.id, planName: durLabel(plan), days: plan.hari,
            price: Number(plan.harga), unique, total, status: 'pending', createdAt: Date.now()
        }
        saveDB(global.db)

        const image = await QRCode.toBuffer(toDynamic(qrisText(), total), { width: 600, margin: 3, errorCorrectionLevel: 'M' })
        return sendThumb(sock, m.chat, {
            image,
            caption:
                `╭─▣「 *ORDER SEWA ${id}* 」▣─╮\n` +
                `┃ 🤖 Paket    : ${durLabel(plan)}\n` +
                `┃ 👥 Grup     : ${name || group}\n` +
                `┃ 💰 Harga    : ${rp(plan.harga)}\n` +
                `┃ 🔢 Kode unik: ${unique}\n` +
                `┃ 💳 *Total   : ${rp(total)}*\n` +
                `┃ 🏪 Penerima : ${merchantOf()}\n` +
                `╰─────────────➤\n\n` +
                `Scan QRIS di atas dan bayar *tepat ${rp(total)}* (termasuk kode unik).\n` +
                `Order berlaku ${ORDER_TTL_MIN} menit.\n\n` +
                `Setelah membayar kirim *foto bukti* dengan caption ${p}buktisewa\n` +
                `Batal: ${p}batalsewa`
        }, { quoted: m })
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['sewa']
handler.tags = ['sewa-bot']
handler.help = ['sewa']

export default handler
