// Kalkulator umur (gaya umurku.com): umur tepat, hari lahir, zodiak, total hari/jam/menit/detik, ulang tahun berikutnya
//   .umurku 2000-05-15
//   .umurku 15/05/2000
//   .umurku 15-05-2000 31/12/2030     (opsional: tanggal acuan)
import { reactTo } from '../../lib/core/file.js'

const LINE = '─────────────────────'
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const ZODIAK = [
    ['Capricorn ♑', 12, 22, 1, 19], ['Aquarius ♒', 1, 20, 2, 18], ['Pisces ♓', 2, 19, 3, 20], ['Aries ♈', 3, 21, 4, 19],
    ['Taurus ♉', 4, 20, 5, 20], ['Gemini ♊', 5, 21, 6, 20], ['Cancer ♋', 6, 21, 7, 22], ['Leo ♌', 7, 23, 8, 22],
    ['Virgo ♍', 8, 23, 9, 22], ['Libra ♎', 9, 23, 10, 22], ['Scorpio ♏', 10, 23, 11, 21], ['Sagittarius ♐', 11, 22, 12, 21]
]

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()               // m = 1..12
const fmt = (d) => `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
const nf = (n) => Number(n).toLocaleString('id-ID')

// Hasil dalam UTC-midnight supaya bebas masalah zona waktu / DST
function parseDate(input) {
    input = String(input || '').trim()
    let y, m, d, r
    if ((r = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [y, m, d] = r.slice(1).map(Number)
    else if ((r = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, m, y] = r.slice(1).map(Number)
    else throw new Error('Format tanggal tidak dikenali. Gunakan YYYY-MM-DD atau DD/MM/YYYY')
    const dt = new Date(Date.UTC(y, m - 1, d))
    if (m < 1 || m > 12 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error('Tanggal tidak valid')
    return dt
}

function todayWIB() {
    const n = new Date(Date.now() + 7 * 3600e3)
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

function zodiac(month, day) {
    for (const [name, sm, sd, em, ed] of ZODIAK) if ((month === sm && day >= sd) || (month === em && day <= ed)) return name
    return ZODIAK[0][0]
}

export function hitungUmur(lahirInput, acuanInput) {
    const lahir = parseDate(lahirInput)
    const acuan = acuanInput ? parseDate(acuanInput) : todayWIB()
    if (acuan < lahir) throw new Error('Tanggal lahir tidak boleh melebihi tanggal acuan!')

    // tahun & bulan penuh, lalu sisa hari dihitung dari titik "lahir + N tahun M bulan" (aman untuk tgl 29-31)
    let tahun = acuan.getUTCFullYear() - lahir.getUTCFullYear()
    let bulan = acuan.getUTCMonth() - lahir.getUTCMonth()
    if (acuan.getUTCDate() < lahir.getUTCDate()) bulan--
    if (bulan < 0) { tahun--; bulan += 12 }
    const totalBln = lahir.getUTCMonth() + bulan
    const ay = lahir.getUTCFullYear() + tahun + Math.floor(totalBln / 12), am = totalBln % 12 + 1
    const anchor = new Date(Date.UTC(ay, am - 1, Math.min(lahir.getUTCDate(), daysIn(ay, am))))
    const hari = Math.max(0, Math.round((acuan - anchor) / 86400000))

    const totalHari = Math.round((acuan - lahir) / 86400000)

    // Ulang tahun berikutnya (29 Feb → 28 Feb di tahun bukan kabisat)
    const bd = lahir.getUTCDate(), bm = lahir.getUTCMonth()
    const at = (y) => new Date(Date.UTC(y, bm, bm === 1 && bd === 29 && daysIn(y, 2) === 28 ? 28 : bd))
    let next = at(acuan.getUTCFullYear())
    if (next < acuan) next = at(acuan.getUTCFullYear() + 1)
    const sisa = Math.round((next - acuan) / 86400000)

    return {
        tanggal_lahir: fmt(lahir), hari_lahir: HARI[lahir.getUTCDay()], zodiak: zodiac(bm + 1, bd), tanggal_acuan: fmt(acuan),
        umur: { tahun, bulan, hari },
        total: { bulan: tahun * 12 + bulan, minggu: Math.floor(totalHari / 7), hari: totalHari, jam: totalHari * 24, menit: totalHari * 1440, detik: totalHari * 86400 },
        ulang_tahun_berikutnya: { tanggal: fmt(next), hari_lahir: HARI[next.getUTCDay()], sisa_hari: sisa, ke: next.getUTCFullYear() - lahir.getUTCFullYear() }
    }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    if (!args.length) {
        return reply(`*🎂 HITUNG UMUR*\n${LINE}\n${prefix}${command} 2000-05-15\n${prefix}${command} 15/05/2000\n${prefix}${command} 15-05-2000 31/12/2030  _(tanggal acuan opsional)_\n\nFormat: YYYY-MM-DD atau DD/MM/YYYY`)
    }
    try {
        await reactTo(sock, m, '⏳')
        const r = hitungUmur(args[0], args[1])
        const ult = r.ulang_tahun_berikutnya
        await reply([
            `*🎂 HITUNG UMUR*`, LINE,
            `Lahir   : ${r.hari_lahir}, ${r.tanggal_lahir}`,
            `Zodiak  : ${r.zodiak}`,
            `Acuan   : ${r.tanggal_acuan}`, '',
            `*Umur*`, `${r.umur.tahun} Tahun, ${r.umur.bulan} Bulan, ${r.umur.hari} Hari`, '',
            `*Total hidup*`,
            `• ${nf(r.total.bulan)} bulan`, `• ${nf(r.total.minggu)} minggu`, `• ${nf(r.total.hari)} hari`,
            `• ${nf(r.total.jam)} jam`, `• ${nf(r.total.menit)} menit`, `• ${nf(r.total.detik)} detik`, '',
            `*Ulang tahun ke-${ult.ke}*`,
            ult.sisa_hari === 0 ? `🎉 Hari ini! Selamat ulang tahun!` : `${ult.hari_lahir}, ${ult.tanggal} — *${nf(ult.sisa_hari)} hari lagi*`
        ].join('\n'))
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message}`)
    }
}

handler.command = ['umurku']
handler.help = ['umurku <tanggal-lahir>']
handler.tags = ['fun']

export default handler
