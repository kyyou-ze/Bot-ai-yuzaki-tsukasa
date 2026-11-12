import { skills, shop } from './common.js'
export default {
    key: 'esport', title: 'Manajer Esport', icon: '🎮', repLabel: 'Fans', heat: false, locLabel: 'arena',
    intro: 'Bangun karier pro player: scrim, ranked, bootcamp, stream — sampai juara turnamen dunia!',
    roles: [
        { id: 'jungler', name: 'Jungler', icon: '🐺', desc: 'Agresif. Bonus ranked.', bonus: { ranked: 1.25 } },
        { id: 'mage', name: 'Mage', icon: '🔮', desc: 'Damage tinggi. Bonus turnamen.', bonus: { turnamen: 1.2, ranked: 1.1 } },
        { id: 'marksman', name: 'Marksman', icon: '🏹', desc: 'Carry andalan. Bonus scrim & ranked.', bonus: { scrim: 1.2, ranked: 1.1 } },
        { id: 'support', name: 'Support', icon: '🛡️', desc: 'Pelindung tim, lebih aman, bonus stream.', bonus: { stream: 1.3 }, safe: 0.04 }
    ],
    locations: [
        { id: 'warnet', name: 'Warnet Lokal', minLevel: 1, mult: 1, desc: 'Tempat latihan sejuta anak ranked.' },
        { id: 'gaminghouse', name: 'Gaming House', minLevel: 6, mult: 1.35, cost: 100, desc: 'Fasilitas lengkap dengan coach.' },
        { id: 'arena', name: 'Arena Nasional', minLevel: 14, mult: 1.8, cost: 300, desc: 'Panggung turnamen nasional.' },
        { id: 'worlds', name: 'Panggung Dunia', minLevel: 26, mult: 2.5, risk: 0.06, cost: 800, desc: 'Juara dunia dielu-elukan jutaan fans.' }
    ],
    actions: [
        { cmd: 'scrim', label: 'Scrim Tim', icon: '🤝', energy: 8, cd: 50, min: 25, max: 60, xp: [18, 30], risk: 0.07, loss: [10, 30], rep: 1,
            ok: ['Scrim sengit, strategi barumu berhasil.', 'Tim lawan kagum pada rotasimu.'], fail: ['Komunikasi tim kacau, kalah telak.'] },
        { cmd: 'ranked', label: 'Push Rank', icon: '🏆', energy: 14, cd: 120, min: 60, max: 140, xp: [25, 42], risk: 0.2, loss: [30, 80], rep: 2,
            tiers: [{ id: 'epic', label: 'Epic', minLevel: 1, mult: 1, risk: 0 }, { id: 'legend', label: 'Legend', minLevel: 8, mult: 2, risk: 0.06 }, { id: 'mythic', label: 'Mythic', minLevel: 16, mult: 3.5, risk: 0.12 }, { id: 'immortal', label: 'Mythical Immortal', minLevel: 26, mult: 6, risk: 0.18 }],
            ok: ['Winstreak! Bintang rank naik beruntun.', 'MVP dengan savage di match penentuan.'], fail: ['Teammate AFK, lose streak.', 'Ping tiba-tiba spike di late game.'] },
        { cmd: 'stream', label: 'Live Streaming', icon: '📡', energy: 10, cd: 100, min: 30, max: 90, xp: [15, 28], risk: 0.1, loss: [10, 40], rep: 5,
            ok: ['Donasi dari penonton berdatangan!', 'Klip permainanmu viral di media sosial.'], fail: ['Koneksi putus saat peak viewers.'] },
        { cmd: 'bootcamp', label: 'Bootcamp Intensif', icon: '🏕️', energy: 20, cd: 240, min: 0, max: 20, xp: [60, 100], risk: 0.05, cost: 60, loss: [10, 30],
            ok: ['Coach memuji perkembangan mekanikmu.', 'Draft pick tim jadi jauh lebih matang.'], fail: ['Cedera tangan, latihan terhenti.'] },
        { cmd: 'turnamen', label: 'Ikut Turnamen', icon: '🥇', energy: 30, cd: 900, min: 250, max: 650, xp: [80, 140], risk: 0.38, loss: [100, 280], rep: 10, minLevel: 8,
            ok: ['Juara! Trofi dan hadiah uang diangkat tinggi.', 'Lolos ke grand final dan menang tipis 3-2.'], fail: ['Tersingkir di babak awal.', 'Dikalahkan tim unggulan di semifinal.'] }
    ],
    skills: skills({ power: ['mekanik', 'Mekanik Dewa'], safe: ['mental', 'Mental Baja'], energy: ['stamina', 'Stamina Gamer'], xp: ['coach', 'Coach Pribadi'] }),
    shop: shop(['mouse', 'Mouse Gaming Pro'], ['pc', 'PC Gaming Flagship'], ['headset', 'Headset Noise-Cancel'], ['kopi', 'Kopi Begadang'], ['energi', 'Minuman Isotonik']),
    ranks: [[1, 'Warrior'], [6, 'Elite'], [12, 'Master'], [18, 'Grandmaster'], [26, 'Epic'], [34, 'Legend'], [42, 'Mythic Immortal']],
    pvp: { cmd: 'duel', label: 'duel 1v1', icon: '⚔️' }
}
