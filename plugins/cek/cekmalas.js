// CEK MALAS — cek tingkat kemalasan dengan loading animasi (pesan di-edit sampai 100%), hasil acak 0-100%
//   .cekmalas [@tag / reply / nomor]
//   Sifat buruk: 0% = bagus ... 100% = buruk

const NOUN = 'kemalasan'

// teks penilaian per tingkatan: 0 | 1-10 | 11-20 | ... | 91-99 | 100   ({n} = nama sifat)
const TXT = [
    /* 0   */ ['Bersih total! Sama sekali tidak ada {n}. Kamu manusia teladan.', 'Nol besar, suci sempurna. Alat ukur sampai kagum.'],
    /* 1-10 */ ['Hampir tidak ada. Nyaris bersih, aman terkendali.', 'Sangat rendah. Cuma bumbu tipis, tidak masalah.'],
    /* 11-20 */ ['Rendah, masih aman. Sesekali kambuh, wajar.', 'Sedikit terdeteksi. Belum perlu khawatir.'],
    /* 21-30 */ ['Mulai kelihatan dikit. Masih bisa dikendalikan.', 'Ada, tapi masih tahap ringan. Jaga terus ya.'],
    /* 31-40 */ ['Lumayan terasa. Teman-teman mulai sadar.', 'Mulai mengganggu dikit. Perlu dikurangi nih.'],
    /* 41-50 */ ['Setengah-setengah. Antara iya dan tidak, tapi condong iya.', 'Sedang. Kadang muncul, kadang bersembunyi.'],
    /* 51-60 */ ['Sudah lewat setengah! Mulai jadi bahan obrolan grup.', 'Lumayan parah. Orang sekitar mulai geleng-geleng.'],
    /* 61-70 */ ['Parah juga ya. Susah disangkal lagi.', 'Tinggi. Sudah jadi ciri khas, bukan lagi kebetulan.'],
    /* 71-80 */ ['Sangat parah! Satu grup sudah tahu semua.', 'Gawat. {n}-nya sudah level berbahaya.'],
    /* 81-90 */ ['Parah banget! Sudah jadi legenda di mana-mana.', 'Astaga, ini mah level akut. Butuh penanganan serius.'],
    /* 91-99 */ ['Nyaris maksimal! Kurang sedikit lagi jadi juara dunia.', 'Hampir mencapai puncak. Alat ukur sampai berasap.'],
    /* 100 */ ['MAKSIMAL 100%! Juara dunia {n}, tidak ada yang bisa menandingi. Selamat (atau turut berduka).', 'PECAH! {n}-nya tembus batas alat ukur. Sudah layak dapat piala.'],
]

const tierOf = p => (p === 0 ? 0 : p === 100 ? 11 : Math.min(10, Math.ceil(p / 10)))
const SPIN = ['◐', '◓', '◑', '◒']
const STATUS = ['Memindai data', 'Mengukur level', 'Menganalisis aura', 'Menghitung skor', 'Membandingkan dengan database', 'Hampir selesai', 'Finalisasi hasil']
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pick = a => a[Math.floor(Math.random() * a.length)]
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
const bar = (p, w = 12) => '█'.repeat(Math.round((p / 100) * w)) + '░'.repeat(w - Math.round((p / 100) * w))

// persen naik acak (tidak rata), selalu berakhir 100
function steps() {
    const out = []
    let p = 0
    while (p < 100) { p = Math.min(100, p + 6 + Math.floor(Math.random() * 15)); out.push(p) }
    if (out[out.length - 1] !== 100) out.push(100)
    return out
}

// target: mention / reply / nomor di teks
function targetOf(m, text) {
    const set = new Set(m.mentionedJid || [])
    if (m.quoted?.sender) set.add(m.quoted.sender)
    for (const w of String(text || '').split(/[\s,]+/)) {
        const n = w.replace(/[^0-9]/g, '')
        if (n.length >= 8 && n.length <= 15) set.add(n + '@s.whatsapp.net')
    }
    return [...set][0]
}

const busy = new Set() // satu animasi per pengguna

let handler = async (m, { sock, text, reply }) => {
    if (busy.has(m.sender)) return reply('Tunggu hasil cek sebelumnya selesai dulu ya.')
    busy.add(m.sender)

    const t = targetOf(m, text)
    const who = t || m.sender
    const mentions = [who]
    const label = t && t !== m.sender ? '@' + t.split('@')[0] : 'mu'
    const title = `${NOUN}${label === 'mu' ? '' : ' '}${label}`
    const NN = cap(title)

    try {
        try { await sock.sendPresenceUpdate('composing', m.chat) } catch {}
        const seq = steps()
        const frame = (p, i) => `*CEK MALAS*\n\n${SPIN[i % SPIN.length]} ${STATUS[Math.min(STATUS.length - 1, Math.floor((p / 100) * STATUS.length))]}...\n\n${bar(p)} *${p}%*\n\n_Mengukur ${title}_`

        const sent = await sock.sendMessage(m.chat, { text: frame(0, 0), mentions }, { quoted: m })
        let canEdit = true
        for (let i = 0; i < seq.length; i++) {
            await sleep(750 + Math.floor(Math.random() * 350))
            try { await sock.sendMessage(m.chat, { text: frame(seq[i], i + 1), edit: sent.key, mentions }) } catch { canEdit = false; break }
        }

        const p = Math.floor(Math.random() * 101)
        const line = pick(TXT[tierOf(p)]).replace(/\{n\}/g, NOUN)
        const result = `*CEK MALAS*\n\n${bar(p)} *${p}%*\n\nTingkat ${title}: *${p}%*\n\n${line}\n\n_Hanya hiburan, jangan baper._`

        await sleep(600)
        if (canEdit) {
            try { await sock.sendMessage(m.chat, { text: result, edit: sent.key, mentions }); return } catch {}
        }
        await sock.sendMessage(m.chat, { text: result, mentions }, { quoted: m })
    } catch (e) {
        console.log('[cekmalas]', e.message)
        reply('Gagal menjalankan cek: ' + e.message)
    } finally {
        try { await sock.sendPresenceUpdate('paused', m.chat) } catch {}
        busy.delete(m.sender)
    }
}

handler.help = ['cekmalas [@user]']
handler.command = ['cekmalas']
handler.tags = ['cek']

export default handler
