// .adu — ADU OTAK: kuis solo atau duel 2–4 pemain, bisa bareng pasangan 💕
//
//   .adu solo [kategori]        main sendiri (3 nyawa, kejar skor & streak)
//   .adu @tag | reply | nomor   tantang teman      (.adu pasangan = tantang pasanganmu)
//   .adu buat                   buka lobi + kode   (.adu gabung KODE, host: .adu mulai)
//   tambahan di akhir: gantian | rebutan | angka 3-20 (jumlah soal) | kategori
//   jawab: ketik A/B/C/D langsung (tanpa titik) atau tekan tombol
//
// Mode:
//   gantian (bawaan) : bergiliran seperti sambung kata, tiap orang punya nyawa
//   rebutan          : soal sama untuk semua, yang benar duluan dapat poin
//
// Tiap pemain boleh berada di chat yang berbeda (mis. dua-duanya di chat pribadi bot),
// bot meneruskan soal & hasil ke chat masing-masing.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { adapt, rpgUser, persist, getCouple, partnerJid, toPN, tag } from '../../lib/engine/plugins.js'
import { cfg, beri } from '../../lib/engine/features.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HURUF = ['A', 'B', 'C', 'D']

// global supaya sesi tidak hilang saat plugin di-reload
const rooms = (global.__aduRooms ||= new Map()) // id -> room
const idx = (global.__aduIdx ||= new Map())     // jid pemain -> id room

// ───────── util ─────────
const acak = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    return a
}
const wibHari = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const nomor = (j) => String(j || '').split('@')[0].split(':')[0]
const hati = (n) => (n > 0 ? '❤️'.repeat(Math.min(n, 5)) : '💀')
const fmt = (n) => Number(n || 0).toLocaleString('id-ID')

