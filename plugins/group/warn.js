import { getMeta, resolveTargets, botMember, botIsAdmin, memberId, waError, notifyWarnKick } from '../../lib/platform/wa.js'
import { isOwnerNumber } from '../../lib/core/system.js'
import { memberIds, resolveIds, addWarn, removeWarn, resetWarn, getWarn, listWarn, warnLimit, setWarnLimit } from '../../lib/core/data.js'

// .warn @user [alasan]   : beri peringatan; mencapai batas -> dikeluarkan (bot harus admin)
// .unwarn @user          : kurangi 1 peringatan
// .resetwarn @user|all   : hapus peringatan
// .listwarn              : daftar member yang punya peringatan
// .cekwarn [@user]       : cek peringatan (semua member boleh)
// .setwarn <1-20>        : batas peringatan grup (bawaan 3)
// Saat batas tercapai: member dikeluarkan, lalu bot melapor ke admin (tag) berisi riwayat alasan.
// Antilink, antitoxic, dst memakai sistem yang sama lewat  .antilink warn  (lihat .enable).

async function isOwnerMember(sock, p) {
    for (const id of memberIds(p)) if (await isOwnerNumber(sock, id)) return true
    return false
}

let handler = async (m, ctx) => {
    const { sock, text = '', command, jid, sender, isAdmin, isOwner, reply, example } = ctx
    const limit = warnLimit(jid)

    try {
        if (command === 'cekwarn') {
            const meta = await getMeta(sock, jid)
            const found = resolveTargets(m, text, meta)[0]
            const ids = found ? memberIds(found) : await resolveIds(sock, [sender, m.key.participantAlt, m.key.participantPn], meta)
            const who = found ? found.id : sender
            const w = getWarn(jid, ids)
            const lines = [`@${memberId(who)}: *${w?.count || 0}/${limit}* peringatan`]
            if (w?.reasons?.length) lines.push('', ...w.reasons.map(r => `-▢ ${r}`))
            return reply(lines.join('\n'), { mentions: [who] })
        }

        if (!isAdmin && !isOwner) return reply(global.mess.admin)

        if (command === 'setwarn') {
            const n = parseInt(text, 10)
            if (!Number.isInteger(n) || n < 1 || n > 20) return reply(`Batas peringatan saat ini: *${limit}*\nUbah dengan ${ctx.prefix || '.'}setwarn <1-20>`)
            setWarnLimit(jid, n)
            return reply(`✅ Batas peringatan diubah menjadi *${n}*.`)
        }

        if (command === 'listwarn') {
            const rows = listWarn(jid)
            if (!rows.length) return reply('Belum ada member yang punya peringatan.')
            return reply(`*▢ DAFTAR WARN* (batas ${limit})\n${rows.map(e => `-▢ @${e.label} : ${e.count}/${limit}`).join('\n')}`, { mentions: rows.map(e => e.jid).filter(Boolean) })
        }

        if (command === 'resetwarn' && text.trim().toLowerCase() === 'all') {
            return reply(resetWarn(jid) ? '✅ Semua peringatan di grup ini dihapus.' : 'Tidak ada peringatan untuk dihapus.')
        }

        const meta = await getMeta(sock, jid, true)
        const me = botMember(sock, meta)
        const found = resolveTargets(m, text, meta)
        if (!found.length) return example(command === 'resetwarn' ? '@user  |  all' : '@user' + (command === 'warn' ? ' alasan' : '') + '  (atau reply pesannya)')

        if (command === 'unwarn' || command === 'resetwarn') {
            const lines = found.map(p => {
                if (command === 'resetwarn') return `-▢ @${memberId(p.id)} ${resetWarn(jid, memberIds(p)) ? 'peringatan dihapus' : 'tidak punya peringatan'}`
                const left = removeWarn(jid, memberIds(p))
                return `-▢ @${memberId(p.id)} ${left === null ? 'tidak punya peringatan' : `sekarang ${left}/${limit}`}`
            })
            return reply(lines.join('\n'), { mentions: found.map(p => p.id) })
        }

        // warn
        const reason = text.replace(/@\d+/g, '').replace(/\d{8,15}/g, '').trim() || 'melanggar aturan grup'
        const lines = []
        const kicks = []
        for (const p of found) {
            const tag = `@${memberId(p.id)}`
            if (p.id === me?.id) { lines.push(`-▢ ${tag} (bot sendiri) dilewati`); continue }
            if (p.admin) { lines.push(`-▢ ${tag} (admin) dilewati`); continue }
            if (await isOwnerMember(sock, p)) { lines.push(`-▢ ${tag} (owner) dilewati`); continue }

            const { count } = addWarn(jid, memberIds(p), reason, p.id)
            if (count < limit) { lines.push(`⚠️ ${tag} peringatan *${count}/${limit}*`); continue }

            if (!botIsAdmin(sock, meta)) { lines.push(`⚠️ ${tag} mencapai batas *${count}/${limit}*, tapi bot belum admin sehingga tidak bisa mengeluarkan.`); continue }
            const entry = getWarn(jid, memberIds(p)) // riwayat alasan, diambil sebelum direset
            const out = await sock.groupParticipantsUpdate(jid, [p.id], 'remove').then(() => true).catch(() => false)
            if (out) { resetWarn(jid, memberIds(p)); lines.push(`⚠️ ${tag} mencapai batas *${count}/${limit}* dan dikeluarkan.`) }
            else lines.push(`⚠️ ${tag} mencapai batas *${count}/${limit}*, tapi gagal dikeluarkan.`)
            kicks.push({ p, entry, out })
        }
        lines.push('', `Alasan: ${reason}`)
        const res = await reply(lines.join('\n'), { mentions: found.map(p => p.id) })
        for (const k of kicks) await notifyWarnKick(sock, jid, meta, k.p.id, k.entry, k.out)
        return res
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['warn', 'cekwarn', 'listwarn', 'resetwarn', 'setwarn', 'unwarn']
handler.tags = ['group']
handler.group = true

export default handler
