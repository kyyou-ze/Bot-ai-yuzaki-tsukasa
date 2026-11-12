// 🔮 .ramalan [zodiak]  -> ramalan harian lucu (hiburan). Hasil sama sepanjang hari untuk zodiak yang sama.
//    Tanpa zodiak: pakai tanggal lahir di profil (.setbirthday), kalau belum ada ketik zodiaknya.
import crypto from 'crypto'
import { adapt } from '../../lib/engine/plugins.js'
import { wibDay, wibDate } from '../../lib/engine/features.js'

const ZODIAK = [
    { n: 'capricorn', nama: 'Capricorn', e: '🐐', a: [12, 22], b: [1, 19] },
    { n: 'aquarius', nama: 'Aquarius', e: '🏺', a: [1, 20], b: [2, 18] },
    { n: 'pisces', nama: 'Pisces', e: '🐟', a: [2, 19], b: [3, 20] },
    { n: 'aries', nama: 'Aries', e: '🐏', a: [3, 21], b: [4, 19] },
    { n: 'taurus', nama: 'Taurus', e: '🐂', a: [4, 20], b: [5, 20] },
    { n: 'gemini', nama: 'Gemini', e: '👯', a: [5, 21], b: [6, 20] },
    { n: 'cancer', nama: 'Cancer', e: '🦀', a: [6, 21], b: [7, 22] },
    { n: 'leo', nama: 'Leo', e: '🦁', a: [7, 23], b: [8, 22] },
    { n: 'virgo', nama: 'Virgo', e: '🌾', a: [8, 23], b: [9, 22] },
    { n: 'libra', nama: 'Libra', e: '⚖️', a: [9, 23], b: [10, 22] },
    { n: 'scorpio', nama: 'Scorpio', e: '🦂', a: [10, 23], b: [11, 21] },
    { n: 'sagitarius', nama: 'Sagitarius', e: '🏹', a: [11, 22], b: [12, 21] }
]
const ALIAS = { sagittarius: 'sagitarius', sagitarious: 'sagitarius', kambing: 'capricorn', aquarious: 'aquarius' }

const CINTA = [
    'Ada yang diam-diam memperhatikanmu hari ini, mungkin dari grup chat yang sama.',
    'Jangan gengsi membalas pesan duluan, hasilnya bisa manis.',
    'Pasangan atau gebetan sedang butuh didengarkan, bukan dinasihati.',
    'Hati-hati salah kirim stiker, bisa jadi bahan obrolan panjang.',
    'Hubunganmu hangat seperti es teh yang belum sempat dingin: enak, asal cepat diminum.',
    'Yang lama tak kabar mungkin muncul. Tenang, balas seperlunya saja.',
    'Sendiri bukan masalah. Hari ini kamu justru lebih nyaman dengan dirimu sendiri.',
    'Ungkapkan perasaan dengan jelas, jangan lewat kode-kodean yang bikin lelah.'
]
const KARIR = [
    'Ide kecil yang kamu simpan kemarin ternyata layak dicoba hari ini.',
    'Kerjakan yang paling malas dulu, sisanya akan terasa ringan.',
    'Atasan atau dosen sedang dalam mood bagus, manfaatkan untuk bertanya.',
    'Fokus satu tugas satu waktu. Multitasking hari ini cuma bikin pusing.',
    'Rekan kerja akan menawarkan bantuan. Terima saja, jangan sok kuat.',
    'Deadline terasa dekat, tapi kamu lebih siap dari yang kamu kira.',
    'Hari yang pas untuk belajar skill baru, sepuluh menit pun cukup.',
    'Hindari debat kusir di grup kerja. Menang debat tidak menambah gaji.'
]
const UANG = [
    'Pengeluaran kecil yang tak terasa mulai menumpuk. Cek dompet digitalmu.',
    'Ada rezeki tak terduga, mungkin bentuknya traktiran, mungkin diskon.',
    'Tahan dulu belanja impulsif, keranjang belanja bisa menunggu sampai besok.',
    'Menabung 10 ribu hari ini lebih baik daripada berniat 1 juta bulan depan.',
    'Hati-hati pinjam-meminjam, ingatkan dengan sopan kalau ada yang lupa.',
    'Peluang tambahan penghasilan datang dari hobi yang selama ini kamu remehkan.',
    'Hari ini aman untuk membeli yang benar-benar dibutuhkan, bukan yang sekadar lucu.',
    'Bayar tagihan lebih awal, hatimu akan lebih tenang.'
]
const SEHAT = [
    'Minum air putih lebih banyak, badanmu sedang minta tolong.',
    'Tidur lebih awal malam ini, begadang hanya menang di notifikasi.',
    'Jalan kaki sebentar, kepalamu butuh udara segar.',
    'Kurangi kopi dan camilan manis, perutmu sedang sensitif.',
    'Regangkan badan tiap satu jam. Punggungmu akan berterima kasih.',
    'Energi sedang penuh, sayang kalau dihabiskan untuk rebahan seharian.',
    'Istirahatkan mata dari layar sejenak, dua puluh detik pun berarti.',
    'Badan fit, mood mudah naik turun. Dengarkan musik kesukaanmu.'
]
const NASIHAT = [
    'Bernapas dulu sebelum membalas pesan yang bikin kesal.',
    'Tidak semua hal perlu diselesaikan hari ini.',
    'Kamu sudah melakukan banyak hal, jangan lupa bangga pada dirimu.',
    'Langkah kecil yang konsisten mengalahkan lompatan besar yang sekali saja.',
    'Beri dirimu izin untuk istirahat tanpa rasa bersalah.',
    'Senyum kecil hari ini bisa menular lebih jauh dari yang kamu kira.',
    'Jangan bandingkan bab satumu dengan bab sepuluh orang lain.',
    'Kalau ragu, pilih yang membuat tidurmu nyenyak.'
]
const WARNA = ['Merah muda', 'Putih', 'Biru langit', 'Hijau mint', 'Ungu lavender', 'Kuning pastel', 'Oranye', 'Hitam', 'Krem', 'Merah maroon']
const JAM = ['06.00', '08.30', '10.15', '12.00', '13.45', '15.30', '17.00', '19.15', '20.45', '22.00']

