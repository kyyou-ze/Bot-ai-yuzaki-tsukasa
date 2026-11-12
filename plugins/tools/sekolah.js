const API_URL =
    'https://sekolah.data.kemendikdasmen.go.id/v1/sekolah-service/sekolah/cari-sekolah'

async function cariSekolah(keyword, options = {}) {
    const payload = {
        page: options.page || 0,
        size: options.limit || 12,
        keyword,
        kabupaten_kota: options.kabupatenKota || '',
        bentuk_pendidikan: options.bentukPendidikan || '',
        status_sekolah: options.statusSekolah || ''
    }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent':
                'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
            'Referer':
                `https://sekolah.data.kemendikdasmen.go.id/sekolah?keyword=${encodeURIComponent(keyword)}`
        },
        body: JSON.stringify(payload)
    })

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
    }

    const json = await res.json()

    if (json.status_code && json.status_code !== 200) {
        throw new Error(
            json.message || 'Gagal mengambil data sekolah.'
        )
    }

    const items = Array.isArray(json.data)
        ? json.data
        : []

    return {
        total: json.total || 0,
        count: items.length,
        sekolah: items.map(s => ({
            nama: s.nama,
            npsn: s.npsn,
            bentuk_pendidikan: s.bentuk_pendidikan,
            status_sekolah: s.status_sekolah,
            akreditasi: s.akreditasi,
            alamat: s.alamat_jalan,
            dusun: s.nama_dusun,
            kecamatan: s.kecamatan,
            kabupaten: s.kabupaten,
            provinsi: s.provinsi,
            kode_pos: s.kode_pos,
            foto: s.path_file
        }))
    }
}

/*
 * Parse command
 *
 * Contoh:
 * .sekolah tempe
 * .sekolah tempe|20
 * .sekolah tempe|20|Banjar
 * .sekolah tempe|20|Banjar|SMA
 * .sekolah tempe|20|Banjar|SMA|Negeri
 */
function parseInput(text) {
    const parts = text
        .split('|')
        .map(v => v.trim())

    const keyword = parts[0] || ''

    const limit =
        Math.min(
            Math.max(
                parseInt(parts[1] || '12', 10) || 12,
                1
            ),
            50
        )

    return {
        keyword,
        limit,
        kabupatenKota: parts[2] || '',
        bentukPendidikan: parts[3] || '',
        statusSekolah: parts[4] || ''
    }
}

function formatSekolah(data, keyword) {
    if (!data.sekolah.length) {
        return [
            `╭─「 PENCARIAN SEKOLAH 」`,
            `│`,
            `│ Keyword : ${keyword}`,
            `│`,
            `│ Data sekolah tidak ditemukan.`,
            `│`,
            `╰──────────────`
        ].join('\n')
    }

    const hasil = [
        `╭─「 DATA SEKOLAH 」`,
        `│`,
        `│ Keyword : ${keyword}`,
        `│ Total   : ${data.total}`,
        `│ Ditampilkan: ${data.count}`,
        `│`
    ]

    data.sekolah.forEach((s, i) => {
        hasil.push(
            `├─「 ${i + 1} 」`,
            `│ Nama       : ${s.nama || '-'}`,
            `│ NPSN       : ${s.npsn || '-'}`,
            `│ Bentuk     : ${s.bentuk_pendidikan || '-'}`,
            `│ Status     : ${s.status_sekolah || '-'}`,
            `│ Akreditasi : ${s.akreditasi || '-'}`,
            `│ Alamat     : ${s.alamat || '-'}`,
            `│ Dusun      : ${s.dusun || '-'}`,
            `│ Kecamatan  : ${s.kecamatan || '-'}`,
            `│ Kabupaten  : ${s.kabupaten || '-'}`,
            `│ Provinsi   : ${s.provinsi || '-'}`,
            `│ Kode Pos   : ${s.kode_pos || '-'}`,
            `│`
        )
    })

    hasil.push(`╰──────────────`)

    return hasil.join('\n')
}

let handler = async (m, { text, reply }) => {
    if (!text) {
        return reply(
            [
                `╭─「 PENCARIAN SEKOLAH 」`,
                `│`,
                `│ Cara penggunaan:`,
                `│ .sekolah <keyword>`,
                `│`,
                `│ Contoh:`,
                `│ .sekolah SMAN 1`,
                `│`,
                `│ Dengan limit:`,
                `│ .sekolah SMAN 1|20`,
                `│`,
                `│ Dengan kabupaten:`,
                `│ .sekolah SMAN|20|Banjar`,
                `│`,
                `│ Format lengkap:`,
                `│ keyword|limit|kabupaten|bentuk|status`,
                `│`,
                `│ Contoh:`,
                `│ .sekolah SMAN|20|Banjar|SMA|Negeri`,
                `│`,
                `╰──────────────`
            ].join('\n')
        )
    }

    try {
        const options = parseInput(text)

        if (!options.keyword) {
            return reply('Masukkan nama atau keyword sekolah.')
        }

        await reply('Sedang mencari data sekolah...')

        const data =
            await cariSekolah(
                options.keyword,
                options
            )

        return reply(
            formatSekolah(
                data,
                options.keyword
            )
        )
    } catch (e) {
        console.error('[SEKOLAH]', e)

        return reply(
            `Gagal mengambil data sekolah.\n\n${e.message}`
        )
    }
}

handler.command = ['sekolah']
handler.tags = ['tools']

export default handler
