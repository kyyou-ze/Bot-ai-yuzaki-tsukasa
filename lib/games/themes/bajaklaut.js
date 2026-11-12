import { skills, shop } from './common.js'
export default {
    key: 'bajaklaut', title: 'Bajak Laut', icon: '🏴‍☠️', repLabel: 'Kehormatan', heat: true, heatLabel: 'Bounty', locLabel: 'lautan',
    intro: 'Pimpin kapalmu, buru harta karun, jarah kapal dagang — tapi awas bounty di kepalamu!',
    roles: [
        { id: 'kapten', name: 'Kapten', icon: '🧭', desc: 'Pemimpin kapal. Bonus besar saat menjarah.', bonus: { jarah: 1.25, pesta: 1.2 } },
        { id: 'navigator', name: 'Navigator', icon: '🗺️', desc: 'Ahli peta. Bonus berlayar & berburu harta, lebih aman.', bonus: { layar: 1.25, harta: 1.2 }, safe: 0.03 },
        { id: 'koki', name: 'Koki Kapal', icon: '🍖', desc: 'Kru bahagia, rugi lebih kecil. Bonus pesta.', bonus: { pesta: 1.4, layar: 1.1 }, safe: 0.04 },
        { id: 'penembak', name: 'Penembak Meriam', icon: '💣', desc: 'Jago tempur. Bonus jarah & serang.', bonus: { jarah: 1.3, harta: 1.1 } }
    ],
    locations: [
        { id: 'tortuga', name: 'Pelabuhan Tortuga', minLevel: 1, mult: 1, desc: 'Pelabuhan aman tempat bajak laut berkumpul.' },
        { id: 'karibia', name: 'Laut Karibia', minLevel: 5, mult: 1.3, cost: 100, desc: 'Jalur dagang ramai, bounty mudah naik.' },
        { id: 'tengkorak', name: 'Pulau Tengkorak', minLevel: 10, mult: 1.7, risk: 0.05, cost: 250, desc: 'Pulau berhantu penuh harta.' },
        { id: 'segitiga', name: 'Segitiga Setan', minLevel: 20, mult: 2.3, risk: 0.1, cost: 600, desc: 'Kapal hilang tanpa jejak… hadiahnya fantastis.' }
    ],
    actions: [
        { cmd: 'layar', label: 'Berlayar Dagang', icon: '⛵', energy: 8, cd: 45, min: 30, max: 70, xp: [12, 22], risk: 0.06, loss: [10, 30], rep: 1,
            ok: ['Rempah-rempah terjual mahal di pelabuhan tetangga.', 'Angin bagus, kargo sampai lebih cepat dari jadwal.'], fail: ['Badai menghantam, sebagian kargo hanyut.', 'Kapalmu terdampar di karang dangkal.'] },
        { cmd: 'harta', label: 'Berburu Harta Karun', icon: '🗺️', energy: 15, cd: 120, min: 70, max: 150, xp: [25, 40], risk: 0.2, loss: [30, 90], rep: 2,
            tiers: [{ id: 'kecil', label: 'Peta Kecil', minLevel: 1, mult: 1, risk: 0 }, { id: 'sedang', label: 'Peta Kuno', minLevel: 8, mult: 2, risk: 0.07 }, { id: 'legenda', label: 'Peta Legenda', minLevel: 18, mult: 4, risk: 0.15 }],
            ok: ['X menandai tempat! Peti penuh koin emas ditemukan.', 'Gua tersembunyi menyimpan permata berkilau.'], fail: ['Peta ternyata palsu, kru kecewa.', 'Jebakan kuno meledak di dalam gua!'] },
        { cmd: 'jarah', label: 'Jarah Kapal Dagang', icon: '💣', energy: 25, cd: 300, min: 160, max: 380, xp: [45, 80], risk: 0.4, loss: [60, 160], heat: 8,
            ok: ['Kapal dagang menyerah setelah tembakan peringatan.', 'Naik ke geladak, kargo emas diangkut sebelum fajar.'], fail: ['Angkatan laut muncul! Kamu kabur dengan kapal bocor.', 'Kapal dagang ternyata dikawal kapal perang.'] },
        { cmd: 'pesta', label: 'Pesta di Tavern', icon: '🍻', energy: 5, cd: 90, min: 15, max: 45, xp: [10, 18], risk: 0.05, cost: 30, rep: 2, heat: -6, loss: [10, 30],
            ok: ['Lagu pelaut menggema, bounty kepalamu terlupakan sejenak.', 'Kru bersulang dan mengaku setia padamu.'], fail: ['Pesta berubah jadi baku hantam, tagihan kerusakan menumpuk.'] }
    ],
    skills: skills({ power: ['meriam', 'Meriam Tajam'], safe: ['kompas', 'Kompas Sakti'], energy: ['kru', 'Kru Solid'], xp: ['legenda', 'Kisah Legenda'] }),
    shop: shop(['pedang', 'Cutlass Perak'], ['kapal', 'Galleon Perang'], ['jangkar', 'Jangkar Baja'], ['rum', 'Rum Hitam'], ['pesta', 'Pesta Besar']),
    ranks: [[1, 'Anak Dek'], [5, 'Kru Berpengalaman'], [10, 'Letnan'], [15, 'Kapten Muda'], [20, 'Kapten Terkenal'], [30, 'Raja Bajak Laut']],
    pvp: { cmd: 'serang', label: 'serang kapal', icon: '⚔️' }
}
