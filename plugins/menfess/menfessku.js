// .menfessku (ringkasan & kuota) · .inboxmenfess (diterima) · .outboxmenfess (terkirim)
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, store, menfessAktif, wibDay } from '../../lib/engine/features.js'

const waktu = (t) => new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const potong = (s, n = 35) => (String(s).length > n ? String(s).slice(0, n) + '…' : String(s))
const status = (d, c) => (d.tutup ? '🗑 ditarik' : menfessAktif(d, c) ? '🟢 aktif' : '⏳ kedaluwarsa')

let handler = async (m, { command, usedPrefix }) => {
    const c = cfg('menfess')
    const k = store()
    const user = global.db.data.users[m.sender]
    const masuk = Object.entries(k.menfess).filter(([, d]) => d.to === m.sender).sort((a, b) => (b[1].last || b[1].t) - (a[1].last || a[1].t))
    const keluar = Object.entries(k.menfess).filter(([, d]) => d.from === m.sender).sort((a, b) => (b[1].last || b[1].t) - (a[1].last || a[1].t))

    if (command === 'inboxmenfess' || command === 'outboxmenfess') {
        const inbox = command === 'inboxmenfess'
        const list = (inbox ? masuk : keluar).slice(0, 10)
        if (!list.length) return m.reply(inbox ? 'Belum ada menfess masuk.' : 'Kamu belum pernah mengirim menfess.')
        const baris = list.map(([id, d]) => `• *#${id}* · ${waktu(d.last || d.t)} · ${(d.log || [1]).length} pesan · ${status(d, c)}\n  “${potong(d.pesan)}”`)
        return m.reply(`💌 *${inbox ? 'MENFESS MASUK' : 'MENFESS TERKIRIM'}* (${list.length} terbaru)\n\n${baris.join('\n')}\n\n${inbox ? `Balas: reply pesan menfess-nya\nBlok: ${usedPrefix}blokmenfess ID · Lapor: ${usedPrefix}lapormenfess ID alasan` : `Tarik: ${usedPrefix}tarikmenfess ID · Ungkap diri: ${usedPrefix}ungkapmenfess ID`}`)
    }

    const l = user.menfessLog?.day === wibDay() ? user.menfessLog : { n: 0, nb: 0 }
    const diblok = Object.keys(k.menfessPair).filter((x) => x.startsWith(m.sender + '|')).length
    return m.reply(`💌 *MENFESSKU*

👤 Samaran : ${user.menfessNama || 'Seseorang'}
📨 Kirim hari ini : ${l.n || 0}/${c.maxPerHari}
💬 Balasan hari ini : ${l.nb || 0}/${c.maxBalasPerHari}
📥 Menerima menfess : ${k.menfessBlock[m.sender] ? 'ditolak ⛔' : 'terbuka ✅'}
🚫 Pengirim diblok : ${diblok}
🗂 Masuk ${masuk.length} · Terkirim ${keluar.length}${k.menfessBan[m.sender] ? '\n⛔ Kamu sedang dilarang memakai menfess' : ''}

*Perintah*
• ${usedPrefix}menfess nomor|pesan
• Balas: reply pesan menfess lalu tulis balasanmu
• ${usedPrefix}inboxmenfess · ${usedPrefix}outboxmenfess
• ${usedPrefix}samaranmenfess nama
• ${usedPrefix}tarikmenfess ID · ${usedPrefix}ungkapmenfess ID
• ${usedPrefix}blokmenfess · ${usedPrefix}lapormenfess · ${usedPrefix}tolakmenfess`)
}

handler.help = ['menfessku', 'inboxmenfess', 'outboxmenfess']
handler.tags = ['menfess']
handler.command = ['menfessku', 'inboxmenfess', 'outboxmenfess']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
