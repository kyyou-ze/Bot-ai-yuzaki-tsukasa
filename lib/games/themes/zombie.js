import { skills, shop } from './common.js'
export default {
    key: 'zombie', title: 'Zombie Survival', icon: '🧟', repLabel: 'Pengaruh Penyintas', heat: false, locLabel: 'zona',
    intro: 'Dunia runtuh. Jelajahi reruntuhan, lawan gerombolan, bangun markas, dan selamat sampai evakuasi!',
    roles: [
        { id: 'pemburu', name: 'Pemburu', icon: '🏹', desc: 'Ahli bertarung. Bonus lawan gerombolan.', bonus: { lawan: 1.3 } },
        { id: 'medis', name: 'Medis', icon: '🩺', desc: 'Lebih aman, bonus jelajah.', bonus: { jelajah: 1.15 }, safe: 0.05 },
        { id: 'teknisi', name: 'Teknisi', icon: '🔧', desc: 'Ahli rakit. Bonus bangun markas.', bonus: { markas: 1.35 } },
        { id: 'pengintai', name: 'Pengintai', icon: '🔭', desc: 'Gesit & senyap. Bonus jelajah & evakuasi.', bonus: { jelajah: 1.25, evakuasi: 1.15 } }
    ],
    locations: [
        { id: 'rumah', name: 'Perumahan Kosong', minLevel: 1, mult: 1, desc: 'Rumah-rumah ditinggalkan, relatif aman.' },
        { id: 'toko', name: 'Supermarket', minLevel: 5, mult: 1.3, risk: 0.02, desc: 'Persediaan makanan, tapi gerombolan berkeliaran.' },
        { id: 'rs', name: 'Rumah Sakit', minLevel: 12, mult: 1.7, risk: 0.05, cost: 80, desc: 'Obat & peralatan medis berharga.' },
        { id: 'militer', name: 'Pangkalan Militer', minLevel: 22, mult: 2.4, risk: 0.09, cost: 300, desc: 'Senjata berat, tapi dijaga gerombolan besar.' }
    ],
    actions: [
        { cmd: 'jelajah', label: 'Jelajah Reruntuhan', icon: '🔦', energy: 8, cd: 50, min: 30, max: 70, xp: [14, 26], risk: 0.1, loss: [15, 40], rep: 1,
            ok: ['Gudang bawah tanah menyimpan makanan kaleng.', 'Kamu menemukan tas ransel berisi obat dan baterai.'], fail: ['Pintu berderit, zombie berdatangan — kabur dengan sedikit luka.', 'Reruntuhan runtuh, persediaan hilang.'] },
        { cmd: 'lawan', label: 'Lawan Gerombolan', icon: '🧟', energy: 18, cd: 180, min: 90, max: 210, xp: [35, 60], risk: 0.3, loss: [60, 140], rep: 2,
            tiers: [{ id: 'kecil', label: 'Gerombolan Kecil', minLevel: 1, mult: 1, risk: 0 }, { id: 'besar', label: 'Gerombolan Besar', minLevel: 10, mult: 2.5, risk: 0.1 }, { id: 'horde', label: 'Horde', minLevel: 22, mult: 5, risk: 0.18 }],
            ok: ['Gerombolan tumbang, kamu mengambil perbekalan mereka.', 'Taktik jebakan menghabisi seluruh gerombolan.'], fail: ['Kamu terkepung dan nyaris tergigit.', 'Peluru habis di saat genting!'] },
        { cmd: 'markas', label: 'Perkuat Markas', icon: '🏚️', energy: 12, cd: 120, min: 10, max: 40, xp: [30, 50], risk: 0.05, cost: 40, loss: [10, 30], rep: 4,
            ok: ['Pagar baja baru terpasang, markas makin aman.', 'Generator listrik darurat menyala.'], fail: ['Material kurang, proyek gagal.'] },
        { cmd: 'evakuasi', label: 'Misi Evakuasi', icon: '🚁', energy: 30, cd: 900, min: 280, max: 700, xp: [90, 150], risk: 0.4, loss: [120, 300], rep: 10, minLevel: 15,
            ok: ['Helikopter mendarat, para penyintas selamat!', 'Konvoi lolos dari kota mati tanpa korban.'], fail: ['Titik evakuasi diserbu zombie — misi dibatalkan.'] }
    ],
    skills: skills({ power: ['senjata', 'Keahlian Senjata'], safe: ['insting', 'Insting Bertahan'], energy: ['ketahanan', 'Ketahanan Fisik'], xp: ['pengalaman', 'Pengalaman Lapangan'] }),
    shop: shop(['pisau', 'Pisau Taktis'], ['senapan', 'Senapan Serbu'], ['rompi', 'Rompi Pelindung'], ['makanan', 'Makanan Kaleng'], ['obat', 'Kotak P3K Lengkap']),
    ranks: [[1, 'Penyintas Baru'], [6, 'Pemulung'], [12, 'Pejuang'], [20, 'Pemimpin Kelompok'], [30, 'Komandan Markas'], [40, 'Harapan Terakhir']],
    pvp: { cmd: 'rampas', label: 'rampas perbekalan', icon: '🔫' }
}
