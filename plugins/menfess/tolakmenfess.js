// .tolakmenfess   tolak semua menfess / buka kembali
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, store } from '../../lib/engine/features.js'

let handler = async (m) => {
    const c = cfg('menfess')
    const k = store()
    if (!c.on) return m.reply('Fitur menfess sedang dimatikan.')
    const aktif = !k.menfessBlock[m.sender]
    k.menfessBlock[m.sender] = aktif
    if (!aktif) delete k.menfessBlock[m.sender]
    global.db.kaguya = k
    return m.reply(aktif
        ? 'Oke, kamu tidak akan menerima menfess lagi.\nKetik perintah yang sama untuk membukanya kembali.'
        : 'Menfess untukmu dibuka lagi~')
}

handler.help = ['tolakmenfess']
handler.tags = ['menfess']
handler.command = ['tolakmenfess']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
