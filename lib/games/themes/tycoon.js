import { skills, shop } from './common.js'
export default {
    key: 'tycoon', title: 'Tycoon Bisnis', icon: '🏭', repLabel: 'Brand', heat: false, locLabel: 'pasar',
    intro: 'Mulai dari warung kecil, kembangkan jadi pabrik, perusahaan teknologi, sampai IPO!',
    roles: [
        { id: 'retail', name: 'Pengusaha Retail', icon: '🛍️', desc: 'Jualan cepat & stabil. Bonus dagang.', bonus: { dagang: 1.25 }, safe: 0.02 },
        { id: 'pabrik', name: 'Pemilik Pabrik', icon: '🏭', desc: 'Skala besar. Bonus produksi.', bonus: { produksi: 1.3 } },
        { id: 'teknologi', name: 'Founder Teknologi', icon: '💻', desc: 'Startup. Bonus iklan & IPO.', bonus: { iklan: 1.3, ipo: 1.2 } },
        { id: 'properti', name: 'Developer Properti', icon: '🏢', desc: 'Aset besar. Bonus produksi & IPO.', bonus: { produksi: 1.1, ipo: 1.25 } }
    ],
    locations: [
        { id: 'warung', name: 'Pasar Tradisional', minLevel: 1, mult: 1, desc: 'Modal kecil, perputaran cepat.' },
        { id: 'mall', name: 'Mall Kota', minLevel: 6, mult: 1.35, cost: 100, desc: 'Pembeli banyak, sewa mahal.' },
        { id: 'kawasan', name: 'Kawasan Industri', minLevel: 14, mult: 1.8, cost: 300, desc: 'Pabrik dan gudang raksasa.' },
        { id: 'bursa', name: 'Bursa Efek', minLevel: 24, mult: 2.4, risk: 0.05, cost: 800, desc: 'Tempat perusahaan besar go public.' }
    ],
    actions: [
        { cmd: 'dagang', label: 'Dagang Harian', icon: '🛒', energy: 8, cd: 45, min: 35, max: 75, xp: [12, 22], risk: 0.07, loss: [10, 35], rep: 1,
            ok: ['Dagangan laris manis sebelum tengah hari.', 'Pelanggan setia memborong stok terakhir.'], fail: ['Stok busuk karena salah simpan.', 'Pasar sepi seharian.'] },
        { cmd: 'produksi', label: 'Produksi Massal', icon: '🏭', energy: 15, cd: 150, min: 60, max: 180, xp: [25, 42], risk: 0.15, cost: 60, loss: [40, 110], rep: 1,
            ok: ['Mesin pabrik bekerja penuh, kontrak besar terpenuhi.', 'Efisiensi produksi naik, margin melebar.'], fail: ['Mesin rusak di tengah produksi.', 'Bahan baku datang terlambat, pesanan dibatalkan.'] },
        { cmd: 'iklan', label: 'Kampanye Iklan', icon: '📣', energy: 10, cd: 120, min: 20, max: 80, xp: [20, 32], risk: 0.18, cost: 80, loss: [30, 80], rep: 4,
            ok: ['Iklanmu viral, brand makin dikenal!', 'Influencer membahas produkmu, penjualan melonjak.'], fail: ['Iklan dikritik netizen, kampanye ditarik.'] },
        { cmd: 'ipo', label: 'IPO Perusahaan', icon: '📈', energy: 35, cd: 1200, min: 400, max: 1000, xp: [90, 160], risk: 0.38, cost: 300, loss: [150, 400], rep: 10, minLevel: 12,
            ok: ['Saham perdana ludes dalam hitungan menit!', 'Investor berebut membeli sahammu, harga naik 30%.'], fail: ['Pasar sedang lesu, IPO ditunda dan biaya hangus.'] }
    ],
    skills: skills({ power: ['negosiasi', 'Negosiasi Dagang'], safe: ['audit', 'Audit & Asuransi'], energy: ['manajer', 'Manajer Andal'], xp: ['mba', 'Kelas Bisnis'] }),
    shop: shop(['mesin', 'Mesin Produksi Baru'], ['gudang', 'Gudang Otomatis'], ['asuransi', 'Asuransi Usaha'], ['kopi', 'Kopi Rapat'], ['spa', 'Paket Spa Eksekutif']),
    ranks: [[1, 'Pedagang Kecil'], [6, 'Juragan'], [12, 'Pengusaha Sukses'], [20, 'Direktur'], [30, 'Konglomerat'], [40, 'Tycoon Legendaris']],
    pvp: { cmd: 'akuisisi', label: 'akuisisi paksa', icon: '💼' }
}
