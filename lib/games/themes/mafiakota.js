import { skills, shop } from './common.js'
export default {
    key: 'mafiakota', title: 'Mafia Kota', icon: '🕴️', repLabel: 'Pengaruh', heat: true, heatLabel: 'Heat Polisi', locLabel: 'distrik',
    intro: 'Bangun imperium kejahatan di kota: palak, selundup, rampok — jaga heat polisi tetap rendah!',
    roles: [
        { id: 'bos', name: 'Bos Keluarga', icon: '🎩', desc: 'Otak organisasi. Bonus palak & suap lebih murah.', bonus: { palak: 1.25 } },
        { id: 'penembak', name: 'Penembak Jitu', icon: '🔫', desc: 'Eksekutor. Bonus rampok bank.', bonus: { rampok: 1.3 } },
        { id: 'hacker', name: 'Hacker', icon: '💻', desc: 'Otak teknologi. Lebih aman & bonus rampok.', bonus: { rampok: 1.15 }, safe: 0.05 },
        { id: 'penyelundup', name: 'Penyelundup', icon: '🚚', desc: 'Jalur gelap. Bonus selundup.', bonus: { selundup: 1.35 } }
    ],
    locations: [
        { id: 'gang', name: 'Gang Kumuh', minLevel: 1, mult: 1, desc: 'Basis awal, polisi jarang patroli.' },
        { id: 'pelabuhan', name: 'Pelabuhan Gelap', minLevel: 6, mult: 1.4, cost: 100, desc: 'Gudang kontainer, jalur selundup ramai.' },
        { id: 'distrik', name: 'Distrik Bisnis', minLevel: 14, mult: 1.9, risk: 0.05, cost: 300, desc: 'Gedung kaca & bank besar.' },
        { id: 'kasino', name: 'Kasino Elite', minLevel: 25, mult: 2.5, risk: 0.08, cost: 700, desc: 'Uang mengalir deras, mata-mata di mana-mana.' }
    ],
    actions: [
        { cmd: 'palak', label: 'Tagih Uang Keamanan', icon: '💼', energy: 8, cd: 60, min: 40, max: 85, xp: [14, 24], risk: 0.1, loss: [20, 50], rep: 1, heat: 3,
            ok: ['Pemilik toko menyerahkan "uang keamanan" tanpa banyak tanya.', 'Warung demi warung membayar setoran mingguan.'], fail: ['Pemilik toko melapor ke polisi!', 'Anak buahmu dihajar warga, setoran lenyap.'] },
        { cmd: 'selundup', label: 'Selundupkan Barang', icon: '🚚', energy: 15, cd: 150, min: 90, max: 190, xp: [26, 42], risk: 0.22, loss: [50, 120], heat: 6,
            ok: ['Kontainer lolos pemeriksaan bea cukai.', 'Barang selundupan terjual tiga kali lipat.'], fail: ['Razia mendadak! Muatan disita.', 'Rekan menjual infomu ke polisi.'] },
        { cmd: 'rampok', label: 'Rampok Bank', icon: '🏦', energy: 28, cd: 420, min: 220, max: 520, xp: [55, 95], risk: 0.42, loss: [100, 260], heat: 15, minLevel: 5,
            ok: ['Brankas terbuka, tas penuh uang kabur lewat terowongan.', 'Alarm dimatikan tepat waktu — rampokan sempurna.'], fail: ['SWAT mengepung gedung, kamu kabur dengan tangan kosong.', 'Kode brankas berubah. Kamu nyaris tertangkap.'] },
        { cmd: 'suap', label: 'Suap Polisi', icon: '🤝', energy: 4, cd: 120, min: 0, max: 0, xp: [8, 14], risk: 0.08, cost: 150, heat: -25, loss: [0, 0],
            ok: ['Amplop tebal berpindah tangan. Berkas kasusmu "hilang".', 'Komisaris pura-pura tak melihatmu.'], fail: ['Polisinya jujur! Uang suapmu disita sebagai barang bukti.'] }
    ],
    skills: skills({ power: ['strategi', 'Strategi Licik'], safe: ['koneksi', 'Koneksi Hukum'], energy: ['anakbuah', 'Anak Buah Setia'], xp: ['reputasi', 'Reputasi Jalanan'] }),
    shop: shop(['senjata', 'Pistol Custom'], ['mobil', 'Mobil Lapis Baja'], ['rompi', 'Rompi Anti Peluru'], ['kopi', 'Kopi Hitam'], ['whisky', 'Whisky Mahal']),
    ranks: [[1, 'Preman Jalanan'], [6, 'Kroco'], [12, 'Soldato'], [20, 'Kapten Geng'], [30, 'Underboss'], [40, 'Godfather']],
    pvp: { cmd: 'rebut', label: 'rebut wilayah', icon: '🔫' },
    statusExtra: (u) => (u.heat >= 70 ? '🚨 Polisi sedang memburumu! Pertimbangkan suap.' : u.heat >= 40 ? '⚠️ Heat cukup tinggi.' : '✅ Heat aman.')
}
