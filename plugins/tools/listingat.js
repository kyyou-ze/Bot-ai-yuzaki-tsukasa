// Daftar pengingat aktif milikmu. Buat pengingat lewat .ingatkan, hapus lewat .delingat
import { listReminders, userOf, formatRemaining } from '../../lib/core/data.js'
import { formatWib } from '../../lib/core/system.js'

const mine = (r, sender) => userOf(r.sender) === userOf(sender)

let handler = async (m, { prefix, sender, reply }) => {
    const rows = listReminders().filter(r => mine(r, sender)).sort((a, b) => a.due - b.due)
    if (!rows.length) return reply('Kamu belum punya pengingat aktif.')
    return reply(
        `*▢ PENGINGATMU* (${rows.length})\n\n` +
        rows.map((r, i) => `${i + 1}. ${r.text.slice(0, 80)}\n   ⏰ ${formatWib(r.due)} (${formatRemaining(r.due)} lagi)`).join('\n') +
        `\n\nHapus: ${prefix}delingat <nomor | all>`
    )
}

handler.command = ['listingat']
handler.help = ['listingat']
handler.tags = ['tools']

export default handler
