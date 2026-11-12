import { updateConfigValue } from '../../lib/core/file.js'

let handler = async (m, { command, text, reply, example }) => {
    if (!text) return example('Nama Baru')

    if (command === 'setnamaowner') {
        global.ownername = text.trim()
        updateConfigValue('ownername', text.trim())
        return reply(`Nama owner berhasil diubah jadi *${text.trim()}*.`)
    }

    if (command === 'setnamabot') {
        global.namebot = text.trim()
        updateConfigValue('namebot', text.trim())
        return reply(`Nama bot berhasil diubah jadi *${text.trim()}*.`)
    }
}

handler.command = ['setconfig', 'setnamaowner', 'setnamabot']
handler.as = 'setnamaowner'
handler.tags = ['owner']
handler.owner = true

export default handler
