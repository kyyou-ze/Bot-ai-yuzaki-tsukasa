// .poll Judul | Opsi A | Opsi B | Opsi C [| 10m]   buat polling (opsi 2-10, batas waktu opsional)
// .pilih <nomor>        pilih opsi (boleh ganti pilihan)
// .pollhasil           lihat hasil sementara
// .pollstop            tutup polling (pembuat / admin)
import { groupData, groupsWith, save, num, parseDuration, formatDuration, rememberSock, getSock } from '../../lib/group/sosial.js'

const bar = (pct, size = 10) => '█'.repeat(Math.round(pct / 100 * size)) + '░'.repeat(size - Math.round(pct / 100 * size))

function render(p) {
    const votes = Object.values(p.votes)
    const total = votes.length
    const lines = p.options.map((o, i) => {
        const c = votes.filter(v => v === i).length
        const pct = total ? Math.round(c / total * 100) : 0
        return `${i + 1}. ${o}\n   ${bar(pct)} ${pct}% (${c})`
    })
    const sisa = p.closed ? '🔒 *Ditutup*' : p.until ? `⏳ Sisa ${formatDuration(p.until - Date.now())}` : '♾️ Tanpa batas waktu'
    return `╭─▣「 *POLLING* 」▣─╮\n┃ ${p.title}\n╰─────────────➤\n\n${lines.join('\n')}\n\n👥 Total suara: ${total}\n${sisa}`
}

async function closePoll(jid, p, sock) {
    if (p.closed) return
    p.closed = true; save()
    await sock.sendMessage(jid, { text: `🏁 *Polling selesai!*\n\n${render(p)}` }).catch(() => null)
}

// pemeriksa waktu: polling yang lewat batas ditutup otomatis (satu interval global)
if (!global.__pollSweeper) {
    global.__pollSweeper = setInterval(async () => {
        const sock = getSock(); if (!sock || !global.db) return
        for (const [jid, g] of groupsWith('poll')) { const p = g.poll; if (p && !p.closed && p.until && Date.now() >= p.until) await closePoll(jid, p, sock) }
    }, 15000)
    global.__pollSweeper.unref?.()
}

let handler = async (m, { sock, text, command, prefix, jid, reply, isAdmin, isOwner }) => {
    rememberSock(sock)
    const gd = groupData(jid) // data grup ini saja
    const p = gd.poll
    const me = num(m.sender)

    if (command === 'poll') {
        if (!text) return reply(`Format:\n${prefix}poll Judul | Opsi A | Opsi B | Opsi C | 10m\n\nBatas waktu opsional di bagian terakhir (30s, 10m, 2h, 1d).`)
        if (p && !p.closed && (!p.until || p.until > Date.now())) return reply(`Masih ada polling aktif di grup ini.\nLihat: ${prefix}pollhasil  •  Tutup: ${prefix}pollstop`)
        const parts = text.split('|').map(s => s.trim()).filter(Boolean)
        let until = null
        if (parts.length > 3 && parseDuration(parts[parts.length - 1])) until = Date.now() + parseDuration(parts.pop())
        const [title, ...options] = parts
        if (!title || options.length < 2) return reply('Minimal 1 judul dan 2 opsi, dipisah tanda |')
        if (options.length > 10) return reply('Maksimal 10 opsi.')
        gd.poll = { title, options, votes: {}, by: me, until, closed: false, at: Date.now() }
        save()
        return reply(`${render(gd.poll)}\n\nPilih dengan *${prefix}pilih <nomor>*`)
    }

    if (!p) return reply(`Belum ada polling. Buat dengan ${prefix}poll Judul | A | B`)
    if (!p.closed && p.until && Date.now() >= p.until) await closePoll(jid, p, sock)

    if (command === 'pollhasil') return reply(render(p))

    if (command === 'pollstop') {
        if (p.closed) return reply('Polling sudah ditutup.')
        if (me !== p.by && !isAdmin && !isOwner) return reply('Hanya pembuat polling atau admin yang bisa menutup.')
        return closePoll(jid, p, sock)
    }

    // vote
    if (p.closed) return reply('Polling sudah ditutup.')
    const n = parseInt(text)
    if (!n || n < 1 || n > p.options.length) return reply(`Pilih nomor 1-${p.options.length}. Contoh: ${prefix}pilih 1`)
    const changed = me in p.votes
    p.votes[me] = n - 1
    save()
    return reply(`${changed ? 'Pilihan diganti' : 'Suara tercatat'}: *${p.options[n - 1]}* ✅`)
}

handler.command = ['poll', 'pilih', 'pollhasil', 'pollstop']
handler.help = ['poll', 'poll pilih', 'poll pollhasil', 'poll pollstop']
handler.tags = ['group']
handler.group = true

export default handler
