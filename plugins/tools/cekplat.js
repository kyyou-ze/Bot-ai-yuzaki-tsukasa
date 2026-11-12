// Kode wilayah plat nomor kendaraan di Indonesia (berdasarkan kode Korlantas Polri).
// Data offline: tidak butuh internet.

const PLAT = {
    // Sumatera
    BL: 'Aceh',
    BB: 'Sumatera Utara (Tapanuli: Sibolga, Tarutung, Padangsidimpuan, dll)',
    BK: 'Sumatera Utara (Medan, Deli Serdang, Binjai, dll)',
    BA: 'Sumatera Barat',
    BM: 'Riau',
    BP: 'Kepulauan Riau',
    BH: 'Jambi',
    BG: 'Sumatera Selatan',
    BD: 'Bengkulu',
    BE: 'Lampung',
    BN: 'Kepulauan Bangka Belitung',
    // Jawa
    A: 'Banten (Serang, Cilegon, Pandeglang, Lebak)',
    B: 'DKI Jakarta, Depok, Tangerang, Bekasi',
    D: 'Jawa Barat (Bandung dan sekitarnya)',
    E: 'Jawa Barat (Cirebon, Indramayu, Majalengka, Kuningan)',
    F: 'Jawa Barat (Bogor, Sukabumi, Cianjur)',
    T: 'Jawa Barat (Karawang, Purwakarta, Subang)',
    Z: 'Jawa Barat (Garut, Tasikmalaya, Sumedang, Ciamis, Banjar, Pangandaran)',
    G: 'Jawa Tengah (Pekalongan, Tegal, Brebes, Batang, Pemalang)',
    H: 'Jawa Tengah (Semarang, Kendal, Salatiga, Demak, Ungaran)',
    K: 'Jawa Tengah (Pati, Kudus, Jepara, Rembang, Blora, Grobogan)',
    R: 'Jawa Tengah (Banyumas, Cilacap, Purbalingga, Banjarnegara)',
    AA: 'Jawa Tengah (Kedu: Magelang, Purworejo, Temanggung, Kebumen, Wonosobo)',
    AD: 'Jawa Tengah (Surakarta, Sukoharjo, Boyolali, Klaten, Karanganyar)',
    AB: 'DI Yogyakarta',
    L: 'Jawa Timur (Surabaya)',
    M: 'Jawa Timur (Madura)',
    N: 'Jawa Timur (Malang, Pasuruan, Probolinggo, Batu, Lumajang)',
    P: 'Jawa Timur (Besuki: Jember, Banyuwangi, Bondowoso, Situbondo)',
    S: 'Jawa Timur (Bojonegoro, Tuban, Lamongan, Mojokerto, Jombang)',
    W: 'Jawa Timur (Sidoarjo, Gresik)',
    AE: 'Jawa Timur (Madiun, Ngawi, Magetan, Ponorogo, Pacitan)',
    AG: 'Jawa Timur (Kediri, Blitar, Tulungagung, Nganjuk, Trenggalek)',
    // Bali & Nusa Tenggara
    DK: 'Bali',
    DR: 'Nusa Tenggara Barat (Pulau Lombok)',
    EA: 'Nusa Tenggara Barat (Pulau Sumbawa)',
    DH: 'Nusa Tenggara Timur (Kupang dan Timor)',
    EB: 'Nusa Tenggara Timur (Flores)',
    ED: 'Nusa Tenggara Timur (Sumba)',
    // Kalimantan
    KB: 'Kalimantan Barat',
    KH: 'Kalimantan Tengah',
    DA: 'Kalimantan Selatan',
    KT: 'Kalimantan Timur',
    KU: 'Kalimantan Utara',
    // Sulawesi
    DB: 'Sulawesi Utara (Manado dan sekitarnya)',
    DL: 'Sulawesi Utara (Kepulauan Sangihe dan Talaud)',
    DM: 'Gorontalo',
    DN: 'Sulawesi Tengah',
    DT: 'Sulawesi Tenggara',
    DD: 'Sulawesi Selatan (Makassar dan sekitarnya)',
    DP: 'Sulawesi Selatan (Makassar / Ujung Pandang)',
    DC: 'Sulawesi Barat',
    // Maluku & Papua
    DE: 'Maluku',
    DG: 'Maluku Utara',
    PA: 'Papua',
    DS: 'Papua',
    PB: 'Papua Barat'
}

const SPECIAL = {
    CD: 'Korps Diplomatik (kedutaan besar / perwakilan negara asing)',
    CC: 'Korps Konsuler (konsulat negara asing)'
}

const WARNA = [
    'Putih, tulisan hitam: kendaraan pribadi',
    'Kuning, tulisan hitam: angkutan umum',
    'Merah, tulisan putih: kendaraan dinas pemerintah',
    'Hijau, tulisan hitam: kawasan perdagangan bebas',
    'Dasar hitam, tulisan putih: kendaraan sementara / uji coba (dahulu pribadi)'
]

let handler = async (m, { text, reply, example }) => {
    const input = String(text || '').trim().toUpperCase()
    if (!input) return example('BK 1234 ABC')

    // kode wilayah = huruf di awal plat (maksimal 2 huruf)
    const letters = (input.match(/^[A-Z]{1,2}/) || [''])[0]
    if (!letters) return reply('Plat tidak valid. Plat diawali 1-2 huruf kode wilayah, contoh: BK 1234 ABC')

    const hit = SPECIAL[letters] ? { code: letters, info: SPECIAL[letters] }
        : PLAT[letters] ? { code: letters, info: PLAT[letters] }
        : null

    if (!hit) {
        return reply(`Kode wilayah *${letters}* tidak ada di data.\n\nPeriksa lagi hurufnya. Contoh plat: B 1234 XYZ, DK 5678 AB`)
    }

    const rest = input.slice(hit.code.length).trim()
    const suffix = (rest.match(/[A-Z]{1,3}$/) || [''])[0]

    return reply(
        `🚘 *CEK PLAT NOMOR*\n\n` +
        `Plat   : ${input}\n` +
        `Kode   : *${hit.code}*\n` +
        `Wilayah: ${hit.info}` +
        (suffix && !SPECIAL[hit.code] ? `\nHuruf akhir: ${suffix} (kode seri, bukan penentu wilayah pasti)` : '') +
        `\n\n*Warna plat*\n${WARNA.map(w => `- ${w}`).join('\n')}` +
        `\n\n_Kode wilayah menunjukkan tempat registrasi awal kendaraan, bukan lokasi pemilik saat ini._`
    )
}

handler.command = ['cekplat']
handler.help = ['cekplat']
handler.tags = ['tools']

export default handler
