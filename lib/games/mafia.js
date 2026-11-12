// ───────── lib/games/mafia.js ─────────
// Mafia (4-20 pemain) dengan fase malam & siang. Peran: mafia, dokter, detektif, warga.
// Aksi malam dikirim lewat chat pribadi ke bot: `.mafia-aksi <nomor>`.
// Fase otomatis lanjut kalau semua sudah beraksi / waktu habis (timer berjalan di memori;
// kalau bot restart, host/admin pakai `.mafia-skip` atau `.mafia-stop`).

import { store, tag, send, sendTo, addCoin, num, now, shuffle, pickRandom } from './common.js'

const NIGHT_MS = 90 * 1000
const DAY_MS = 150 * 1000
const REWARD = 200
const data = () => { const s = store('mafia'); s.games ||= {}; return s }
const timers = new Map() // chat -> handle

const ROLE = {
    mafia: { icon: '🔪', name: 'Mafia', desc: 'Tiap malam pilih 1 korban bersama sesama mafia. Menang jika jumlah mafia ≥ jumlah warga hidup.', act: 'Pilih korban' },
    dokter: { icon: '💉', name: 'Dokter', desc: 'Tiap malam lindungi 1 pemain (boleh dirimu) dari serangan mafia.', act: 'Pilih yang dilindungi' },
    detektif: { icon: '🕵️', name: 'Detektif', desc: 'Tiap malam selidiki 1 pemain, kamu akan tahu dia mafia atau bukan.', act: 'Pilih yang diselidiki' },
    warga: { icon: '👤', name: 'Warga', desc: 'Tidak punya kemampuan malam. Cari mafia lewat diskusi & voting siang.' }
}

export const assignRoles = (n) => {
    const mafia = Math.max(1, Math.floor(n / 3))
    const roles = Array(mafia).fill('mafia')
    if (n >= 4) roles.push('dokter')
    if (n >= 5) roles.push('detektif')
    while (roles.length < n) roles.push('warga')
    return shuffle(roles)
}

const alive = (g) => g.players.filter(p => p.alive)
const list = (g, onlyAlive = true) => g.players.map((p, i) => ({ p, n: i + 1 })).filter(x => !onlyAlive || x.p.alive).map(x => `${x.n}. ${tag(x.p.id)}${x.p.alive ? '' : ' ☠️'}`).join('\n')

export function checkWin(g) {
    const a = alive(g)
    const mf = a.filter(p => p.role === 'mafia').length
    if (!mf) return 'warga'
    if (mf >= a.length - mf) return 'mafia'
    return null
}

export const resolveNight = (g) => {
    const votes = {}
    for (const [, t] of Object.entries(g.night.mafia)) votes[t] = (votes[t] || 0) + 1
    let victim = null
    const top = Math.max(0, ...Object.values(votes))
    if (top) victim = +pickRandom(Object.entries(votes).filter(([, c]) => c === top).map(([t]) => t))
    const saved = g.night.dokter != null && g.night.dokter === victim
    return { victim: victim != null && !saved ? victim : null, saved: victim != null && saved ? victim : null }
}

export const tally = (g) => {
    const c = {}
    for (const t of Object.values(g.votes)) c[t] = (c[t] || 0) + 1
    const top = Math.max(0, ...Object.values(c))
    const lead = Object.entries(c).filter(([, n]) => n === top).map(([t]) => +t)
    return { c, top, lead }
}

// ───────── mesin (tanpa A, supaya bisa dipanggil dari timer) ─────────
function mkEnv(Bot, chat) {
    return { Bot, chat, say: (t, men = []) => Bot.sendMessage(chat, { text: t, mentions: men }).catch(() => {}) }
}
const clearTimer = (chat) => { const t = timers.get(chat); if (t) clearTimeout(t); timers.delete(chat) }
const arm = (env, ms, fn) => { clearTimer(env.chat); timers.set(env.chat, setTimeout(() => fn().catch(() => {}), ms)) }

