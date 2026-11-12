// (owner) .banmenfess nomor [alasan] · .unbanmenfess nomor · .listbanmenfess · .statmenfess
import { adapt } from '../../lib/engine/plugins.js'
import { store, menfessNomor, wibDay } from '../../lib/engine/features.js'

let handler = async (m, { command, text, usedPrefix }) => {
    const k = store()
    if (command === 'statmenfess') {
        const semua = Object.values(k.menfess)
        const hari = wibDay()
        const laporan = Object.values(k.menfessLapor).reduce((a, v) => a + v.n, 0)
        return m.reply(`📊 *STATISTIK MENFESS*\n\nTersimpan : ${semua.length}\nHari ini  : ${semua.filter((d) => wibDay(d.t) === hari).length}\nDitarik   : ${semua.filter((d) => d.tutup).length}\nDilaporkan: ${semua.filter((d) => d.dilapor).length} (total laporan ${laporan})\nDiban     : ${Object.keys(k.menfessBan).length}\nMenolak semua: ${Object.keys(k.menfessBlock).length} user`)
    }
    if (command === 'listbanmenfess') {
        const list = Object.entries(k.menfessBan)
        if (!list.length) return m.reply('Tidak ada user yang diban dari menfess.')
        return m.reply(`⛔ *BAN MENFESS* (${list.length})\n\n` + list.map(([j, v]) => `• ${j.split('@')[0]} — ${v.alasan || '-'} (${v.oleh || 'owner'})`).join('\n'))
    }
    const [no, ...sisa] = String(text || '').trim().split(/\s+/)
    const n = menfessNomor(no)
    if (!n || n.length < 9) return m.reply(`Format: *${usedPrefix}${command} nomor${command === 'banmenfess' ? ' alasan' : ''}*`)
    const jid = `${n}@s.whatsapp.net`
    if (command === 'banmenfess') {
        k.menfessBan[jid] = { t: Date.now(), alasan: sisa.join(' ').trim(), oleh: 'owner' }
        global.db.kaguya = k
        return m.reply(`⛔ ${n} dilarang memakai menfess.`)
    }
    if (!k.menfessBan[jid]) return m.reply('Nomor itu tidak sedang diban.')
    delete k.menfessBan[jid]
    delete k.menfessLapor[jid]
    global.db.kaguya = k
    return m.reply(`✅ Ban menfess ${n} dicabut (hitungan laporannya direset).`)
}

handler.help = ['banmenfess nomor alasan', 'unbanmenfess nomor', 'listbanmenfess', 'statmenfess']
handler.tags = ['menfess']
handler.command = ['banmenfess', 'unbanmenfess', 'listbanmenfess', 'statmenfess']
handler.owner = true
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
