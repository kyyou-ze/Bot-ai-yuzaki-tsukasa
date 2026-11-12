import { waError } from '../../lib/platform/wa.js'

let handler = async (m, { sock, command, jid, reply }) => {
    try {
        if (command === 'resetlink') {
            const code = await sock.groupRevokeInvite(jid)
            return reply(`Link grup berhasil direset.\n\nhttps://chat.whatsapp.com/${code}`)
        }
        const code = await sock.groupInviteCode(jid)
        return reply(`https://chat.whatsapp.com/${code}`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['link', 'linkgc', 'resetlink']
handler.as = 'linkgc'
handler.tags = ['group']
handler.group = true

export default handler
