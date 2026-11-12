// .samaranmenfess nama   atur nama samaran yang tampil di menfess-mu ("Seseorang" kalau kosong)
import { adapt } from '../../lib/engine/plugins.js'
import { menfessIsi, cfg } from '../../lib/engine/features.js'

let handler = async (m, { text, usedPrefix }) => {
    const user = global.db.data.users[m.sender]
    const nama = String(text || '').trim()
    if (!nama) return m.reply(`Samaran saat ini: *${user.menfessNama || 'Seseorang'}*\n\nUbah: *${usedPrefix}samaranmenfess Bintang Malam*\nHapus: *${usedPrefix}samaranmenfess hapus*`)
    if (/^(hapus|reset|off)$/i.test(nama)) {
        delete user.menfessNama
        return m.reply('Samaran dihapus, menfess-mu tampil sebagai *Seseorang*.')
    }
    if (nama.length > 20) return m.reply('Samaran maksimal 20 karakter.')
    if (/[*_~`\n]/.test(nama)) return m.reply('Samaran tidak boleh memakai karakter format (* _ ~ `).')
    const salah = menfessIsi(nama, { ...cfg('menfess'), maxPanjang: 20 })
    if (salah) return m.reply(salah)
    user.menfessNama = nama
    return m.reply(`✅ Samaran diatur: *${nama}*\nMenfess berikutnya tampil dari *${nama}* (identitas aslimu tetap tersembunyi).`)
}

handler.help = ['samaranmenfess nama']
handler.tags = ['menfess']
handler.command = ['samaranmenfess', 'setsamaran']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
