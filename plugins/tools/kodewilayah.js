import {
    FriendlyError, guard, titleCase, bestMatches,
    getProvinces, getAllRegencies, getDistricts, getVillages
} from '../../lib/services/scraper.js'

const MAX_LIST = 40

const fmt = (x) => `${x.code}  ${titleCase(x.name)}`

function more(total) {
    return total > MAX_LIST ? `\n...dan ${total - MAX_LIST} lainnya` : ''
}

// "kota|kecamatan"  -> daftar kelurahan/desa
// "nama"            -> cari provinsi + kabupaten/kota, kalau hasilnya satu tampilkan kecamatannya
let handler = guard(async (m, { text, reply, example }) => {
    const input = String(text || '').trim()
    if (!input) return example('bogor  (atau: kota bogor|bogor barat)')

    const parts = input.split('|').map(s => s.trim()).filter(Boolean)
    const regencies = await getAllRegencies()

    // ── kota|kecamatan → kelurahan/desa ──
    if (parts.length >= 2) {
        const regs = bestMatches(regencies, parts[0])
        if (!regs.length) return reply(`Kabupaten/kota *${parts[0]}* tidak ditemukan.`)
        if (regs.length > 1) {
            return reply(`Ada beberapa kabupaten/kota bernama *${parts[0]}*, tulis lebih spesifik:\n\n${regs.slice(0, 10).map(fmt).join('\n')}`)
        }

        const reg = regs[0]
        const districts = await getDistricts(reg.code)
        const dis = bestMatches(districts, parts[1])
        if (!dis.length) return reply(`Kecamatan *${parts[1]}* tidak ditemukan di ${titleCase(reg.name)}.`)

        const dist = dis[0]
        const villages = await getVillages(dist.code)
        if (!villages.length) throw new FriendlyError('Data kelurahan/desa untuk kecamatan ini belum tersedia.')

        return reply(
            `📍 *KELURAHAN / DESA*\n` +
            `${titleCase(dist.name)}, ${titleCase(reg.name)}\n` +
            `Kode kecamatan: ${dist.code}\n\n` +
            villages.slice(0, MAX_LIST).map(fmt).join('\n') + more(villages.length) +
            `\n\n_Sumber: data wilayah Kemendagri_`
        )
    }

    // ── nama → provinsi + kabupaten/kota ──
    const provinces = await getProvinces()
    const provHit = bestMatches(provinces, input).slice(0, 5)
    const regHit = bestMatches(regencies, input)

    if (!provHit.length && !regHit.length) {
        return reply(`Wilayah *${input}* tidak ditemukan.\n\nContoh: kodewilayah jawa barat, kodewilayah kota bandung`)
    }

    const out = []
    if (provHit.length) out.push(`*Provinsi*\n${provHit.map(fmt).join('\n')}`)
    if (regHit.length) {
        out.push(`*Kabupaten / Kota*\n${regHit.slice(0, MAX_LIST).map(fmt).join('\n')}${more(regHit.length)}`)
    }

    // satu kabupaten/kota saja → tampilkan juga kecamatannya
    if (regHit.length === 1) {
        const districts = await getDistricts(regHit[0].code).catch(() => [])
        if (districts.length) {
            out.push(`*Kecamatan di ${titleCase(regHit[0].name)}*\n${districts.slice(0, MAX_LIST).map(fmt).join('\n')}${more(districts.length)}`)
            out.push(`_Untuk daftar kelurahan: kodewilayah ${input}|nama kecamatan_`)
        }
    }

    return reply(`📍 *KODE WILAYAH*\n\n${out.join('\n\n')}\n\n_Sumber: data wilayah Kemendagri_`)
})

handler.command = ['kodewilayah']
handler.help = ['kodewilayah']
handler.tags = ['tools']

export default handler
