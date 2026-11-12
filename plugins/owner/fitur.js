// .fitur  -> status semua fitur tambahan. Diatur lewat tombol di .setfitur. Khusus owner.
import { statusFitur, startFitur } from '../../lib/engine/features.js'

startFitur()

let handler = async (m, { reply, prefix }) => {
    return reply(`⚙️ *STATUS FITUR*\n\n${statusFitur()}\n\nAtur lewat tombol: *${prefix || '.'}setfitur*\nAuto backup: *${prefix || '.'}setbackup*`)
}

handler.help = ['fitur']
handler.tags = ['owner']
handler.command = ['fitur']
handler.owner = true

export default handler
