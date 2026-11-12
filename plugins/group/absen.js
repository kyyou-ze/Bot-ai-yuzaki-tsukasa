// Absen harian grup dengan streak & hadiah bertingkat (reset hari WIB)
// .absen         absen hari ini
// .topabsen      peringkat streak di grup ini
// Hadiah: dasar 1.000 + 200/hari streak (maks 5.000). Bonus: hari ke-7, 14, 30, 60, 100, 200, 365.
// Telat sehari = streak mulai dari 1 lagi.
import { groupData, save, num, rupiah, wibDate, dayDiff, addMoney, rememberSock } from '../../lib/group/sosial.js'

const BONUS = { 7: 10_000, 14: 25_000, 30: 75_000, 60: 150_000, 100: 300_000, 200: 750_000, 365: 2_000_000 }
const base = (s) => Math.min(1000 + s * 200, 5000)

let handler = async (m, { sock, command, jid, reply }) => {
    rememberSock(sock)
    const g = (groupData(jid).absen ||= {}) // absen grup ini saja
    const me = num(m.sender)

    if (command === 'topabsen') {
        const top = Object.entries(g).sort((a, b) => b[1].streak - a[1].streak || b[1].total - a[1].total).slice(0, 10)
        if (!top.length) return reply('Belum ada yang absen di grup ini. Mulai dengan .absen')
        return reply(`📅 *TOP STREAK ABSEN*\n\n${top.map(([id, u], i) => `${i + 1}. @${id} — 🔥 ${u.streak} hari (total ${u.total}x)`).join('\n')}`, { mentions: top.map(([, u]) => u.jid) })
    }

    const today = wibDate()
    const u = (g[me] ||= { streak: 0, total: 0, last: null, best: 0, jid: m.sender })
    u.jid = m.sender
    if (u.last === today) return reply(`Kamu sudah absen hari ini ✅\n🔥 Streak: ${u.streak} hari`)

    u.streak = u.last && dayDiff(u.last, today) === 1 ? u.streak + 1 : 1
    u.last = today
    u.total++
    u.best = Math.max(u.best, u.streak)

    const reward = base(u.streak)
    const bonus = BONUS[u.streak] || 0
    await addMoney(sock, m.sender, m.pushName, reward + bonus)
    save()

    const nextMs = Object.keys(BONUS).map(Number).find(d => d > u.streak)
    return reply(`╭─▣「 *ABSEN HARIAN* 」▣─╮\n┃ 👤 @${me}\n┃ 🔥 Streak : ${u.streak} hari\n┃ 🏅 Terbaik: ${u.best} hari\n┃ 📆 Total  : ${u.total}x\n╰─────────────➤\n💰 Hadiah: ${rupiah(reward)}${bonus ? `\n🎉 *BONUS HARI KE-${u.streak}*: +${rupiah(bonus)}` : ''}${nextMs ? `\n\n_Bonus berikutnya di hari ke-${nextMs} (${nextMs - u.streak} hari lagi)_` : ''}`, { mentions: [m.sender] })
}

handler.command = ['absen', 'topabsen']
handler.help = ['absen', 'absen topabsen']
handler.tags = ['group']
handler.group = true

export default handler
