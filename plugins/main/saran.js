// .saran <teks>  -> kirim saran / request fitur / laporan ke owner
// .saranku       -> lihat status saranmu (menunggu / diproses / selesai / ditolak)
import { toPN } from '../../lib/engine/plugins.js'
import { saranKirim, saranNotifOwner, saranMilik, STATUS_SARAN } from '../../lib/rpg/extra.js'

let handler = async (m, { sock, text, reply, sender, command, example }) => {
    const jid = await toPN(sock, sender)

    if (/^(saranku|statussaran|cekrequest)$/.test(command)) {
        const list = saranMilik(jid)
        if (!list.length) return reply('Kamu belum pernah mengirim saran.')
        const baris = list.map((x) => `*#${x.id}* ${STATUS_SARAN[x.status]}\n${x.teks.slice(0, 120)}${x.teks.length > 120 ? '…' : ''}${x.catatan ? `\n💬 Owner: ${x.catatan}` : ''}`)
        return reply(`📋 *SARANMU*\n\n${baris.join('\n\n')}`)
    }

    if (!text) return example('tambahkan fitur cek zodiak harian')
    const r = saranKirim(jid, m.pushName, text)
    if (!r.ok) return reply(`⚠️ ${r.msg}`)
    await saranNotifOwner(sock, r.item).catch(() => null)
    await reply(`✅ Saran terkirim dengan nomor *#${r.item.id}*.\nCek statusnya kapan saja dengan *saranku*.`)
}

handler.help = ['saran <teks>', 'saran saranku']
handler.tags = ['main']
handler.command = ['saran', 'cekrequest', 'feedback', 'request', 'saranku', 'statussaran', 'usul']
export default handler
