// CEK PEMBERANI — cek tingkat keberanian dengan loading animasi (pesan di-edit sampai 100%), hasil acak 0-100%
//   .cekpemberani [@tag / reply / nomor]
//   Sifat bagus: 0% = buruk ... 100% = bagus

const NOUN = 'keberanian'

// teks penilaian per tingkatan: 0 | 1-10 | 11-20 | ... | 91-99 | 100   ({n} = nama sifat)
const TXT = [
    /* 0   */ ['{n} nol besar. Sama sekali tidak terdeteksi, alat ukurnya sampai bingung.', 'Kosong melompong. Tidak ada {n} sedikit pun, mungkin sedang libur panjang.'],
    /* 1-10 */ ['Nyaris tak terlihat. Perlu kaca pembesar buat nemuin {n}-nya.', 'Sangat rendah. Tapi tenang, semua legenda pernah mulai dari bawah.'],
    /* 11-20 */ ['Masih sangat kurang. Butuh banyak usaha dan doa.', 'Rendah banget. Jangan menyerah, masih ada jalan.'],
    /* 21-30 */ ['Di bawah rata-rata. Ada bibit, tinggal disiram tiap hari.', 'Kurang, tapi belum parah. Masih bisa diperbaiki.'],
    /* 31-40 */ ['Mulai kelihatan sedikit. Terus semangat, jangan kendor.', 'Lumayan lah, walau belum bisa dibanggakan.'],
    /* 41-50 */ ['Hampir setengah jalan. Standar orang biasa, aman.', 'Pas-pasan tapi nyaman. Tidak mengecewakan, tidak mengagumkan.'],
    /* 51-60 */ ['Di atas rata-rata. Mulai ada yang melirik nih.', 'Lumayan bagus! Sudah lewat setengah, tinggal dipoles.'],
    /* 61-70 */ ['Bagus! Banyak orang yang diam-diam mengakuinya.', 'Mantap. {n}-nya sudah kelihatan dari jauh.'],
    /* 71-80 */ ['Keren banget! Level ini jarang dimiliki orang.', 'Hebat. Sudah masuk kelas atas, tinggal sedikit lagi.'],
    /* 81-90 */ ['Luar biasa! Hampir sempurna, orang-orang pasti iri.', 'Wow, ini level elite. Layak jadi panutan.'],
    /* 91-99 */ ['Nyaris sempurna! Kurang sedikit lagi jadi legenda.', 'Dewa banget. Alat ukur sampai hampir meledak.'],
    /* 100 */ ['SEMPURNA 100%! Level legenda, tidak ada tandingannya. Semua orang tunduk.', 'MAKSIMAL! {n}-nya menembus batas, layak diabadikan dalam sejarah.'],
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
        const frame = (p, i) => `*CEK PEMBERANI*\n\n${SPIN[i % SPIN.length]} ${STATUS[Math.min(STATUS.length - 1, Math.floor((p / 100) * STATUS.length))]}...\n\n${bar(p)} *${p}%*\n\n_Mengukur ${title}_`

        const sent = await sock.sendMessage(m.chat, { text: frame(0, 0), mentions }, { quoted: m })
        let canEdit = true
        for (let i = 0; i < seq.length; i++) {
            await sleep(750 + Math.floor(Math.random() * 350))
            try { await sock.sendMessage(m.chat, { text: frame(seq[i], i + 1), edit: sent.key, mentions }) } catch { canEdit = false; break }
        }

        const p = Math.floor(Math.random() * 101)
        const line = pick(TXT[tierOf(p)]).replace(/\{n\}/g, NOUN)
        const result = `*CEK PEMBERANI*\n\n${bar(p)} *${p}%*\n\nTingkat ${title}: *${p}%*\n\n${line}\n\n_Hanya hiburan, jangan baper._`

        await sleep(600)
        if (canEdit) {
            try { await sock.sendMessage(m.chat, { text: result, edit: sent.key, mentions }); return } catch {}
        }
        await sock.sendMessage(m.chat, { text: result, mentions }, { quoted: m })
    } catch (e) {
        console.log('[cekpemberani]', e.message)
        reply('Gagal menjalankan cek: ' + e.message)
    } finally {
        try { await sock.sendPresenceUpdate('paused', m.chat) } catch {}
        busy.delete(m.sender)
    }
}

handler.help = ['cekpemberani [@user]']
handler.command = ['cekpemberani']
handler.tags = ['cek']

export default handler