async function endGame(env, g, winner) {
    clearTimer(env.chat)
    const s = data()
    const winners = g.players.filter(p => (winner === 'mafia') === (p.role === 'mafia'))
    winners.forEach(p => addCoin(p.id, REWARD))
    delete s.games[env.chat]
    const roles = g.players.map(p => `${ROLE[p.role].icon} ${tag(p.id)} — ${ROLE[p.role].name}${p.alive ? '' : ' ☠️'}`).join('\n')
    return env.say(`🏁 *Mafia selesai!* ${winner === 'mafia' ? '🔪 MAFIA menguasai kota!' : '🎉 WARGA berhasil menumpas mafia!'}\n\n${roles}\n\n🎁 Pemenang masing-masing +${REWARD} koin`, g.players.map(p => p.id))
}

async function startNight(env, g) {
    g.phase = 'night'; g.night = { mafia: {}, dokter: null, detektif: null }; g.votes = {}
    await env.say(`🌙 *Malam ke-${g.day}* — kota tertidur.\nPemain hidup:\n${list(g)}\n\nMafia, dokter & detektif: kirim aksi lewat chat pribadi bot → *.mafia-aksi <nomor>* (${Math.round(NIGHT_MS / 1000)} detik).`, alive(g).map(p => p.id))
    for (const p of alive(g)) if (['mafia', 'dokter', 'detektif'].includes(p.role)) {
        await env.Bot.sendMessage(p.id, { text: `🌙 Malam ke-${g.day} — ${ROLE[p.role].act}:\n${list(g)}\n\nBalas dengan: *.mafia-aksi <nomor>*` }).catch(() => {})
    }
    arm(env, NIGHT_MS, () => nightEnd(env))
}

async function nightEnd(env) {
    const g = data().games[env.chat]
    if (!g || g.phase !== 'night') return
    clearTimer(env.chat)
    const r = resolveNight(g)
    let text = `☀️ *Pagi hari ke-${g.day}*\n`
    if (r.victim != null) {
        const v = g.players[r.victim]; v.alive = false
        text += `💀 ${tag(v.id)} ditemukan tewas diserang mafia. Dia seorang ${ROLE[v.role].name}.`
    } else if (r.saved != null) text += `✨ Seseorang diserang mafia tapi diselamatkan dokter! Tidak ada korban.`
    else text += `Malam yang tenang, tidak ada korban.`
    await env.say(text, g.players.map(p => p.id))
    const w = checkWin(g)
    if (w) return endGame(env, g, w)
    g.phase = 'day'; g.votes = {}
    await env.say(`🗣️ Diskusikan siapa mafianya, lalu voting di grup: *.mafia-vote <nomor>* (${Math.round(DAY_MS / 1000)} detik)\n\n${list(g)}`, alive(g).map(p => p.id))
    arm(env, DAY_MS, () => dayEnd(env))
}

async function dayEnd(env) {
    const g = data().games[env.chat]
    if (!g || g.phase !== 'day') return
    clearTimer(env.chat)
    const { c, lead } = tally(g)
    let text = '⚖️ *Hasil voting*\n' + (Object.keys(c).length ? Object.entries(c).map(([t, n]) => `${tag(g.players[t].id)}: ${n} suara`).join('\n') : 'Tidak ada yang memilih.') + '\n\n'
    if (lead.length === 1 && Object.keys(c).length) {
        const v = g.players[lead[0]]; v.alive = false
        text += `🪢 ${tag(v.id)} digantung warga! Dia seorang ${ROLE[v.role].name}.`
    } else text += 'Suara seri / tidak ada — tidak ada yang digantung.'
    await env.say(text, g.players.map(p => p.id))
    const w = checkWin(g)
    if (w) return endGame(env, g, w)
    g.day++
    return startNight(env, g)
}

