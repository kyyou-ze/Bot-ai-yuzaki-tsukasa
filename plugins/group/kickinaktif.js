// Member tidak aktif (berdasarkan pelacak aktivitas bot, sama seperti .inactive).
//   .listinaktif [hari]          daftar member yang tidak chat selama N hari (default 7)
//   .kickinaktif [hari]          pratinjau siapa yang akan dikeluarkan
//   .kickinaktif [hari] ya       benar-benar mengeluarkan (maks 100 orang sekali jalan)
// Admin grup, owner bot, dan bot sendiri tidak pernah dihitung. Bot harus admin untuk mengeluarkan.
import { getMeta, getActivity, memberId, waError } from '../../lib/platform/wa.js'
import { isOwnerNumber, sleep } from '../../lib/core/system.js'

const DAY = 864e5
const MAX_KICK = 100
const idsOf = (p) => [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean)

async function findQuiet(sock, meta, jid, days) {
    const { since, seen } = getActivity(jid)
    const trackedDays = (Date.now() - since) / DAY
    if (trackedDays < days) return { error: `Bot baru memantau aktivitas selama ${trackedDays.toFixed(1)} hari, belum cukup untuk menilai ${days} hari.\nCoba angka hari yang lebih kecil.` }

    const limit = Date.now() - days * DAY
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(memberId)
    const quiet = []
    for (const p of meta.participants) {
        if (p.admin) continue
        const keys = idsOf(p).map(memberId)
        if (keys.some(k => me.includes(k))) continue
        if (Math.max(0, ...keys.map(k => seen[k] || 0)) >= limit) continue
        let owner = false
        for (const k of keys) if (await isOwnerNumber(sock, k)) { owner = true; break }
        if (!owner) quiet.push(p)
    }
    return { quiet }
}

let handler = async (m, { sock, text, command, prefix, jid, reply }) => {
    try {
        const tokens = String(text || '').split(/\s+/).filter(Boolean)
        const days = Math.min(Math.max(parseInt(tokens.find(t => /^\d+$/.test(t))) || 7, 1), 365)
        const confirm = tokens.some(t => /^(ya|yes|y)$/i.test(t))

        const meta = await getMeta(sock, jid, true)
        const { quiet, error } = await findQuiet(sock, meta, jid, days)
        if (error) return reply(error)
        if (!quiet.length) return reply(`Semua member sudah aktif dalam ${days} hari terakhir.`)

        if (command === 'listinaktif') {
            const shown = quiet.slice(0, 60)
            return reply(
                `*▢ TIDAK AKTIF ${days} HARI* (${quiet.length})\n${shown.map(p => `-▢ @${memberId(p.id)}`).join('\n')}` +
                (quiet.length > shown.length ? `\n...dan ${quiet.length - shown.length} lainnya` : '') +
                `\n\n_Admin tidak dihitung. Keluarkan semuanya: ${prefix}kickinaktif ${days}_`,
                { mentions: shown.map(p => p.id) }
            )
        }

        const targets = quiet.slice(0, MAX_KICK)
        if (!confirm) {
            return reply(
                `⚠️ *${targets.length} member* tidak aktif ${days} hari akan dikeluarkan` +
                (quiet.length > MAX_KICK ? ` (dari total ${quiet.length}, maks ${MAX_KICK} sekali jalan)` : '') +
                `.\nLihat daftarnya: ${prefix}listinaktif ${days}\n\nKetik *${prefix}kickinaktif ${days} ya* untuk melanjutkan.`
            )
        }

        await reply(`Mengeluarkan ${targets.length} member...`)
        let ok = 0
        for (let i = 0; i < targets.length; i += 5) {
            const batch = targets.slice(i, i + 5).map(p => p.id)
            const res = await sock.groupParticipantsUpdate(jid, batch, 'remove')
            ok += (res || []).filter(r => String(r.status) === '200').length
            if (i + 5 < targets.length) await sleep(2000)
        }
        return reply(`✅ Selesai. ${ok} dari ${targets.length} member dikeluarkan.`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['kickinaktif', 'listinaktif']
handler.help = ['listinaktif [hari]', 'kickinaktif [hari]']
handler.tags = ['group']
handler.group = true
handler.admin = true

export default handler
