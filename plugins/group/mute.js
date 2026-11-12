import { getMeta, resolveTargets, botMember, botIsAdmin, memberId, waError } from '../../lib/platform/wa.js'
import { isOwnerNumber } from '../../lib/core/system.js'
import { memberIds, addMute, delMute, clearMute, listMute, isChatBanned, setChatBanned, parseDuration, formatRemaining } from '../../lib/core/data.js'

// .banchat / .unbanchat : bot mengabaikan satu grup (hanya owner yang masih bisa memakai bot di sana)
// .mute @user [durasi]  : semua pesan member itu dihapus bot (bot harus admin)
//                         durasi: 30m, 1h, 2d, 1w, 1mo; tanpa durasi = sampai di-unmute
// .unmute @user | .unmute all | .listmute
// Admin grup, owner, dan bot sendiri tidak bisa di-mute.

async function isOwnerMember(sock, p) {
    for (const id of memberIds(p)) if (await isOwnerNumber(sock, id)) return true
    return false
}

let handler = async (m, ctx) => {
    const { sock, text = '', command, jid, isOwner, reply, example } = ctx

    try {
        if (command === 'banchat' || command === 'unbanchat') {
            if (!isOwner) return reply(global.mess.owner)
            const ban = command === 'banchat'
            if (ban === isChatBanned(jid)) return reply(ban ? 'Grup ini sudah di-banchat.' : 'Grup ini tidak sedang di-banchat.')
            setChatBanned(jid, ban)
            return reply(ban
                ? '🔇 Bot sekarang mengabaikan grup ini. Hanya owner yang masih bisa memakai bot di sini.\nPenjaga grup yang aktif (antilink dst) tetap bekerja.\nBuka lagi dengan .unbanchat'
                : '🔊 Banchat dicabut. Bot merespon lagi di grup ini.')
        }

        if (command === 'listmute') {
            const rows = listMute(jid)
            if (!rows.length) return reply('Tidak ada member yang di-mute.')
            return reply(`*▢ DAFTAR MUTE* (${rows.length})\n${rows.map(e => `-▢ @${memberId(e.jid || e.ids[0])} (${e.until ? 'sisa ' + formatRemaining(e.until) : 'permanen'})`).join('\n')}`, { mentions: rows.map(e => e.jid).filter(Boolean) })
        }

        if (command === 'unmute') {
            if (text.trim().toLowerCase() === 'all') {
                const n = clearMute(jid)
                return reply(n ? `✅ ${n} member di-unmute.` : 'Tidak ada member yang di-mute.')
            }
            const meta = await getMeta(sock, jid, true)
            const done = []
            for (const p of resolveTargets(m, text, meta)) if (delMute(jid, memberIds(p))) done.push(p.id)
            // member yang sudah keluar grup: cocokkan dari nomor yang diketik
            for (const n of String(text).match(/\d{8,15}/g) || []) if (delMute(jid, [n.replace(/^0/, '62')])) done.push(`${n}@s.whatsapp.net`)
            if (!done.length) return example('@user  |  all  (atau reply pesannya)')
            return reply(done.map(j => `-▢ @${memberId(j)} di-unmute`).join('\n'), { mentions: done })
        }

        // mute
        const meta = await getMeta(sock, jid, true)
        const me = botMember(sock, meta)
        const found = resolveTargets(m, text, meta)
        if (!found.length) return example('@user [30m|1h|2d]  (atau reply pesannya)')

        const dur = text.split(/\s+/).map(parseDuration).find(Boolean) // null = tanpa batas waktu
        const ms = dur?.ms ?? null

        const ok = [], skip = []
        for (const p of found) {
            if (p.id === me?.id) skip.push(`@${memberId(p.id)} (bot sendiri)`)
            else if (p.admin) skip.push(`@${memberId(p.id)} (admin tidak bisa di-mute)`)
            else if (await isOwnerMember(sock, p)) skip.push(`@${memberId(p.id)} (owner)`)
            else { addMute(jid, memberIds(p), p.id, ms); ok.push(p) }
        }

        const lines = [
            ...ok.map(p => `-▢ @${memberId(p.id)} di-mute${ms ? ` selama ${formatRemaining(Date.now() + ms)}` : ''}`),
            ...skip.map(s => `-▢ ${s}`)
        ]
        if (ok.length && !botIsAdmin(sock, meta)) lines.push('', '⚠️ Bot belum jadi admin, pesan mereka belum bisa dihapus. Jadikan bot admin dulu.')
        return reply(lines.join('\n'), { mentions: found.map(p => p.id) })
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['mute', 'banchat', 'listmute', 'unbanchat', 'unmute']
handler.tags = ['group']
handler.group = true
handler.admin = true // banchat tetap dicek khusus owner di dalam

export default handler
