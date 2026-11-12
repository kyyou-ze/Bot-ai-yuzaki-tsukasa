// .badge [@user]  -> koleksi badge + progres. Badge juga tampil di .usercard
import { toPN } from '../../lib/engine/plugins.js'
import { badgeDetail } from '../../lib/rpg/extra.js'

let handler = async (m, { sock, reply, sender }) => {
    const target = m.mentionedJid?.[0] || m.quoted?.sender
    const jid = await toPN(sock, target || sender)
    const d = badgeDetail(jid)
    const nama = target ? `@${String(jid).split('@')[0]}` : 'kamu'
    await reply(
        `🏅 *BADGE ${nama.toUpperCase()}*\nTerbuka: *${d.dapat}/${d.total}* • Streak harian: *${d.streak}* hari\n\n${d.teks}\n\n_Hadiah dikirim otomatis saat badge terbuka._`,
        { mentions: target ? [jid] : [] }
    )
}

handler.help = ['badge [@user]']
handler.tags = ['user']
handler.command = ['badge']
export default handler
