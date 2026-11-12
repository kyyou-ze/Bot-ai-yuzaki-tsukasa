import { skills, shop } from './common.js'
export default {
    key: 'kampus', title: 'Kehidupan Kampus', icon: '🎓', repLabel: 'Reputasi', heat: false, locLabel: 'tempat',
    intro: 'Kuliah, ujian, organisasi, kerja sambilan — raih IPK tinggi dan lulus cum laude!',
    roles: [
        { id: 'teknik', name: 'Mahasiswa Teknik', icon: '⚙️', desc: 'Jago ngoding & proyek. Bonus kerja sambilan.', bonus: { kerja: 1.25 } },
        { id: 'kedokteran', name: 'Mahasiswa Kedokteran', icon: '🩺', desc: 'Rajin belajar. Bonus belajar & ujian.', bonus: { belajar: 1.25, ujian: 1.15 } },
        { id: 'bisnis', name: 'Mahasiswa Bisnis', icon: '📈', desc: 'Pandai jaringan. Bonus organisasi & kerja.', bonus: { organisasi: 1.3, kerja: 1.1 } },
        { id: 'seni', name: 'Mahasiswa Seni', icon: '🎨', desc: 'Kreatif & santai, lebih aman.', bonus: { organisasi: 1.2 }, safe: 0.04 }
    ],
    locations: [
        { id: 'kelas', name: 'Ruang Kelas', minLevel: 1, mult: 1, desc: 'Tempat kuliah pagi yang ngantuk.' },
        { id: 'perpus', name: 'Perpustakaan', minLevel: 4, mult: 1.25, desc: 'Sunyi, cocok untuk belajar serius.' },
        { id: 'lab', name: 'Laboratorium', minLevel: 10, mult: 1.6, cost: 50, desc: 'Praktikum & penelitian.' },
        { id: 'rektorat', name: 'Gedung Rektorat', minLevel: 20, mult: 2.1, risk: 0.04, cost: 150, desc: 'Tempat beasiswa & jabatan bergengsi.' }
    ],
    actions: [
        { cmd: 'belajar', label: 'Belajar Mandiri', icon: '📚', energy: 6, cd: 40, min: 10, max: 30, xp: [20, 35], risk: 0.04, loss: [5, 15], rep: 1,
            ok: ['Materi bab ini akhirnya nyantol di kepala.', 'Catatanmu rapi dan jadi rebutan teman.'], fail: ['Ketiduran di perpustakaan…'] },
        { cmd: 'kuliah', label: 'Hadir Kuliah', icon: '🏫', energy: 8, cd: 60, min: 25, max: 55, xp: [18, 30], risk: 0.06, loss: [10, 25],
            ok: ['Dosen memuji pertanyaanmu di kelas.', 'Absensi aman dan tugas dikumpulkan tepat waktu.'], fail: ['Telat masuk kelas, absen dicoret.'] },
        { cmd: 'organisasi', label: 'Aktif Organisasi', icon: '🤝', energy: 12, cd: 120, min: 40, max: 90, xp: [22, 38], risk: 0.12, loss: [20, 50], rep: 3,
            ok: ['Acara kampus sukses besar, namamu dikenal.', 'Sponsor memberi dana kegiatan, kamu dapat jatah.'], fail: ['Rapat berujung debat kusir, acara batal.'] },
        { cmd: 'kerja', label: 'Kerja Sambilan', icon: '💼', energy: 15, cd: 150, min: 70, max: 150, xp: [18, 30], risk: 0.1, loss: [30, 70],
            ok: ['Gajian freelance masuk ke rekeningmu.', 'Kafe tempatmu kerja ramai, tip melimpah.'], fail: ['Bos komplain pekerjaanmu, upah dipotong.'] },
        { cmd: 'ujian', label: 'Ikut Ujian', icon: '📝', energy: 20, cd: 300, min: 90, max: 220, xp: [45, 85], risk: 0.25, loss: [40, 110], rep: 4, minLevel: 3,
            tiers: [{ id: 'kuis', label: 'Kuis', minLevel: 1, mult: 1, risk: 0 }, { id: 'uts', label: 'UTS', minLevel: 6, mult: 2, risk: 0.06 }, { id: 'uas', label: 'UAS', minLevel: 12, mult: 3.2, risk: 0.1 }, { id: 'skripsi', label: 'Sidang Skripsi', minLevel: 22, mult: 6, risk: 0.18 }],
            ok: ['Nilai keluar: A! Dosen penguji tersenyum.', 'Soal sulit berhasil ditaklukkan.'], fail: ['Nilai keluar: harus remedial.', 'Blank di tengah ujian…'] }
    ],
    skills: skills({ power: ['fokus', 'Fokus Belajar'], safe: ['manajemen', 'Manajemen Waktu'], energy: ['kopi', 'Daya Tahan Begadang'], xp: ['mentor', 'Dosen Pembimbing'] }),
    shop: shop(['laptop', 'Laptop Baru'], ['beasiswa', 'Paket Beasiswa Prestasi'], ['catatan', 'Catatan Lengkap'], ['kopi', 'Kopi Kantin'], ['energi', 'Minuman Energi']),
    ranks: [[1, 'Maba'], [5, 'Semester 3'], [10, 'Semester 5'], [16, 'Semester 7'], [24, 'Sarjana'], [32, 'Magister'], [40, 'Profesor']],
    pvp: { cmd: 'debat', label: 'adu debat', icon: '🎤' },
    statusExtra: (u) => `📈 IPK: ${Math.min(4, 2 + u.lvl * 0.06 + u.rep * 0.004).toFixed(2)}`
}
