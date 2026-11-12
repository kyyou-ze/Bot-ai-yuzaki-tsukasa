// ───────── lib/games/undercover.js ─────────
// Undercover (3-12 pemain). Semua pemain dapat kata lewat DM. Warga dapat kata A,
// undercover dapat kata B (mirip). Bergiliran beri 1 petunjuk, lalu voting siapa undercover.
// Warga menang jika semua undercover tersingkir; undercover menang jika tersisa ≤ 2 pemain.

import { store, tag, send, sendTo, addCoin, num, shuffle, pickRandom } from './common.js'

const REWARD = 150
const data = () => { const s = store('undercover'); s.games ||= {}; return s }

export const WORDS = [
    ['Kopi', 'Teh'], ['Bakso', 'Mie Ayam'], ['Motor', 'Sepeda'], ['Sepatu', 'Sandal'], ['Pantai', 'Kolam Renang'],
    ['Dokter', 'Perawat'], ['Guru', 'Dosen'], ['Nasi Goreng', 'Mie Goreng'], ['WhatsApp', 'Telegram'], ['Mobil', 'Bus'],
    ['Kucing', 'Harimau'], ['Pisang', 'Mangga'], ['Hujan', 'Embun'], ['Sungai', 'Danau'], ['Gitar', 'Ukulele'],
    ['Pesawat', 'Helikopter'], ['Sekolah', 'Kampus'], ['Susu', 'Yogurt'], ['Es Krim', 'Es Batu'], ['Kursi', 'Sofa'],
    ['Handphone', 'Tablet'], ['Rendang', 'Semur'], ['Batik', 'Songket'], ['Gunung', 'Bukit'], ['Roti', 'Kue'],
    ['Polisi', 'Satpam'], ['Pizza', 'Burger'], ['Sabun', 'Shampoo'], ['Kamera', 'Cermin'], ['Bioskop', 'Teater'],
    ['Ayam', 'Bebek'], ['Jam Tangan', 'Gelang'], ['Laptop', 'Komputer'], ['Payung', 'Jas Hujan'], ['Apel', 'Jeruk']
]

export const roleCount = (n) => (n >= 7 ? 2 : 1)

const alive = (g) => g.players.filter(p => p.alive)
const list = (g) => g.players.map((p, i) => `${i + 1}. ${tag(p.id)}${p.alive ? '' : ' ☠️'}`).join('\n')

