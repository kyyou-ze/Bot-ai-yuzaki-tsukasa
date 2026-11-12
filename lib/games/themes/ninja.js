import { skills, shop } from './common.js'
export default {
    key: 'ninja', title: 'Dunia Ninja', icon: '🥷', repLabel: 'Kehormatan Desa', heat: false, locLabel: 'wilayah',
    intro: 'Jalani misi shinobi dari rank D sampai S, kuasai jutsu, naik pangkat dari Genin sampai Hokage!',
    roles: [
        { id: 'api', name: 'Pengguna Api', icon: '🔥', desc: 'Serangan membara. Bonus misi & duel.', bonus: { misi: 1.15, duel: 1 } },
        { id: 'air', name: 'Pengguna Air', icon: '💧', desc: 'Tenang & fleksibel. Lebih aman, bonus meditasi.', bonus: { meditasi: 1.3 }, safe: 0.04 },
        { id: 'angin', name: 'Pengguna Angin', icon: '🌪️', desc: 'Gesit. Bonus mata-mata & misi.', bonus: { intai: 1.3, misi: 1.1 } },
        { id: 'bayangan', name: 'Pengguna Bayangan', icon: '🌑', desc: 'Senyap & mematikan. Bonus ujian & intai.', bonus: { ujian: 1.25, intai: 1.2 } }
    ],
    locations: [
        { id: 'konoha', name: 'Desa Daun', minLevel: 1, mult: 1, desc: 'Desa asalmu, aman dan ramai.' },
        { id: 'hutan', name: 'Hutan Kematian', minLevel: 6, mult: 1.4, risk: 0.04, desc: 'Hutan lebat penuh binatang buas.' },
        { id: 'lembah', name: 'Lembah Akhir', minLevel: 14, mult: 1.9, risk: 0.08, cost: 200, desc: 'Tempat para legenda bertarung.' },
        { id: 'gunung', name: 'Gunung Myoboku', minLevel: 24, mult: 2.5, risk: 0.1, cost: 500, desc: 'Tempat berlatih mode sage.' }
    ],
    actions: [
        { cmd: 'misi', label: 'Ambil Misi', icon: '📜', energy: 12, cd: 90, min: 40, max: 90, xp: [20, 35], risk: 0.1, loss: [20, 60], rep: 1,
            tiers: [{ id: 'D', label: 'Rank D', minLevel: 1, mult: 1, risk: 0 }, { id: 'C', label: 'Rank C', minLevel: 5, mult: 2, risk: 0.05 }, { id: 'B', label: 'Rank B', minLevel: 10, mult: 3.5, risk: 0.1 }, { id: 'A', label: 'Rank A', minLevel: 18, mult: 6, risk: 0.15 }, { id: 'S', label: 'Rank S', minLevel: 28, mult: 10, risk: 0.22 }],
            ok: ['Misi selesai tanpa ketahuan, klien puas.', 'Target berhasil diamankan, desa memuji kerjamu.'], fail: ['Musuh membaca rencanamu, misi gagal.', 'Jebakan kunai menyambutmu, kamu mundur terluka.'] },
        { cmd: 'meditasi', label: 'Latihan Chakra', icon: '🧘', energy: 6, cd: 60, min: 10, max: 30, xp: [25, 45], risk: 0.03, loss: [5, 15],
            ok: ['Chakra mengalir lebih halus, kontrolmu meningkat.', 'Kamu menembus batasan latihan hari ini.'], fail: ['Chakra meluap, kamu pingsan sejenak.'] },
        { cmd: 'intai', label: 'Misi Mata-Mata', icon: '🕵️', energy: 15, cd: 150, min: 80, max: 170, xp: [25, 40], risk: 0.22, loss: [40, 100], rep: 1,
            ok: ['Dokumen rahasia berhasil disalin diam-diam.', 'Kamu menyusup ke markas dan keluar tanpa jejak.'], fail: ['Penjaga mencium aroma asing, kamu dikejar.', 'Genjutsu musuh menjebakmu.'] },
        { cmd: 'ujian', label: 'Ujian Kenaikan Pangkat', icon: '🏅', energy: 25, cd: 600, min: 150, max: 350, xp: [60, 110], risk: 0.35, loss: [80, 200], rep: 5, minLevel: 8,
            ok: ['Para penguji mengangguk — kamu lulus dengan gemilang!', 'Ujian pertarungan dimenangkan dengan jurus pamungkas.'], fail: ['Ujian terlalu berat, kamu gagal kali ini.'] }
    ],
    skills: skills({ power: ['jutsu', 'Penguasaan Jutsu'], safe: ['refleks', 'Refleks Kilat'], energy: ['stamina', 'Stamina Chakra'], xp: ['guru', 'Bimbingan Guru'] }),
    shop: shop(['kunai', 'Kunai Berlapis Chakra'], ['pedang', 'Pedang Kusanagi'], ['jubah', 'Jubah Pelindung'], ['pil', 'Pil Prajurit'], ['ramen', 'Ramen Ichiraku']),
    ranks: [[1, 'Genin'], [8, 'Chunin'], [16, 'Jonin'], [24, 'ANBU'], [32, 'Sannin'], [40, 'Hokage']],
    pvp: { cmd: 'duel', label: 'duel ninja', icon: '⚔️' }
}
