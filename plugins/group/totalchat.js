// .totalchat  — daftar total chat semua user yang tercatat di grup ini (urut terbanyak)
// Contoh:
//   @user1 : 20 chat
//   @user2 : 10 chat
// .totalchat reset  — reset hitungan (admin/owner)
// Memakai pencatat pesan bawaan (getMessageCounts), jadi tidak perlu hook tambahan.
import { getMeta, getMessageCounts, resetMessageCounts, memberId, waError } from '../../lib/platform/wa.js'
import { formatWib } from '../../lib/core/system.js'

let handler = async (m, { sock, text, jid, reply, isAdmin, isOwner }) => {
    try {
        if (/^(reset|clear)$/i.test(String(text).trim())) {
            if (!isAdmin && !isOwner) return reply(global.mess?.admin || 'Khusus admin grup.')
            resetMessageCounts(jid)
            return reply('Hitungan chat grup ini sudah di-reset. Penghitungan dimulai dari nol.')
        }

        const meta = await getMeta(sock, jid, true)
        const { since, counts } = getMessageCounts(jid)

        // satu orang bisa tercatat dengan beberapa id (nomor & LID) → gabungkan
        const used = new Set()
        const rows = []
        for (const p of meta.participants || []) {
            const keys = [...new Set([p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(memberId))]
            let total = 0
            for (const k of keys) { total += counts[k] || 0; used.add(k) }
            if (total > 0) rows.push({ id: p.id, label: `@${memberId(p.id)}`, total, mention: true })
        }
        // user yang pernah chat tapi sudah keluar dari grup
        for (const [k, v] of Object.entries(counts)) {
            if (!used.has(k) && v > 0) rows.push({ label: `${k} (sudah keluar)`, total: v, mention: false })
        }

        if (!rows.length) return reply('Belum ada chat yang tercatat di grup ini.')
        rows.sort((a, b) => b.total - a.total)

        const sum = rows.reduce((n, r) => n + r.total, 0)
        const lines = rows.map(r => `${r.label} : ${r.total} chat`)

        return reply(
            `*TOTAL CHAT GRUP*\n\n` +
            `${lines.join('\n')}\n\n` +
            `Total : ${sum} chat dari ${rows.length} user\n` +
            `_Dihitung sejak ${formatWib(since)}_`,
            { mentions: rows.filter(r => r.mention).map(r => r.id) }
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['totalchat']
handler.help = ['totalchat']
handler.tags = ['group']
handler.group = true

export default handler
