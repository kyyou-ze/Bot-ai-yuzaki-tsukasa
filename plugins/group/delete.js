import { waError } from '../../lib/platform/wa.js'

let handler = async (m, { sock, jid, reply }) => {
    if (!m.quoted?.id) return reply('Reply pesan yang mau dihapus.')

    try {
        await sock.sendMessage(jid, { delete: m.quoted.fakeKey })
        await sock.sendMessage(jid, { delete: m.key }).catch(() => null) // ikut hapus perintahnya
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['delete']
handler.subs = ['d']
handler.tags = ['group']
handler.group = true

export default handler