// PRNG deterministik dari seed teks
function seeded(seed) {
    let h = crypto.createHash('sha256').update(seed).digest()
    let i = 0
    return (n) => {
        if (i + 4 > h.length) { h = crypto.createHash('sha256').update(h).digest(); i = 0 }
        const v = h.readUInt32BE(i); i += 4
        return v % n
    }
}

const bintang = (n) => ''.repeat(n) + '🤍'.repeat(5 - n)

function cariZodiak(input) {
    let s = String(input || '').toLowerCase().trim()
    s = ALIAS[s] || s
    return ZODIAK.find((z) => z.n === s)
}

function dariTanggal(d, bln) {
    return ZODIAK.find((z) => (bln === z.a[0] && d >= z.a[1]) || (bln === z.b[0] && d <= z.b[1]))
}

let handler = async (m, { args, usedPrefix, command }) => {
    let z = cariZodiak(args[0])
    if (!z && !args[0]) {
        const lahir = global.db.data.users[m.sender]?.birthday // format d-m-yyyy
        const [d, bln] = String(lahir || '').split('-').map(Number)
        if (d && bln) z = dariTanggal(d, bln)
    }
    if (!z) {
        return m.reply(`🔮 *RAMALAN HARIAN* 🔮\n\nKetik zodiakmu:\n${usedPrefix}${command} leo\n\n Daftar: ${ZODIAK.map((x) => x.n).join(', ')}\n Tidak tahu zodiakmu? Cek dengan ${usedPrefix}zodiak`)
    }

    const hari = wibDay()
    const r = seeded(`${hari}|${z.n}`)
    const skor = { cinta: r(5) + 1, karir: r(5) + 1, uang: r(5) + 1, sehat: r(5) + 1 }
    const umum = Math.round((skor.cinta + skor.karir + skor.uang + skor.sehat) / 4)
    const tanggal = wibDate().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

    await m.reply([
        `${z.e} *RAMALAN ${z.nama.toUpperCase()}* ${z.e}`,
        `${tanggal}`,
        '',
        `Keberuntungan: ${bintang(umum)}`,
        '',
        `*Cinta* ${bintang(skor.cinta)}\n${CINTA[r(CINTA.length)]}`,
        '',
        `💼 *Karier* ${bintang(skor.karir)}\n${KARIR[r(KARIR.length)]}`,
        '',
        `💹 *Keuangan* ${bintang(skor.uang)}\n${UANG[r(UANG.length)]}`,
        '',
        `*Kesehatan* ${bintang(skor.sehat)}\n${SEHAT[r(SEHAT.length)]}`,
        '',
        `Angka hoki: *${r(10)}${r(10)}* & *${r(90) + 10}*`,
        `🎨 Warna hoki: *${WARNA[r(WARNA.length)]}*`,
        `⏰ Jam hoki: *${JAM[r(JAM.length)]}* WIB`,
        '',
        `_${NASIHAT[r(NASIHAT.length)]}_`,
        '',
        'Ramalan ini hanya hiburan ya~'
    ].join('\n'))
}

handler.help = ['ramalan [zodiak]']
handler.tags = ['fun']
handler.command = ['ramalan']
handler.exp = 0

export default adapt(handler, { category: 'fun' })
