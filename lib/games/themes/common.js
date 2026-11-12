// Skill & toko bawaan yang dipakai semua tema dunia (nama/teks diganti per tema).
export const skills = (names) => [
    { id: names.power[0], name: names.power[1], desc: 'Hadiah koin +4% per level', effect: 'power', per: 0.04, max: 10, price: 120 },
    { id: names.safe[0], name: names.safe[1], desc: 'Risiko gagal −2% per level', effect: 'safe', per: 0.02, max: 8, price: 150 },
    { id: names.energy[0], name: names.energy[1], desc: 'Hemat energi 2% per level', effect: 'energy', per: 0.02, max: 8, price: 120 },
    { id: names.xp[0], name: names.xp[1], desc: 'XP +5% per level', effect: 'xp', per: 0.05, max: 6, price: 100 }
]
export const shop = (g1, g2, g3, t1, t2) => [
    { id: g1[0], name: g1[1], desc: 'Hadiah aksi +10% (permanen)', price: 800, pow: 0.1 },
    { id: g2[0], name: g2[1], desc: 'Hadiah aksi +20% (permanen)', price: 2500, pow: 0.2 },
    { id: g3[0], name: g3[1], desc: 'Risiko gagal −5% (permanen)', price: 1200, safe: 0.05 },
    { id: t1[0], name: t1[1], desc: 'Energi +40', price: 150, energy: 40 },
    { id: t2[0], name: t2[1], desc: 'Energi +100 (penuh)', price: 350, energy: 100 }
]
