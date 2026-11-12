// .listsaran [menunggu|diproses|selesai|ditolak]  -> daftar saran masuk
// .setsaran <id> <menunggu|diproses|selesai|ditolak|hapus> [catatan]  -> ubah status, user otomatis diberi tahu
import { saranDaftar, saranSet, STATUS_SARAN } from '../../lib/rpg/extra.js'
import { jidNumber } from '../../lib/core/system.js'

let handler = async (m, { sock, text = '', reply, command, example }) => {
    if (command === 'listsaran') {
        const status = text.trim().toLowerCase()
        if (status && !STATUS_SARAN[status]) return reply(`Status harus salah satu: ${Object.keys(STATUS_SARAN).join(', ')}`)
        const list = saranDaftar(status || null)
        if (!list.length) return reply('Tidak ada saran.')
        const baris = list.map((x) => `*#${x.id}* ${STATUS_SARAN[x.status]} • ${x.nama} (${jidNumber(x.jid)})\n${x.teks.slice(0, 160)}${x.teks.length > 160 ? '…' : ''}`)
        return reply(`📩 *DAFTAR SARAN* (${list.length})\n\n${baris.join('\n\n')}`)
    }

    const [id, status, ...rest] = text.trim().split(/\s+/)
    if (!id || !status) return example('3 diproses sedang dikerjakan')
    const r = saranSet(id, status.toLowerCase(), rest.join(' '))
    if (!r.ok) return reply(`⚠️ ${r.msg}`)
    if (r.hapus) return reply(`🗑️ Saran #${id} dihapus.`)

    await sock.sendMessage(r.item.jid, {
        text: `📢 *UPDATE SARANMU #${r.item.id}*\n\nStatus: ${STATUS_SARAN[r.item.status]}${r.item.catatan ? `\n💬 Catatan owner: ${r.item.catatan}` : ''}\n\n"${r.item.teks.slice(0, 200)}"`
    }).catch(() => null)
    await reply(`✅ Saran #${r.item.id} → ${STATUS_SARAN[r.item.status]}. User sudah diberi tahu.`)
}

handler.help = ['listsaran [status]', 'setsaran <id> <status> [catatan]']
handler.tags = ['owner']
handler.command = ['setsaran', 'listsaran']
handler.owner = true

export default handler
