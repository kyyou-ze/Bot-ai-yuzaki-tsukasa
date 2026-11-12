import { KODE_BAHASA } from '../../lib/core/file.js'
import { sleep } from '../../lib/core/system.js'

let handler = async (m, { reply }) => {
    await reply(KODE_BAHASA)
    await sleep(2500) // jeda agar pesan terlihat berurutan
    await reply('Kode bahasa ini dipakai untuk menentukan terjemahan dari bahasa apa ke bahasa apa. Contoh: id|en berarti dari Indonesia ke Inggris.')
}

handler.command = ['kodebahasa']
handler.help = ['kodebahasa']
handler.tags = ['tools']

export default handler
