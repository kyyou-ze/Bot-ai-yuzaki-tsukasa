import { getMeta, getMessageCounts, resetMessageCounts, resolveTargets, memberId, waError } from '../../lib/platform/wa.js'
import { formatWib } from '../../lib/core/system.js'

// jumlah pesan satu member = gabungan semua id miliknya (nomor / LID) yang tercatat
const countOf = (counts, p) => {
    const keys = new Set([p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(memberId))
    let total = 0
    for (const k of keys) total += counts[k] || 0
    return total
}

let handler = async (m, { sock, text, jid, reply, isAdmin, isOwner }) => {
    try {
        if (/^(reset|clear)$/i.test(String(text).trim())) {
            if (!isAdmin && !isOwner) return reply(global.mess.admin)
            resetMessageCounts(jid)
            return reply('Hitungan pesan grup ini sudah di-reset. Penghitungan dimulai dari nol.')
        }

        const meta = await getMeta(sock, jid, true)
        const { since, counts } = getMessageCounts(jid)
        const sinceText = `_Dihitung sejak ${formatWib(since)}_`

        // total pesan satu orang (mention / reply / nomor)
        const targets = resolveTargets(m, text, meta)
        if (targets.length) {
            const lines = targets.map(p => `@${memberId(p.id)} : ${countOf(counts, p)} chat`)
            return reply(`* TOTAL PESAN*\n${lines.join('\n')}\n\n${sinceText}`, { mentions: targets.map(p => p.id) })
        }

        const ranked = meta.participants
            .map(p => ({ p, total: countOf(counts, p) }))
            .sort((a, b) => b.total - a.total)

        const sum = ranked.reduce((n, x) => n + x.total, 0)
        if (!sum) return reply(`Belum ada chat yang tercatat di grup ini.\n\n${sinceText}`)

        const lines = ranked.map(x => `@${memberId(x.p.id)} : ${x.total} chat`)

        return reply(
            `* TOTAL CHAT GRUP*\n` +
            `${lines.join('\n')}\n\n` +
            `Total : ${sum} chat\n` +
            `${sinceText}`,
            { mentions: ranked.map(x => x.p.id) }
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['totalpesan']
handler.help = ['totalpesan']
handler.tags = ['group']
handler.group = true

export default handler
