// .cekmenfess ID   (owner) lihat pengirim + isi percakapan kalau ada penyalahgunaan
import { adapt } from '../../lib/engine/plugins.js'
import { store } from '../../lib/engine/features.js'

let handler = async (m, { text }) => {
    const k = store()
    const id = String(text || '').trim().toUpperCase()
    const d = k.menfess[id]
    if (!d) return m.reply('ID menfess tidak ditemukan.')
    const w = (t) => new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    const log = (d.log || [{ by: 'a', t: d.t, pesan: d.pesan }]).map((x) => `[${w(x.t)}] ${x.by === 'a' ? 'Pengirim' : 'Penerima'}: ${x.pesan}`).join('\n')
    return m.reply(`🍰 *MENFESS ${id}*\n\nDari : ${d.from.split('@')[0]}\nKe   : ${d.to.split('@')[0]}\nWaktu: ${w(d.t)}\nStatus: ${d.tutup ? 'ditarik' : 'aktif'}${d.dilapor ? ' · dilaporkan' : ''}${d.terungkap ? ' · identitas diungkap' : ''}\n\n${log}`)
}

handler.help = ['cekmenfess ID']
handler.tags = ['menfess']
handler.command = ['cekmenfess']
handler.owner = true
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