const nightDone = (g) => alive(g).every(p => {
    const i = g.players.indexOf(p)
    if (p.role === 'mafia') return g.night.mafia[i] != null
    if (p.role === 'dokter') return g.night.dokter != null
    if (p.role === 'detektif') return g.night.detektif != null
    return true
})

// ───────── command ─────────
export async function mafiaRun(A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    const s = data()

    // aksi malam datang dari chat pribadi
    if (sub === 'aksi' || sub === 'role') {
        const entry = Object.entries(s.games).find(([, gg]) => gg.started && gg.players.some(p => p.id === sender))
        if (!entry) return reply('Kamu tidak sedang ikut permainan Mafia yang berjalan.')
        const [chat, g] = entry
        const idx = g.players.findIndex(p => p.id === sender)
        const me = g.players[idx]
        if (sub === 'role') return reply(`${ROLE[me.role].icon} Kamu *${ROLE[me.role].name}*.\n${ROLE[me.role].desc}${me.role === 'mafia' ? `\nTeman mafia: ${g.players.filter(p => p.role === 'mafia' && p !== me).map(p => tag(p.id)).join(', ') || '(tidak ada)'}` : ''}`)
        if (m.isGroup) return reply('Kirim aksi malam lewat chat *pribadi* bot supaya rahasia.')
        if (g.phase !== 'night') return reply('Sekarang bukan malam hari.')
        if (!me.alive) return reply('Kamu sudah tewas ☠️')
        if (!['mafia', 'dokter', 'detektif'].includes(me.role)) return reply('Warga tidak punya aksi malam. Tidur saja 😴')
        const n = num(A.args[0]) - 1
        if (!(n >= 0 && n < g.players.length) || !g.players[n].alive) return reply(`Nomor tidak valid. Pilih:\n${list(g)}`)
        if (me.role === 'mafia' && g.players[n].role === 'mafia') return reply('Tidak boleh membunuh sesama mafia.')
        if (me.role === 'mafia') g.night.mafia[idx] = n
        else if (me.role === 'dokter') g.night.dokter = n
        else {
            g.night.detektif = n
            await reply(`🕵️ ${tag(g.players[n].id)} adalah ${g.players[n].role === 'mafia' ? '*MAFIA* 🔪' : '*bukan mafia* ✅'}`)
        }
        const env = mkEnv(A.Bot, chat)
        if (me.role !== 'detektif') await reply(`✅ Pilihanmu tercatat: ${tag(g.players[n].id)}`)
        if (nightDone(g)) return nightEnd(env)
        return null
    }

    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup (kecuali mafia-aksi & mafia-role).')
    const chat = m.chat
    const g = s.games[chat]
    const env = mkEnv(A.Bot, chat)
    const say = (t, men) => send(A, t, men || (g ? g.players.map(p => p.id) : []))
    const isHost = () => g && (sender === g.host || A.isAdmins || A.isOwner)

    if (sub === 'help') return say(`🔪 *Mafia*\n\n• ${P}mafia — buat permainan (4-20 pemain)\n• ${P}mafia-join — bergabung\n• ${P}mafia-start — mulai & bagi peran (host)\n• ${P}mafia-role — (chat pribadi) ingat perananmu\n• ${P}mafia-aksi <nomor> — (chat pribadi) aksi malam\n• ${P}mafia-vote <nomor> — voting siang di grup\n• ${P}mafia-status — daftar pemain\n• ${P}mafia-skip — lompati fase (host/admin)\n• ${P}mafia-stop — hentikan\n\nPeran: 🔪 Mafia (1/3 pemain), 💉 Dokter (≥4), 🕵️ Detektif (≥5), 👤 Warga. Pastikan semua sudah chat bot dulu supaya peran bisa dikirim lewat DM.`, [])

    if (sub === 'create') {
        if (g) return reply(`Sudah ada permainan. Ketik *${P}mafia-join*.`)
        s.games[chat] = { host: sender, chat, players: [{ id: sender, role: null, alive: true }], started: false, phase: 'lobby', day: 1, night: null, votes: {} }
        return say(`🔪 *Mafia* dibuat oleh ${tag(sender)}\nKetik *${P}mafia-join* (min 4, maks 20), lalu host ketik *${P}mafia-start*.`, [sender])
    }
    if (!g) return reply(`Belum ada permainan. Ketik *${P}mafia* untuk membuat.`)
    const idx = g.players.findIndex(p => p.id === sender)

    switch (sub) {
        case 'join': {
            if (g.started) return reply('Permainan sudah berjalan.')
            if (idx >= 0) return reply('Kamu sudah bergabung.')
            if (g.players.length >= 20) return reply('Pemain penuh (20).')
            g.players.push({ id: sender, role: null, alive: true })
            return say(`✅ ${tag(sender)} bergabung (${g.players.length} pemain)`)
        }
        case 'start': {
            if (g.started) return reply('Sudah dimulai.')
            if (!isHost()) return reply('Hanya host/admin yang bisa memulai.')
            if (g.players.length < 4) return reply('Minimal 4 pemain.')
            const roles = assignRoles(g.players.length)
            g.players.forEach((p, i) => { p.role = roles[i]; p.alive = true })
            g.started = true; g.day = 1
            const failed = []
            for (const p of g.players) {
                const mates = p.role === 'mafia' ? `\nTeman mafia: ${g.players.filter(x => x.role === 'mafia' && x !== p).map(x => tag(x.id)).join(', ') || '(tidak ada)'}` : ''
                const ok = await sendTo(A, p.id, `${ROLE[p.role].icon} *Mafia* — kamu adalah *${ROLE[p.role].name}*.\n${ROLE[p.role].desc}${mates}`)
                if (!ok) failed.push(p.id)
            }
            await say(`🔪 *Mafia dimulai!* ${g.players.length} pemain • ${g.players.filter(p => p.role === 'mafia').length} mafia.\nPeran sudah dikirim lewat chat pribadi.${failed.length ? `\n⚠️ Gagal DM: ${failed.map(tag).join(', ')} — chat bot lalu ketik *${P}mafia-role* di chat pribadi.` : ''}`)
            return startNight(env, g)
        }
        case 'status': {
            if (!g.started) return say(`Pemain (${g.players.length}):\n${list(g, false)}`)
            return say(`Fase: ${g.phase === 'night' ? '🌙 Malam' : '☀️ Siang'} ke-${g.day}\n${list(g, false)}`)
        }
        case 'vote': {
            if (!g.started || g.phase !== 'day') return reply('Voting hanya saat siang hari.')
            if (idx < 0 || !g.players[idx].alive) return reply('Kamu tidak bisa voting.')
            const n = num(A.args[0]) - 1
            if (!(n >= 0 && n < g.players.length) || !g.players[n].alive) return reply(`Nomor tidak valid:\n${list(g)}`)
            if (n === idx) return reply('Tidak bisa memilih dirimu sendiri.')
            g.votes[idx] = n
            const count = Object.keys(g.votes).length
            await say(`🗳️ ${tag(sender)} memilih ${tag(g.players[n].id)} (${count}/${alive(g).length} suara masuk)`)
            const { top } = tally(g)
            if (count >= alive(g).length || top > alive(g).length / 2) return dayEnd(env)
            return null
        }
        case 'skip': {
            if (!isHost()) return reply('Hanya host/admin.')
            if (!g.started) return reply('Belum dimulai.')
            return g.phase === 'night' ? nightEnd(env) : dayEnd(env)
        }
        case 'stop': {
            if (!isHost()) return reply('Hanya host/admin yang bisa menghentikan.')
            clearTimer(chat); delete s.games[chat]
            return say('🛑 Permainan Mafia dihentikan.')
        }
    }
    return reply(`Perintah tidak dikenal. Ketik *${P}mafia-help*.`)
}
