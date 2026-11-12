//.quiz [umum|geografi|sains|sejarah|teknologi]  -> kuis pilihan ganda
//    .qa A|B|C|D   -> jawab (atau tekan tombol di bawah soal)
//    Satu soal per chat. Yang pertama menjawab benar dapat hadiah; tiap orang hanya 1x menjawab per soal.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, beri, happy } from '../../lib/engine/features.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const bacaSoal = () => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data/quiz.json'), 'utf8')) } catch { return [] }
}
const HURUF = ['A', 'B', 'C', 'D']
const sesi = (global.__quizSesi ||= new Map()) // chat -> { soal, opsi, benar, salah:Set, timer }

const acak = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    return a
}

async function selesai(conn, chat, alasan) {
    const s = sesi.get(chat)
    if (!s) return
    clearTimeout(s.timer)
    sesi.delete(chat)
    if (alasan === 'waktu') {
        await conn.sendMessage(chat, { text: `*WAKTU HABIS!*\n\nJawaban yang benar: *${HURUF[s.benar]}. ${s.opsi[s.benar]}*` }).catch(() => null)
    }
}

let handler = async (m, { conn, command, args, usedPrefix }) => {
    const c = cfg('kuis')
    const chat = m.chat

    // ───── jawab ─────
    if (/^(qa|jawabquiz|jwbquiz)$/i.test(command)) {
        const s = sesi.get(chat)
        if (!s) return m.reply(`Tidak ada kuis aktif. Mulai dengan *${usedPrefix}quiz*`)
        const idx = HURUF.indexOf(String(args[0] || '').trim().toUpperCase())
        if (idx < 0) return m.reply(`Jawab dengan huruf: *${usedPrefix}qa A* (A/B/C/D)`)
        if (s.salah.has(m.sender)) return m.reply('Kamu sudah menjawab soal ini, tunggu soal berikutnya ya~')

        if (idx !== s.benar) {
            s.salah.add(m.sender)
            return m.reply(`*Salah!* Kesempatanmu untuk soal ini sudah habis.`)
        }

        const user = global.db.data.users[m.sender]
        const got = beri(user, c.hadiah)
        const hp = happy()
        const benar = s.benar, opsi = s.opsi
        await selesai(conn, chat, 'benar')
        return conn.sendMessage(chat, {
            text: `🍓 *BENAR!* 🍓\n\n@${m.sender.split('@')[0]} menjawab *${HURUF[benar]}. ${opsi[benar]}*\n\n${got.join(' • ')}${hp.aktif ? `\n🍓 Jam Bahagia x${hp.mult}!` : ''}\n\n🍥 Lagi? ketik *${usedPrefix}quiz*`,
            mentions: [m.sender]
        }, { quoted: m })
    }

    // ───── mulai kuis ─────
    if (sesi.has(chat)) return m.reply(`Masih ada soal yang belum terjawab di chat ini! Jawab dengan *${usedPrefix}qa A/B/C/D*`)

    const semua = bacaSoal()
    if (!semua.length) return m.reply('Bank soal kosong.')
    const kat = (args[0] || '').toLowerCase()
    const daftarKat = [...new Set(semua.map((x) => x.k))]
    if (args[0] && !daftarKat.includes(kat)) return m.reply(`🍅 Kategori tidak ada.\n🍡 Pilihan: ${daftarKat.join(', ')}`)
    const pool = kat ? semua.filter((x) => x.k === kat) : semua

    const soal = pool[Math.floor(Math.random() * pool.length)]
    const benarTeks = soal.o[soal.a]
    const opsi = acak(soal.o)
    const benar = opsi.indexOf(benarTeks)

    const s = { soal, opsi, benar, salah: new Set(), timer: null }
    s.timer = setTimeout(() => selesai(conn, chat, 'waktu'), c.waktuDetik * 1000)
    s.timer.unref?.()
    sesi.set(chat, s)

    const teks = `*KUIS* • ${soal.k.toUpperCase()}\n\n${soal.q}\n\n${opsi.map((o, i) => `${['', '', '', ''][i]} *${HURUF[i]}.* ${o}`).join('\n')}\n\n Waktu ${c.waktuDetik} detik\n Jawab: *${usedPrefix}qa A* (A/B/C/D)`

    try {
        await conn.sendButtons(chat, {
            text: teks,
            footer: global.namebot || 'Kaguya',
            buttons: HURUF.map((h) => ({ type: 'reply', text: h, id: `${usedPrefix}qa ${h}` }))
        }, { quoted: m })
    } catch {
        await conn.sendMessage(chat, { text: teks }, { quoted: m })
    }
}

handler.help = ['quiz [kategori]', 'qa <A-D>']
handler.tags = ['game']
handler.command = ['quiz', 'kuis', 'qa', 'jawabquiz', 'jwbquiz']
handler.exp = 0

export default adapt(handler, { category: 'game' })
