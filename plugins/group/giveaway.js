// .giveaway Hadiah | 10m | 2     mulai undian (admin). Durasi: 30s/10m/2h/1d, jumlah pemenang opsional (default 1)
//                                Kalau hadiah berupa angka (mis. 50000), pemenang otomatis dapat uang RPG sebesar itu.
// .ikut                          daftar jadi peserta
// .gapeserta                     lihat jumlah/daftar peserta
// .gaend                         akhiri sekarang & undi pemenang (admin)
// .gabatal                       batalkan undian (admin)
import { groupData, groupsWith, save, num, parseDuration, formatDuration, rupiah, shuffle, addMoney, rememberSock, getSock } from '../../lib/group/sosial.js'

async function finish(jid, g, sock) {
    if (g.done) return
    g.done = true
    const pool = Object.keys(g.users)
    const winners = shuffle(pool).slice(0, g.winners)
    g.result = winners
    save()
    const prizeMoney = /^\d+$/.test(g.prize) ? Number(g.prize) : 0
    if (prizeMoney) for (const w of winners) await addMoney(sock, g.users[w].jid, g.users[w].name, prizeMoney).catch(() => null)
    const mentions = winners.map(w => g.users[w].jid)
    const text = winners.length
        ? `🎉 *GIVEAWAY SELESAI*\n🎁 Hadiah: ${prizeMoney ? '💰 ' + rupiah(prizeMoney) : g.prize}\n👥 Peserta: ${pool.length}\n\n🏆 Pemenang:\n${winners.map((w, i) => `${i + 1}. @${w}`).join('\n')}${prizeMoney ? '\n\n_Uang sudah masuk ke dompet RPG pemenang._' : '\n\n_Hubungi admin untuk klaim hadiah._'}`
        : `😢 *GIVEAWAY SELESAI*\nHadiah: ${g.prize}\nTidak ada peserta, tidak ada pemenang.`
    await sock.sendMessage(jid, { text, mentions }).catch(() => null)
}

if (!global.__gaSweeper) {
    global.__gaSweeper = setInterval(async () => {
        const sock = getSock(); if (!sock || !global.db) return
        for (const [jid, gd] of groupsWith('giveaway')) { const g = gd.giveaway; if (g && !g.done && Date.now() >= g.until) await finish(jid, g, sock) }
    }, 15000)
    global.__gaSweeper.unref?.()
}

let handler = async (m, { sock, text, command, prefix, jid, reply, isAdmin, isOwner }) => {
    rememberSock(sock)
    const gd = groupData(jid) // data grup ini saja
    const g = gd.giveaway
    const active = g && !g.done

    if (command === 'giveaway') {
        if (!isAdmin && !isOwner) return reply(global.mess.admin)
        if (active) return reply(`Masih ada giveaway berjalan (hadiah: ${g.prize}). Akhiri dengan ${prefix}gaend`)
        const [prize, dur, win] = String(text).split('|').map(s => s.trim())
        const ms = parseDuration(dur)
        if (!prize || !ms) return reply(`Format:\n${prefix}giveaway Hadiah | 10m | 2\n\n• Durasi: 30s, 10m, 2h, 1d\n• Pemenang opsional (default 1)\n• Hadiah angka (50000) = otomatis jadi uang RPG`)
        const winners = Math.min(Math.max(parseInt(win) || 1, 1), 20)
        gd.giveaway = { prize, until: Date.now() + ms, winners, users: {}, by: num(m.sender), done: false }
        save()
        return reply(`🎁 *GIVEAWAY DIMULAI!*\n\nHadiah : ${/^\d+$/.test(prize) ? '💰 ' + rupiah(prize) : prize}\nPemenang : ${winners}\nBerakhir : ${formatDuration(ms)} lagi\n\nIkut dengan mengetik *${prefix}ikut*`)
    }

    if (!active) return reply(`Tidak ada giveaway aktif.${isAdmin ? ` Mulai: ${prefix}giveaway Hadiah | 10m | 1` : ''}`)

    if (command === 'ikut') {
        if (Date.now() >= g.until) { await finish(jid, g, sock); return }
        const me = num(m.sender)
        if (g.users[me]) return reply('Kamu sudah terdaftar 👍')
        g.users[me] = { jid: m.sender, name: m.pushName || me }
        save()
        return reply(`✅ @${me} resmi ikut giveaway! Total peserta: *${Object.keys(g.users).length}*`, { mentions: [m.sender] })
    }

    if (command === 'gapeserta') {
        const ids = Object.keys(g.users)
        return reply(`🎁 *${g.prize}*\n⏳ Sisa ${formatDuration(g.until - Date.now())}\n👥 Peserta: ${ids.length}${ids.length ? '\n\n' + ids.slice(0, 40).map(i => `• @${i}`).join('\n') : ''}`, { mentions: ids.slice(0, 40).map(i => g.users[i].jid) })
    }

    if (!isAdmin && !isOwner) return reply(global.mess.admin)
    if (command === 'gaend') return finish(jid, g, sock)
    if (command === 'gabatal') { g.done = true; save(); return reply('Giveaway dibatalkan.') }
}

handler.command = ['giveaway', 'gabatal', 'gaend', 'gapeserta', 'ikut']
handler.help = ['giveaway', 'giveaway ikut', 'giveaway gapeserta', 'giveaway gaend', 'giveaway gabatal']
handler.tags = ['group']
handler.group = true

export default handler