export async function undercoverRun(A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    const s = data()

    if (sub === 'word') {
        const entry = Object.values(s.games).find(gg => gg.started && gg.players.some(p => p.id === sender))
        if (!entry) return reply('Kamu tidak sedang ikut permainan Undercover.')
        const me = entry.players.find(p => p.id === sender)
        return reply(`🕵️ Katamu: *${me.word}*`)
    }
    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup (kecuali undercover-word).')
    const chat = m.chat
    const g = s.games[chat]
    const say = (t, men) => send(A, t, men || (g ? g.players.map(p => p.id) : []))
    const isHost = () => g && (sender === g.host || A.isAdmins || A.isOwner)

    if (sub === 'help') return say(`🕵️ *Undercover*\n\n• ${P}undercover — buat permainan (3-12 pemain)\n• ${P}undercover-join — bergabung\n• ${P}undercover-start — mulai (host)\n• ${P}undercover-hint <kata> — beri petunjuk saat gilirannya (maks 3 kata)\n• ${P}undercover-vote <nomor> — voting\n• ${P}undercover-word — kirim ulang katamu via DM\n• ${P}undercover-status — status & petunjuk\n• ${P}undercover-stop\n\nSemua dapat kata lewat DM. Mayoritas dapat kata yang sama, tapi ada ${'1-2'} *undercover* dengan kata yang MIRIP. Beri petunjuk tanpa menyebut katamu langsung, lalu vote siapa yang paling mencurigakan. Jangan sampai ketahuan kalau kamu undercover!`, [])

    if (sub === 'create') {
        if (g) return reply(`Sudah ada permainan. Ketik *${P}undercover-join*.`)
        s.games[chat] = { host: sender, players: [{ id: sender, alive: true, word: '', under: false }], started: false, phase: 'lobby', round: 1, turn: 0, hints: [], votes: {} }
        return say(`🕵️ *Undercover* dibuat oleh ${tag(sender)}\nKetik *${P}undercover-join* (min 3, maks 12), lalu host *${P}undercover-start*.`, [sender])
    }
    if (!g) return reply(`Belum ada permainan. Ketik *${P}undercover*.`)
    const idx = g.players.findIndex(p => p.id === sender)

    const nextSpeaker = () => {
        for (let i = g.turn; i < g.players.length; i++) if (g.players[i].alive) { g.turn = i; return i }
        return -1
    }
    const startRound = async () => {
        g.phase = 'hint'; g.turn = 0; g.hints = []; g.votes = {}
        const i = nextSpeaker()
        return say(`🔁 *Ronde ${g.round}* — pemain hidup:\n${list(g)}\n\nGiliran memberi petunjuk: ${tag(g.players[i].id)} → *${P}undercover-hint <kata>*`)
    }
    const end = async (winner) => {
        const winners = g.players.filter(p => p.under === (winner === 'under'))
        winners.forEach(p => addCoin(p.id, REWARD))
        delete s.games[chat]
        const [a, b] = g.words
        return say(`🏁 *Undercover selesai!* ${winner === 'under' ? '🕵️ UNDERCOVER menang!' : '🎉 WARGA menang!'}\nKata warga: *${a}* • kata undercover: *${b}*\n\n${g.players.map(p => `${p.under ? '🕵️' : '👤'} ${tag(p.id)} (${p.word})${p.alive ? '' : ' ☠️'}`).join('\n')}\n\n🎁 Pemenang +${REWARD} koin`)
    }
    const resolveVote = async () => {
        const c = {}
        for (const t of Object.values(g.votes)) c[t] = (c[t] || 0) + 1
        const top = Math.max(0, ...Object.values(c))
        const lead = Object.entries(c).filter(([, n]) => n === top).map(([t]) => +t)
        let text = '⚖️ *Hasil voting*\n' + Object.entries(c).map(([t, n]) => `${tag(g.players[t].id)}: ${n}`).join('\n') + '\n\n'
        if (lead.length !== 1) {
            text += 'Seri! Tidak ada yang tersingkir.'
            g.round++
            await say(text)
            return startRound()
        }
        const out = g.players[lead[0]]; out.alive = false
        text += `${tag(out.id)} tersingkir — dia ${out.under ? '🕵️ *UNDERCOVER*' : '👤 *warga*'} (kata: ${out.word}).`
        await say(text)
        if (!g.players.some(p => p.alive && p.under)) return end('civil')
        if (alive(g).length <= 2) return end('under')
        g.round++
        return startRound()
    }

    switch (sub) {
        case 'join': {
            if (g.started) return reply('Permainan sudah berjalan.')
            if (idx >= 0) return reply('Kamu sudah bergabung.')
            if (g.players.length >= 12) return reply('Pemain penuh.')
            g.players.push({ id: sender, alive: true, word: '', under: false })
            return say(`✅ ${tag(sender)} bergabung (${g.players.length} pemain)`)
        }
        case 'start': {
            if (g.started) return reply('Sudah dimulai.')
            if (!isHost()) return reply('Hanya host/admin yang bisa memulai.')
            if (g.players.length < 3) return reply('Minimal 3 pemain.')
            const pair = shuffle([...pickRandom(WORDS)])
            const [civ, und] = pair
            g.words = [civ, und]
            const unders = new Set(shuffle(g.players.map((_, i) => i)).slice(0, roleCount(g.players.length)))
            g.players.forEach((p, i) => { p.under = unders.has(i); p.word = p.under ? und : civ; p.alive = true })
            g.started = true
            const failed = []
            for (const p of g.players) if (!(await sendTo(A, p.id, `🕵️ *Undercover* — katamu: *${p.word}*\nJangan beritahu siapa pun! Beri petunjuk di grup saat gilirannya.`))) failed.push(p.id)
            await say(`🕵️ *Undercover dimulai!* ${g.players.length} pemain, ${unders.size} undercover.\nKata sudah dikirim lewat chat pribadi.${failed.length ? `\n⚠️ Gagal DM: ${failed.map(tag).join(', ')} — chat bot lalu ketik *${P}undercover-word* di chat pribadi.` : ''}`)
            return startRound()
        }
        case 'status': {
            if (!g.started) return say(`Pemain (${g.players.length}):\n${list(g)}`)
            return say(`Ronde ${g.round} • fase ${g.phase === 'hint' ? 'petunjuk' : 'voting'}\n${list(g)}\n\nPetunjuk:\n${g.hints.map(h => `• ${tag(h.id)}: ${h.text}`).join('\n') || '(belum ada)'}`)
        }
        case 'hint': {
            if (!g.started || g.phase !== 'hint') return reply('Sekarang bukan fase petunjuk.')
            const i = nextSpeaker()
            if (idx !== i) return reply(`Sekarang giliran ${tag(g.players[i].id)}.`)
            const text = A.args.join(' ').trim()
            if (!text || A.args.length > 3) return reply('Beri petunjuk 1-3 kata.')
            if (text.toLowerCase() === g.players[idx].word.toLowerCase()) return reply('Jangan sebut katamu langsung!')
            g.hints.push({ id: sender, text })
            g.turn = i + 1
            const nx = nextSpeaker()
            if (nx === -1) {
                g.phase = 'vote'
                return say(`💬 Petunjuk ronde ${g.round}:\n${g.hints.map(h => `• ${tag(h.id)}: *${h.text}*`).join('\n')}\n\n🗳️ Saatnya voting! *${P}undercover-vote <nomor>*\n${list(g)}`)
            }
            return say(`✅ ${tag(sender)}: *${text}*\nGiliran ${tag(g.players[nx].id)} → *${P}undercover-hint <kata>*`)
        }
        case 'vote': {
            if (!g.started || g.phase !== 'vote') return reply('Sekarang bukan fase voting.')
            if (idx < 0 || !g.players[idx].alive) return reply('Kamu tidak bisa voting.')
            const n = num(A.args[0]) - 1
            if (!(n >= 0 && n < g.players.length) || !g.players[n].alive) return reply(`Nomor tidak valid:\n${list(g)}`)
            if (n === idx) return reply('Tidak bisa memilih dirimu sendiri.')
            g.votes[idx] = n
            const count = Object.keys(g.votes).length
            await say(`🗳️ ${tag(sender)} sudah memilih (${count}/${alive(g).length})`)
            if (count >= alive(g).length) return resolveVote()
            return null
        }
        case 'stop': {
            if (!isHost()) return reply('Hanya host/admin yang bisa menghentikan.')
            delete s.games[chat]
            return say('🛑 Undercover dihentikan.')
        }
    }
    return reply(`Perintah tidak dikenal. Ketik *${P}undercover-help*.`)
}
