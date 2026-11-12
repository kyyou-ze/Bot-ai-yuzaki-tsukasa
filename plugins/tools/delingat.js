// Hapus pengingat milikmu.  .delingat <nomor | all>  (nomor dari .listingat)
import { delReminders, listReminders, userOf } from '../../lib/core/data.js'

const mine = (r, sender) => userOf(r.sender) === userOf(sender)

let handler = async (m, { text, sender, reply, example }) => {
    const input = String(text || '').trim()
    const rows = listReminders().filter(r => mine(r, sender)).sort((a, b) => a.due - b.due)
    if (!rows.length) return reply('Kamu belum punya pengingat aktif.')
    if (/^(all|semua)$/i.test(input)) {
        const n = delReminders(r => mine(r, sender))
        return reply(`✅ ${n} pengingat dihapus.`)
    }
    const no = parseInt(input)
    if (!no || no < 1 || no > rows.length) return example('1  (nomor dari .listingat) atau all')
    delReminders(r => r.id === rows[no - 1].id)
    return reply(`✅ Pengingat no. ${no} dihapus.`)
}

handler.command = ['delingat']
handler.help = ['delingat <no|all>']
handler.tags = ['tools']

export default handler