let _bank
function bank() {
    if (_bank) return _bank
    const baca = (f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', f), 'utf8')) } catch { return [] } }
    // buang soal kembar (pertanyaan & jawaban sama, beda tanda baca saja)
    const norm = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const seen = new Set()
    _bank = [...baca('adu.json'), ...baca('quiz.json')]
        .filter((x) => x?.q && Array.isArray(x.o) && x.o.length >= 2 && x.o[x.a] !== undefined)
        .filter((x) => { const k = norm(x.q) + '|' + norm(x.o[x.a]); return !seen.has(k) && seen.add(k) })
    return _bank
}
const kategori = () => [...new Set(bank().map((x) => x.k))]

const cariRoom = (jid) => { const id = idx.get(jid); return id ? rooms.get(id) : null }
const cariPemain = (room, jid) => room.players.find((p) => p.jid === jid)
const hidup = (room) => room.players.filter((p) => p.nyawa > 0)
const chatsOf = (room) => [...new Set(room.players.map((p) => p.chat))]
const mentionsOf = (room) => room.players.map((p) => p.jid)

async function kirim(room, text, chats = chatsOf(room)) {
    for (const chat of chats) await room.conn.sendMessage(chat, { text, mentions: mentionsOf(room) }).catch(() => null)
}
const bilang = (room, p, text) => room.conn.sendMessage(p.chat, { text, mentions: [p.jid] }).catch(() => null)

function hapusRoom(room) {
    clearTimeout(room.timer); clearTimeout(room.lobi)
    rooms.delete(room.id)
    for (const p of room.players) if (idx.get(p.jid) === room.id) idx.delete(p.jid)
}

const papan = (room) => room.players.map((p) => {
    const nyawa = room.mode === 'rebutan' ? '' : ` ${hati(p.nyawa)}`
    return `• ${tag(p.jid)} — *${p.skor}* poin${nyawa}${p.streak >= 2 ? ` 🔥${p.streak}` : ''}`
}).join('\n')

const totalSoal = (room, c) => room.mode === 'solo' ? c.soloMaks
    : room.mode === 'gantian' ? (room.rounds || c.soalPerPemain) * room.players.length
    : (room.rounds || c.soalRebutan)

// ───────── soal ─────────
function soalBaru(room) {
    const semua = bank().filter((x) => !room.kat || x.k === room.kat)
    let pool = semua.filter((x) => !room.used.has(x.q))
    if (!pool.length) { room.used.clear(); pool = semua }
    const s = pool[Math.floor(Math.random() * pool.length)]
    room.used.add(s.q)
    const benarTeks = s.o[s.a]
    const lain = acak(s.o.filter((_, i) => i !== s.a)).slice(0, 3)
    const opsi = acak([benarTeks, ...lain])
    return { k: s.k, q: s.q, opsi, benar: opsi.indexOf(benarTeks), salah: new Set(), mulai: Date.now(), selesai: false }
}

async function tampil(room) {
    const c = cfg('adu')
    const s = room.q = soalBaru(room)
    room.no++
    const giliran = room.mode === 'rebutan' ? null : room.players[room.cur]
    const total = room.mode === 'solo' ? '' : `/${room.total}`
    const teks =
        `🧠 *ADU OTAK* • Soal ${room.no}${total} • ${s.k.toUpperCase()}\n` +
        (room.mode === 'solo' ? '🎮 Mode solo' : giliran ? `🎯 Giliran ${tag(giliran.jid)}` : '⚡ REBUTAN! Yang benar duluan dapat poin') + '\n\n' +
        `${s.q}\n\n${s.opsi.map((o, i) => `*${HURUF[i]}.* ${o}`).join('\n')}\n\n` +
        `⏱️ ${c.waktuDetik} detik • ketik *A/B/C/D*\n──────────\n${papan(room)}`

    for (const chat of chatsOf(room)) {
        const boleh = room.mode === 'rebutan' || (giliran && giliran.chat === chat)
        if (boleh && typeof room.conn.sendButtons === 'function') {
            try {
                await room.conn.sendButtons(chat, {
                    text: teks, mentions: mentionsOf(room), footer: global.namebot || 'Kaguya',
                    buttons: s.opsi.map((_, i) => ({ type: 'reply', text: HURUF[i], id: `${room.prefix}adu ${HURUF[i]}` }))
                })
                continue
            } catch { /* jatuh ke teks biasa */ }
        }
        await room.conn.sendMessage(chat, { text: teks, mentions: mentionsOf(room) }).catch(() => null)
    }
    clearTimeout(room.timer)
    room.timer = setTimeout(() => waktuHabis(room, s).catch((e) => console.error('[ADU]', e?.message || e)), c.waktuDetik * 1000)
    room.timer.unref?.()
}

const kunci = (s) => `Jawaban: *${HURUF[s.benar]}. ${s.opsi[s.benar]}*`

async function lanjut(room) {
    if (rooms.get(room.id) !== room || room.status !== 'play') return
    const c = cfg('adu')
    let akhir = null
    if (room.mode === 'solo') {
        if (room.players[0].nyawa <= 0) akhir = 'nyawa'
        else if (room.no >= room.total) akhir = 'maks'
    } else if (room.mode === 'gantian') {
        if (hidup(room).length <= 1) akhir = 'nyawa'
        else if (room.no >= room.total) akhir = 'soal'
    } else if (room.no >= room.total) akhir = 'soal'
    else if (room.sepi >= 3) akhir = 'sepi'
    if (akhir) return selesai(room, akhir)

    if (room.mode !== 'rebutan') {
        let n = room.cur
        do { n = (n + 1) % room.players.length } while (room.players[n].nyawa <= 0)
        room.cur = n
    }
    await new Promise((r) => setTimeout(r, 1500))
    if (rooms.get(room.id) !== room || room.status !== 'play') return
    await tampil(room)
}

async function waktuHabis(room, s) {
    if (rooms.get(room.id) !== room || room.q !== s || s.selesai) return
    s.selesai = true
    let teks = `⏰ *WAKTU HABIS!*\n${kunci(s)}`
    if (room.mode === 'rebutan') {
        room.sepi = s.salah.size ? 0 : room.sepi + 1
        room.players.forEach((p) => { p.streak = 0 })
    } else {
        const p = room.players[room.cur]
        p.nyawa--; p.streak = 0
        teks += `\n${tag(p.jid)} kehilangan 1 nyawa ${hati(p.nyawa)}${p.nyawa <= 0 ? '\n💀 Tereliminasi!' : ''}`
    }
    await kirim(room, teks)
    await lanjut(room)
}

// ───────── jawaban ─────────
async function proses(room, p, i) {
    const s = room.q
    if (room.status !== 'play' || !s || s.selesai) return false
    if (room.mode !== 'rebutan' && room.players[room.cur] !== p) {
        await bilang(room, p, `⏳ ${tag(p.jid)} bukan giliranmu, sabar ya~`)
        return true
    }
    if (s.salah.has(p.jid)) { await bilang(room, p, 'Kamu sudah menjawab soal ini 😉'); return true }
    if (i < 0 || i >= s.opsi.length) return false
    const c = cfg('adu')

    if (i === s.benar) {
        s.selesai = true
        clearTimeout(room.timer)
        const detik = (Date.now() - s.mulai) / 1000
        const cepat = Math.max(0, Math.round(5 * (1 - detik / c.waktuDetik)))
        p.streak++; p.benar++
        const bonus = p.streak >= 2 ? Math.min(p.streak - 1, 5) : 0
        const poin = 10 + cepat + bonus
        p.skor += poin
        room.sepi = 0
        await kirim(room, `✅ *BENAR!* ${tag(p.jid)} +${poin} poin (${detik.toFixed(1)} dtk${bonus ? ` • streak ${p.streak} 🔥` : ''})\n${kunci(s)}`)
        await lanjut(room)
        return true
    }

    p.streak = 0
    if (room.mode === 'rebutan') {
        s.salah.add(p.jid)
        if (s.salah.size >= room.players.length) {
            s.selesai = true
            clearTimeout(room.timer)
            room.sepi = 0
            await kirim(room, `❌ Semua salah!\n${kunci(s)}`)
            await lanjut(room)
        } else {
            await kirim(room, `❌ ${tag(p.jid)} salah & terkunci di soal ini. Yang lain masih bisa jawab!`)
        }
        return true
    }

    s.selesai = true
    clearTimeout(room.timer)
    p.nyawa--
    await kirim(room, `❌ *SALAH!* ${tag(p.jid)} kehilangan 1 nyawa ${hati(p.nyawa)}\n${kunci(s)}${p.nyawa <= 0 ? '\n💀 Tereliminasi!' : ''}`)
    await lanjut(room)
    return true
}

// ───────── mulai & selesai ─────────
async function mulai(room) {
    const c = cfg('adu')
    clearTimeout(room.lobi)
    room.status = 'play'
    room.no = 0; room.sepi = 0
    room.total = totalSoal(room, c)
    room.cur = Math.floor(Math.random() * room.players.length)
    room.players.forEach((p) => {
        Object.assign(p, { nyawa: room.mode === 'rebutan' ? 99 : c.nyawa, skor: 0, streak: 0, benar: 0 })
    })
    const info = room.mode === 'solo'
        ? `🎮 *SOLO* • ${c.nyawa} nyawa • jawab sebanyak mungkin!`
        : room.mode === 'gantian'
            ? `🔁 *GANTIAN* • ${room.total} soal • ${c.nyawa} nyawa per orang\nSalah / telat = nyawa berkurang. Nyawa habis = kalah.`
            : `⚡ *REBUTAN* • ${room.total} soal • soal sama untuk semua\nBenar duluan = poin. Salah = terkunci di soal itu.`
    await kirim(room, `🧠 *ADU OTAK DIMULAI!*\n\n${info}\nKategori: ${room.kat || 'campur'}\n\n${papan(room)}`)
    await new Promise((r) => setTimeout(r, 1200))
    if (rooms.get(room.id) === room) await tampil(room)
}

function dayCap(u, jenis, max) {
    if (!u.aduDay || u.aduDay.t !== wibHari()) u.aduDay = { t: wibHari(), duel: 0, solo: 0 }
    return u.aduDay[jenis] < max
}

async function selesai(room, alasan, penyerah = null) {
    if (rooms.get(room.id) !== room) return
    room.status = 'selesai'
    hapusRoom(room)
    const c = cfg('adu')

    if (room.mode === 'solo') {
        const p = room.players[0]
        const u = rpgUser(p.jid)
        let hadiah = ''
        if (p.benar > 0 && dayCap(u, 'solo', c.maxSoloPerHari)) {
            const n = Math.min(p.benar, c.soloMaksHadiah)
            const got = beri(u, Object.fromEntries(Object.entries(c.hadiahSoloPerBenar).map(([k, v]) => [k, v * n])))
            u.aduDay.solo++
            hadiah = `\n🎁 ${got.join(' • ')}`
        } else if (p.benar > 0) hadiah = '\n🎁 Batas hadiah solo hari ini sudah tercapai (skor tetap tercatat).'
        const rekor = p.skor > (u.aduSoloBest || 0)
        if (rekor) u.aduSoloBest = p.skor
        persist()
        return kirim(room, `🏁 *SOLO SELESAI!*\n\n${tag(p.jid)}\n🧮 Skor: *${p.skor}*${rekor ? ' 🏆 REKOR BARU!' : ` (rekor ${u.aduSoloBest})`}\n✅ Benar: ${p.benar} • ❌ Salah/telat: ${room.no - p.benar}${hadiah}\n\nMain lagi: *${room.prefix}adu solo*`)
    }

    // ranking
    const nilai = (p) => (p === penyerah ? -1e9 : 0) + (alasan === 'nyawa' && p.nyawa > 0 ? 1e6 : 0) + p.skor * 1000 + Math.max(0, room.mode === 'gantian' ? p.nyawa : 0)
    const urut = [...room.players].sort((a, b) => nilai(b) - nilai(a))
    const juara = urut.filter((p) => nilai(p) === nilai(urut[0]))
    const seri = juara.length > 1
    const layak = room.no >= c.minSoalHadiah

    const baris = []
    for (const [n, p] of urut.entries()) {
        const u = rpgUser(p.jid)
        const menang = juara.includes(p)
        let got = ''
        if (layak && p !== penyerah) {
            if (dayCap(u, 'duel', c.maxHadiahPerHari)) {
                const h = menang ? (seri ? c.hadiahSeri : c.hadiahMenang) : c.hadiahKalah
                got = ` → 🎁 ${beri(u, h).join(' • ')}`
                u.aduDay.duel++
            } else got = ' → batas hadiah harian tercapai'
        }
        if (layak) {
            u.aduSkor = (u.aduSkor || 0) + p.skor
            if (seri && menang) u.aduSeri = (u.aduSeri || 0) + 1
            else if (menang) u.aduMenang = (u.aduMenang || 0) + 1
            else u.aduKalah = (u.aduKalah || 0) + 1
        }
        baris.push(`${n + 1}. ${tag(p.jid)} — *${p.skor}* poin • ✅${p.benar}${p === penyerah ? ' • 🏳️ menyerah' : ''}${got}`)
    }

    // bonus Love Point kalau dua pemain ini adalah pasangan
    let lpTeks = ''
    if (layak && !penyerah && room.players.length === 2 && c.lpPasangan > 0) {
        try {
            const cp = getCouple({ sender: room.players[0].jid }, { touch: false })
            if (cp && cp.pNum === nomor(room.players[1].jid)) {
                if (!cp.rec.aduDay || cp.rec.aduDay.t !== wibHari()) cp.rec.aduDay = { t: wibHari(), n: 0 }
                if (cp.rec.aduDay.n < c.lpMaksPerHari) {
                    cp.rec.aduDay.n++
                    cp.rec.love = (Number(cp.rec.love) || 0) + c.lpPasangan
                    lpTeks = `\n💕 Main bareng pasangan: Love Point +${c.lpPasangan}`
                }
            }
        } catch { /* abaikan */ }
    }
    persist()

    const judul = penyerah ? `🏳️ ${tag(penyerah.jid)} menyerah.\n🏆 Pemenang: ${juara.map((p) => tag(p.jid)).join(' & ')}`
        : seri ? `🤝 *SERI!* ${juara.map((p) => tag(p.jid)).join(' & ')}`
            : `🏆 Pemenang: ${tag(juara[0].jid)}`
    const catatan = layak ? '' : `\n\n_(Hadiah & statistik hanya untuk game minimal ${c.minSoalHadiah} soal.)_`
    await kirim(room, `🏁 *ADU OTAK SELESAI!*\n\n${judul}\n──────────\n${baris.join('\n')}${lpTeks}${catatan}\n\nMain lagi: *${room.prefix}adu*`)
}

// ───────── lobi ─────────
function kodeBaru() {
    const h = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let k
    do { k = Array.from({ length: 4 }, () => h[Math.floor(Math.random() * h.length)]).join('') }
    while ([...rooms.values()].some((r) => r.kode === k))
    return k
}

function buatRoom(conn, m, prefix, opt, host, extra = {}) {
    const room = {
        id: `adu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kode: kodeBaru(), mode: opt.mode, kat: opt.kat, rounds: opt.rounds, prefix,
        status: 'wait', players: [{ jid: host, chat: m.chat }], used: new Set(),
        q: null, no: 0, cur: 0, sepi: 0, total: 0, timer: null, lobi: null, conn, ...extra
    }
    rooms.set(room.id, room)
    idx.set(host, room.id)
    return room
}

function jadwalLobi(room, detik, pesan) {
    room.lobi = setTimeout(async () => {
        if (rooms.get(room.id) !== room || room.status !== 'wait') return
        hapusRoom(room)
        await kirim(room, pesan)
    }, detik * 1000)
    room.lobi.unref?.()
}

function parseOpt(tokens) {
    const c = cfg('adu')
    const opt = { mode: 'gantian', kat: '', rounds: 0 }
    const kats = kategori()
    for (const t of tokens.map((x) => x.toLowerCase())) {
        if (/^(gantian|giliran|turn)$/.test(t)) opt.mode = 'gantian'
        else if (/^(rebutan|cepat|race)$/.test(t)) opt.mode = 'rebutan'
        else if (/^\d{1,2}$/.test(t)) opt.rounds = Math.min(20, Math.max(3, parseInt(t)))
        else if (kats.includes(t)) opt.kat = t
        else if (/^(campur|acak|semua)$/.test(t)) opt.kat = ''
    }
    return { opt, c }
}

const bantuan = (p) =>
    `🧠 *ADU OTAK*\nKuis seru buat sendiri, berdua, atau bareng pasangan!\n\n` +
    `🎮 *Solo*\n• ${p}adu solo [kategori]\n\n` +
    `⚔️ *Duel*\n• ${p}adu @tag — tantang teman (atau reply pesannya)\n• ${p}adu pasangan — tantang pasanganmu 💕\n• ${p}adu 62812xxxx — tantang lewat nomor (bisa dari chat pribadi)\n• ${p}adu buat — buka lobi berkode, teman: ${p}adu gabung KODE, host: ${p}adu mulai\n\n` +
    `🧩 *Tambahan* (taruh di akhir)\n• *gantian* (bawaan): bergiliran, ada nyawa, mirip sambung kata\n• *rebutan*: soal sama, tercepat & benar dapat poin\n• angka 3–20: jumlah soal\n• kategori: ${kategori().join(', ')}\n\n` +
    `Contoh: ${p}adu pasangan rebutan 10 anime\n\n` +
    `✍️ Jawab dengan ketik *A/B/C/D* langsung, atau tekan tombol.\n📊 ${p}adu top • 🏳️ ${p}adu stop`

// ───────── command ─────────
let handler = async (m, { conn, args, usedPrefix }) => {
    const p = usedPrefix
    const sub = String(args[0] || '').toLowerCase()
    const me = m.sender
    const room = cariRoom(me)

    // jawab lewat tombol / command: .adu A
    if (/^[a-d]$/i.test(sub)) {
        if (!room || room.status !== 'play') return m.reply(`Tidak ada Adu Otak yang aktif. Mulai dengan *${p}adu*`)
        const pl = cariPemain(room, me)
        return void (await proses(room, pl, HURUF.indexOf(sub.toUpperCase())))
    }

    if (!sub || /^(help|bantuan|menu)$/.test(sub)) return m.reply(bantuan(p))

    if (/^(top|skor|rank|stat)$/.test(sub)) {
        const users = Object.entries(global.db?.data?.users || {})
            .filter(([, u]) => (u.aduMenang || 0) + (u.aduKalah || 0) + (u.aduSeri || 0) + (u.aduSoloBest || 0) > 0)
            .sort(([, a], [, b]) => (b.aduMenang || 0) - (a.aduMenang || 0) || (b.aduSoloBest || 0) - (a.aduSoloBest || 0))
        const top = users.slice(0, 10)
        const mine = rpgUser(me)
        const teks = `🏆 *TOP ADU OTAK*\n\n` +
            (top.length ? top.map(([j, u], i) => `${i + 1}. ${tag(j)} — ${u.aduMenang || 0}M ${u.aduSeri || 0}S ${u.aduKalah || 0}K • solo ${u.aduSoloBest || 0}`).join('\n') : '_Belum ada data._') +
            `\n\n📊 *Kamu:* ${mine.aduMenang || 0} menang • ${mine.aduSeri || 0} seri • ${mine.aduKalah || 0} kalah • rekor solo ${mine.aduSoloBest || 0}\n_(M=menang S=seri K=kalah)_`
        return conn.sendMessage(m.chat, { text: teks, mentions: top.map(([j]) => j) }, { quoted: m })
    }

    // ── henti / menyerah ──
    if (/^(stop|nyerah|menyerah|batal|keluar)$/.test(sub)) {
        if (!room) return m.reply('Kamu tidak sedang dalam sesi Adu Otak.')
        if (room.status === 'wait') {
            if (room.players[0].jid !== me) {
                room.players = room.players.filter((x) => x.jid !== me); idx.delete(me)
                return m.reply('Kamu keluar dari lobi.')
            }
            hapusRoom(room)
            return kirim(room, '🧠 Lobi Adu Otak dibatalkan.')
        }
        if (room.mode === 'solo') { await kirim(room, '🏳️ Solo dihentikan.'); return selesai(room, 'berhenti') }
        if (room.players.length === 2) return selesai(room, 'menyerah', cariPemain(room, me))
        if (room.players[0].jid !== me) return m.reply('Di permainan lebih dari 2 orang, hanya host yang bisa menghentikan.')
        hapusRoom(room)
        return kirim(room, '🧠 Adu Otak dihentikan oleh host (tanpa hadiah).')
    }

    // ── terima / tolak tantangan (lewat command) ──
    if (/^(terima|acc|gas)$/.test(sub)) return void (await balasTantangan(conn, m, true, p))
    if (/^(tolak)$/.test(sub)) return void (await balasTantangan(conn, m, false, p))

    // sudah ada sesi lain?
    const sibuk = () => room && m.reply(`Kamu masih di sesi Adu Otak (${room.status === 'wait' ? 'lobi' : 'berjalan'}). Ketik *${p}adu stop* dulu ya.`)

    // ── mulai lobi ──
    if (sub === 'mulai') {
        if (!room || room.status !== 'wait') return m.reply('Tidak ada lobi yang bisa dimulai.')
        if (room.players[0].jid !== me) return m.reply('Hanya host yang bisa memulai.')
        if (room.players.length < 2) return m.reply(`Butuh minimal 2 pemain. Bagikan kode *${room.kode}* (${p}adu gabung ${room.kode}).`)
        return mulai(room)
    }

    // ── gabung ──
    if (sub === 'gabung' || sub === 'join') {
        if (sibuk()) return
        const kode = String(args[1] || '').toUpperCase()
        const c = cfg('adu')
        let target = [...rooms.values()].find((r) => r.status === 'wait' && (kode ? r.kode === kode : (r.players.some((x) => x.chat === m.chat) && !r.undang)))
        if (!target) return m.reply(kode ? 'Kode lobi tidak ditemukan / sudah mulai.' : `Tidak ada lobi di chat ini. Pakai *${p}adu gabung KODE*.`)
        if (target.undang && target.undang !== me) return m.reply('Ini tantangan privat untuk orang lain.')
        if (target.players.length >= (target.undang ? 2 : c.maxPemain)) return m.reply('Lobi sudah penuh.')
        target.players.push({ jid: me, chat: m.chat }); idx.set(me, target.id)
        if (target.undang) return mulai(target)
        return kirim(target, `✅ ${tag(me)} bergabung! (${target.players.length}/${c.maxPemain})\n\n${target.players.map((x, i) => `${i + 1}. ${tag(x.jid)}`).join('\n')}\n\nHost (${tag(target.players[0].jid)}) ketik *${p}adu mulai*`)
    }

    // ── solo ──
    if (sub === 'solo' || sub === 'sendiri') {
        if (sibuk()) return
        const { opt } = parseOpt(args.slice(1))
        const r = buatRoom(conn, m, p, { ...opt, mode: 'solo' }, me)
        return mulai(r)
    }

    // ── lobi terbuka ──
    if (sub === 'buat' || sub === 'lobi' || sub === 'room') {
        if (sibuk()) return
        const { opt, c } = parseOpt(args.slice(1))
        const r = buatRoom(conn, m, p, opt, me)
        jadwalLobi(r, c.lobiDetik, '⌛ Lobi Adu Otak ditutup karena tidak ada yang mulai.')
        const grup = m.chat.endsWith('@g.us')
        return m.reply(`🧠 *LOBI ADU OTAK*\nMode: *${opt.mode}* • Kategori: ${opt.kat || 'campur'}${opt.rounds ? ` • ${opt.rounds} soal` : ''}\nKode: *${r.kode}*\n\n` +
            (grup ? `Yang mau ikut ketik *${p}adu gabung* (atau ${p}adu gabung ${r.kode}).` : `Suruh pasangan/temanmu ketik *${p}adu gabung ${r.kode}* ke bot ini.`) +
            `\nSetelah ≥2 orang, host ketik *${p}adu mulai*. (${c.lobiDetik} detik)`)
    }

    // ── tantang seseorang (tag / reply / nomor / pasangan) ──
    if (sibuk()) return
    const { opt, c } = parseOpt(args)
    let lawan = m.mentionedJid?.[0] || m.quoted?.sender
    const angka = args.find((a) => /^\+?\d{8,15}$/.test(a))
    if (!lawan && angka) lawan = `${angka.replace('+', '')}@s.whatsapp.net`
    if (!lawan && /^(pasangan|doi|pacar|ayang|sayang)$/.test(sub)) {
        const cp = getCouple(m)
        if (!cp) return m.reply(`💔 Kamu belum punya pasangan.\nCari dulu dengan *${p}tembak @tag*, atau tantang teman: *${p}adu @tag*`)
        lawan = await partnerJid(conn, cp).catch(() => null) || await toPN(conn, cp.partner)
    }
    if (!lawan) {
        if (/^(gantian|giliran|rebutan|cepat|race|campur|acak|semua)$/.test(sub) || kategori().includes(sub) || /^\d{1,2}$/.test(sub)) {
            return m.reply(`Mau lawan siapa? Tag orangnya: *${p}adu @tag ${args.join(' ')}*\nAtau main sendiri: *${p}adu solo*`)
        }
        return m.reply(bantuan(p))
    }
    lawan = await toPN(conn, lawan)
    if (nomor(lawan) === nomor(me)) return m.reply('Tidak bisa menantang diri sendiri 😅 Coba *' + p + 'adu solo*')
    if (nomor(lawan) === nomor(conn.user?.id)) return m.reply('Aku cuma jadi juri 😌')
    if (cariRoom(lawan)) return m.reply('Orang itu sedang bermain Adu Otak dengan orang lain.')

    const r = buatRoom(conn, m, p, opt, me, { undang: lawan })
    jadwalLobi(r, c.undanganDetik, `⌛ Tantangan Adu Otak untuk ${tag(lawan)} kedaluwarsa.`)
    const info = `Mode: *${opt.mode}* • Kategori: ${opt.kat || 'campur'}${opt.rounds ? ` • ${opt.rounds} soal` : ''}`
    const teks = `⚔️ *TANTANGAN ADU OTAK*\n\n${tag(me)} menantang ${tag(lawan)}!\n${info}\n\n${tag(lawan)}, ketik *terima* atau *tolak* (${c.undanganDetik} detik).` +
        (m.chat.endsWith('@g.us') ? '' : `\n_(Kalau pesan ini tidak sampai ke dia, suruh dia ketik ${p}adu gabung ${r.kode})_`)
    r.players[0].chat = m.chat
    await conn.sendMessage(m.chat, { text: teks, mentions: [me, lawan] }, { quoted: m })
    // di chat pribadi: kirim juga undangan ke DM lawan
    if (!m.chat.endsWith('@g.us')) {
        await conn.sendMessage(lawan, { text: teks, mentions: [me, lawan] }).catch(() => null)
    }
}

async function balasTantangan(conn, m, terima, prefix) {
    const me = m.sender
    const room = [...rooms.values()].find((r) => r.status === 'wait' && r.undang === me)
    if (!room) return false
    if (!terima) {
        hapusRoom(room)
        await kirim(room, `😅 ${tag(me)} menolak tantangan ${tag(room.players[0].jid)}.`, [...new Set([room.players[0].chat, m.chat])])
        return true
    }
    if (cariRoom(me)) { await m.reply(`Selesaikan sesimu dulu: *${prefix}adu stop*`); return true }
    room.players.push({ jid: me, chat: m.chat }); idx.set(me, room.id)
    await mulai(room)
    return true
}

// jawaban tanpa prefix: A/B/C/D, serta terima/tolak tantangan
handler.before = async (m, ctx) => {
    if (m.fromMe || m.isBaileys) return false
    const txt = String(m.text ?? ctx?.text ?? '').trim().toLowerCase().replace(/[.!]+$/, '')
    const conn = ctx?.conn
    const prefix = ctx?.usedPrefix || '.'

    const undangan = [...rooms.values()].find((r) => r.status === 'wait' && r.undang === m.sender)
    if (undangan && /^(terima|acc|accept|gas|ok|oke|siap|ayo|mau)$/.test(txt)) return balasTantangan(conn, m, true, prefix)
    if (undangan && /^(tolak|gamau|nggak|enggak|gak|nanti|skip)$/.test(txt)) return balasTantangan(conn, m, false, prefix)

    if (!/^[a-d]$/.test(txt)) return false
    const room = cariRoom(m.sender)
    if (!room || room.status !== 'play') return false
    const p = cariPemain(room, m.sender)
    if (!p || p.chat !== m.chat) return false
    return proses(room, p, HURUF.indexOf(txt.toUpperCase()))
}

handler.help = ['adu', 'adu solo', 'adu @tag', 'adu pasangan', 'adu buat', 'adu top']
handler.tags = ['game']
handler.command = ['adu', 'aduotak', 'kuisduel']
handler.exp = 0

export default adapt(handler, {
    category: 'game',
    customPrefix: /^\s*(?:[a-d]|terima|tolak|acc|accept|gas|ok|oke|siap|ayo|mau|gamau|nggak|enggak|gak|nanti|skip)\s*[.!]*\s*$/i
})
