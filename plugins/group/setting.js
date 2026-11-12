import { waError } from '../../lib/platform/wa.js'

const EPHEMERAL = { off: 0, '1d': 86400, '7d': 604800, '90d': 7776000 }

async function pickImage(m) {
    if (m.mtype === 'imageMessage') return m.download()
    if (m.quoted?.mtype === 'imageMessage') return m.quoted.download()
    return null
}

let handler = async (m, { sock, text, command, jid, reply, example }) => {
    try {
        if (command === 'setnamegc') {
            if (!text) return example('Nama Grup Baru')
            await sock.groupUpdateSubject(jid, text.trim().slice(0, 100))
            return reply('Nama grup berhasil diubah.')
        }

        if (command === 'setdescgc') {
            if (!text) return example('Deskripsi baru (ketik "hapus" untuk mengosongkan)')
            await sock.groupUpdateDescription(jid, text.trim().toLowerCase() === 'hapus' ? '' : text.trim())
            return reply('Deskripsi grup berhasil diubah.')
        }

        if (command === 'setppgc') {
            const image = await pickImage(m)
            if (!image) return reply('Kirim foto dengan caption setppgc, atau reply foto dengan setppgc.')
            await sock.updateProfilePicture(jid, image)
            return reply('Foto grup berhasil diubah.')
        }

        // ephemeral
        const value = EPHEMERAL[(text || '').trim().toLowerCase()]
        if (value === undefined) return example('1d | 7d | 90d | off')
        await sock.groupToggleEphemeral(jid, value)
        return reply(value ? `Pesan sementara aktif (${text.trim().toLowerCase()}).` : 'Pesan sementara dimatikan.')
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['setting', 'setnamegc', 'ephemeral', 'setdescgc', 'setppgc']
handler.as = 'setnamegc'
handler.tags = ['group']
handler.group = true

export default handler
