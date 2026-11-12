import {
    FriendlyError, fetchJSON, guard, titleCase, bestMatches,
    getAllRegencies, getDistricts, getVillages
} from '../../lib/services/scraper.js'

const BMKG = 'https://api.bmkg.go.id/publik/prakiraan-cuaca'
const ADM4 = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/
const STEPS = 4 // jumlah jam prakiraan yang ditampilkan (per 3 jam)

const num = (v) => (v === undefined || v === null || v === '' ? '-' : v)

// Ubah masukan pengguna menjadi kode wilayah tingkat IV (kelurahan/desa)
async function resolve(input) {
    const raw = input.trim()
    if (ADM4.test(raw)) return { code: raw, guessed: false }

    const [kota, kec, kel] = raw.split('|').map(s => s.trim())
    const regs = bestMatches(await getAllRegencies(), kota)
    if (!regs.length) throw new FriendlyError(`Kabupaten/kota *${kota}* tidak ditemukan.\n\nContoh: cuaca bandung, cuaca kota bogor|bogor barat`)
    if (regs.length > 1) {
        throw new FriendlyError(`Ada beberapa wilayah bernama *${kota}*, tulis lebih spesifik:\n\n${regs.slice(0, 8).map(r => `- ${titleCase(r.name)}`).join('\n')}`)
    }

    const districts = await getDistricts(regs[0].code)
    if (!districts.length) throw new FriendlyError('Data kecamatan belum tersedia untuk wilayah ini.')
    let dist = districts[0]
    if (kec) {
        dist = bestMatches(districts, kec)[0]
        if (!dist) throw new FriendlyError(`Kecamatan *${kec}* tidak ditemukan di ${titleCase(regs[0].name)}.`)
    }

    const villages = await getVillages(dist.code)
    if (!villages.length) throw new FriendlyError('Data kelurahan/desa belum tersedia untuk kecamatan ini.')
    let vil = villages[0]
    if (kel) {
        vil = bestMatches(villages, kel)[0]
        if (!vil) throw new FriendlyError(`Kelurahan/desa *${kel}* tidak ditemukan di kecamatan ${titleCase(dist.name)}.`)
    }

    return { code: vil.code, guessed: !kec || !kel }
}

const toTime = (entry) => {
    const t = Date.parse(String(entry?.utc_datetime || '').replace(' ', 'T') + 'Z')
    return Number.isFinite(t) ? t : NaN
}

let handler = guard(async (m, { text, reply, example }) => {
    if (!String(text || '').trim()) return example('bandung  (atau: kota bogor|bogor barat|menteng)')

    const { code, guessed } = await resolve(text)

    let json
    try {
        json = await fetchJSON(`${BMKG}?adm4=${encodeURIComponent(code)}`)
    } catch (e) {
        if (e.status === 404 || e.status === 400) {
            throw new FriendlyError('BMKG belum punya prakiraan untuk lokasi ini. Coba kelurahan atau kecamatan lain:\ncuaca kota|kecamatan|kelurahan')
        }
        throw e
    }

    const item = Array.isArray(json?.data) ? json.data[0] : json
    const lokasi = item?.lokasi || json?.lokasi || {}
    const entries = (Array.isArray(item?.cuaca) ? item.cuaca : []).flat(2).filter(e => e && typeof e === 'object')
    if (!entries.length) throw new FriendlyError('Prakiraan cuaca untuk lokasi ini belum tersedia dari BMKG.')

    // mulai dari prakiraan yang waktunya paling dekat dengan sekarang
    const now = Date.now()
    let start = 0
    let best = Infinity
    entries.forEach((e, i) => {
        const t = toTime(e)
        if (Number.isFinite(t) && Math.abs(t - now) < best) { best = Math.abs(t - now); start = i }
    })
    const slice = entries.slice(start, start + STEPS)
    const first = slice[0]

    const place = [lokasi.desa, lokasi.kecamatan, lokasi.kotkab, lokasi.provinsi].filter(Boolean).join(', ')
    const lines = slice.map(e => {
        const dt = String(e.local_datetime || '')
        const jam = dt.length >= 16 ? `${dt.slice(8, 10)}/${dt.slice(5, 7)} ${dt.slice(11, 16)}` : '-'
        return `${jam}  ${num(e.weather_desc)}, ${num(e.t)}°C, lembap ${num(e.hu)}%, angin ${num(e.ws)} km/j`
    })

    return reply(
        `🌤️ *CUACA*\n${place || code}\n\n` +
        `*Sekarang (perkiraan)*\n` +
        `${num(first.weather_desc)}\n` +
        `Suhu ${num(first.t)}°C | Lembap ${num(first.hu)}% | Angin ${num(first.ws)} km/jam${first.wd ? ` dari ${first.wd}` : ''}\n\n` +
        `*Prakiraan (per 3 jam, waktu setempat)*\n${lines.join('\n')}` +
        (guessed ? `\n\n_Lokasi dipilih otomatis. Untuk lebih tepat: cuaca kota|kecamatan|kelurahan_` : '') +
        `\n\n_Sumber: BMKG_`
    )
})

handler.command = ['cuaca']
handler.help = ['cuaca']
handler.tags = ['tools']

export default handler
