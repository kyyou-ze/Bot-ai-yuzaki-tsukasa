import { fetchJSON, FriendlyError, guard } from '../../lib/services/scraper.js'

const BASE = 'https://data.bmkg.go.id/DataMKG/TEWS'
const SHAKEMAP = 'https://static.bmkg.go.id'

const LISTS = {
    m5: { file: 'gempaterkini.json', title: 'GEMPA M 5.0+ (15 TERAKHIR)' },
    dirasakan: { file: 'gempadirasakan.json', title: 'GEMPA DIRASAKAN (15 TERAKHIR)' }
}

const show = (v, fallback = '-') => (v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim())

let handler = guard(async (m, { sock, text, reply }) => {
    const arg = String(text || '').trim().toLowerCase()

    // daftar gempa (m5 / dirasakan)
    if (arg) {
        const key = arg.replace(/\s+/g, '')
        const list = LISTS[key === 'm5.0' || key === 'm5+' ? 'm5' : key]
        if (!list) return reply('Pilihan tidak dikenal.\n\nGunakan:\n- cekgempa (gempa terbaru)\n- cekgempa m5\n- cekgempa dirasakan')

        const json = await fetchJSON(`${BASE}/${list.file}`)
        const data = json?.Infogempa?.gempa
        const items = Array.isArray(data) ? data : (data ? [data] : [])
        if (!items.length) throw new FriendlyError('Data gempa belum tersedia dari BMKG.')

        const lines = items.slice(0, 15).map((g, i) =>
            `${i + 1}. M ${show(g.Magnitude)} | ${show(g.Tanggal)} ${show(g.Jam)}\n    ${show(g.Wilayah)}`
        )
        return reply(`🌋 *${list.title}*\n\n${lines.join('\n')}\n\n_Sumber: BMKG_`)
    }

    // gempa terbaru
    const json = await fetchJSON(`${BASE}/autogempa.json`)
    const g = json?.Infogempa?.gempa
    if (!g || typeof g !== 'object') throw new FriendlyError('Data gempa belum tersedia dari BMKG.')

    const caption =
        `🌋 *GEMPA TERBARU*\n\n` +
        `Waktu       : ${show(g.Tanggal)} ${show(g.Jam)}\n` +
        `Magnitudo   : ${show(g.Magnitude)}\n` +
        `Kedalaman   : ${show(g.Kedalaman)}\n` +
        `Lokasi      : ${show(g.Wilayah)}\n` +
        `Koordinat   : ${show(g.Lintang)}, ${show(g.Bujur)}\n` +
        `Potensi     : ${show(g.Potensi)}\n` +
        `Dirasakan   : ${show(g.Dirasakan)}\n\n` +
        `_Sumber: BMKG_`

    const shakemap = show(g.Shakemap, '')
    if (shakemap) {
        try {
            await sock.sendMessage(m.chat, { image: { url: `${SHAKEMAP}/${shakemap}` }, caption }, { quoted: m })
            return
        } catch {
            // gambar gagal dikirim -> kirim teks saja
        }
    }
    return reply(caption)
})

handler.command = ['cekgempa']
handler.help = ['cekgempa']
handler.tags = ['search']

export default handler
