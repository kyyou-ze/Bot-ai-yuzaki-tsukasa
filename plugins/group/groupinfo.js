import { getMeta, findMember, getActivity, memberId } from '../../lib/platform/wa.js'
import { formatWib, sleep } from '../../lib/core/system.js'

const DAY = 864e5
const ALIVE = new Set(['available', 'composing', 'recording'])

async function onlineMembers(sock, meta) {
    const online = new Set()
    const onPresence = ({ presences = {} }) => {
        for (const [who, p] of Object.entries(presences)) {
            if (ALIVE.has(p?.lastKnownPresence)) online.add(findMember(meta, who)?.id || who)
        }
    }

    sock.ev.on('presence.update', onPresence)
    try {
        const members = meta.participants.slice(0, 150)
        for (let i = 0; i < members.length; i += 25) {
            await Promise.all(members.slice(i, i + 25).map(p => sock.presenceSubscribe(p.id).catch(() => null)))
        }
        await sleep(4000)
    } finally {
        sock.ev.off('presence.update', onPresence)
    }
    return [...online]
}

let handler = async (m, { sock, text, command, jid, reply }) => {
    const meta = await getMeta(sock, jid, true)

    if (command === 'infogc') {
        const admins = meta.participants.filter(p => p.admin)
        return reply(
`╭─▣「 *INFO GRUP* 」▣─╮
┃ ✦ Nama      : ${meta.subject}
┃ ✦ ID        : ${meta.id}
┃ ✦ Dibuat    : ${formatWib(meta.creation * 1000)}
┃ ✦ Pembuat   : ${meta.owner ? `@${memberId(meta.owner)}` : '-'}
┃ ✦ Member    : ${meta.participants.length}
┃ ✦ Admin     : ${admins.length}
┃ ✦ Chat      : ${meta.announce ? 'hanya admin' : 'semua member'}
┃ ✦ Edit info : ${meta.restrict ? 'hanya admin' : 'semua member'}
┃ ✦ Pesan sementara : ${meta.ephemeralDuration ? `${meta.ephemeralDuration / 86400} hari` : 'mati'}
╰─────────────➤

*Deskripsi*
${meta.desc || '-'}`,
            { mentions: meta.owner ? [meta.owner] : [] }
        )
    }

    if (command === 'listadmin') {
        const admins = meta.participants.filter(p => p.admin)
        const lines = admins.map(p => `-▢ @${memberId(p.id)}${p.admin === 'superadmin' ? ' 👑' : ''}`)
        return reply(`*▢ ADMIN GRUP* (${admins.length})\n${lines.join('\n')}`, { mentions: admins.map(p => p.id) })
    }

    if (command === 'listonline') {
        const list = await onlineMembers(sock, meta)
        if (!list.length) return reply('Tidak ada member yang terdeteksi online.\n\n_Hasil bergantung pada pengaturan privasi masing-masing member._')
        return reply(
            `*▢ ONLINE* (${list.length})\n${list.map(id => `-▢ @${memberId(id)}`).join('\n')}\n\n_Hanya yang terdeteksi, tergantung privasi masing-masing._`,
            { mentions: list }
        )
    }

    // inactive [hari]
    const days = Math.min(Math.max(parseInt(text) || 7, 1), 365)
    const { since, seen } = getActivity(jid)
    const trackedDays = (Date.now() - since) / DAY

    if (trackedDays < days) {
        return reply(`Bot baru memantau aktivitas selama ${trackedDays.toFixed(1)} hari, belum cukup untuk menilai ${days} hari.\nCoba lagi nanti atau pakai angka hari yang lebih kecil.`)
    }

    const limit = Date.now() - days * DAY
    const quiet = meta.participants.filter(p => {
        if (p.admin) return false
        const last = Math.max(0, ...[p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(id => seen[memberId(id)] || 0))
        return last < limit
    })

    if (!quiet.length) return reply(`Semua member sudah aktif dalam ${days} hari terakhir.`)

    const shown = quiet.slice(0, 60)
    return reply(
        `*▢ TIDAK AKTIF ${days} HARI* (${quiet.length})\n${shown.map(p => `-▢ @${memberId(p.id)}`).join('\n')}` +
        (quiet.length > shown.length ? `\n...dan ${quiet.length - shown.length} lainnya` : '') +
        `\n\n_Admin tidak dihitung. Untuk mengeluarkan: kick @user_`,
        { mentions: shown.map(p => p.id) }
    )
}

handler.command = ['groupinfo', 'infogc', 'inactive', 'listadmin', 'listonline']
handler.as = 'infogc'
handler.tags = ['group']
handler.group = true

export default handler
