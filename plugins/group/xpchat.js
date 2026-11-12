// XP & level chat per grup (tanpa API, murni lokal)
// .xpchat on|off     aktif/nonaktifkan di grup ini (admin). Default: mati.
// .levelgrup         lihat level & XP kamu di grup ini
// .rankgrup          10 member paling aktif di grup ini
// Tiap pesan (cooldown 45 dtk) memberi 5-15 XP. Naik level = hadiah uang RPG.
import { groupData, peekGroup, save, num, rupiah, addMoney, rememberSock } from '../../lib/group/sosial.js'

const levelOf = (xp) => Math.floor(Math.sqrt(xp / 50))
const needFor = (lvl) => lvl * lvl * 50
const COOLDOWN = 45_000
const cd = new Map()

const bar = (v, max, size = 12) => { const f = Math.max(0, Math.min(size, Math.round(v / max * size))); return '▰'.repeat(f) + '▱'.repeat(size - f) }

let handler = async (m, { sock, text, command, prefix, jid, reply, isAdmin, isOwner }) => {
    rememberSock(sock)
    // ── jalur pasif: dipanggil untuk setiap pesan biasa ──
    if (!command) {
        const g = peekGroup(jid)?.xp // tidak membuat data untuk grup yang XP-nya tidak aktif
        if (!g?.on || m.fromMe) return false
        const me = num(m.sender)
        const now = Date.now()
        if (now - (cd.get(jid + me) || 0) < COOLDOWN) return false
        cd.set(jid + me, now)
        const u = (g.users[me] ||= { xp: 0, level: 0, name: m.pushName || me, jid: m.sender })
        u.name = m.pushName || u.name
        u.xp += 5 + Math.floor(Math.random() * 11)
        const lvl = levelOf(u.xp)
        save()
        if (lvl > u.level) {
            u.level = lvl
            const reward = lvl * 500
            await addMoney(sock, m.sender, m.pushName, reward).catch(() => null)
            await sock.sendMessage(jid, { text: `🎊 *LEVEL UP!*\n@${me} naik ke *level ${lvl}* di grup ini!\n💰 Hadiah: ${rupiah(reward)}`, mentions: [m.sender] }).catch(() => null)
            save()
        }
        return false // jangan menghalangi plugin pasif lain
    }

    const g = (groupData(jid).xp ||= { on: false, users: {} }) // data XP grup ini saja

    if (command === 'xpchat') {
        if (!isAdmin && !isOwner) return reply(global.mess.admin)
        const v = String(text).trim().toLowerCase()
        if (!['on', 'off'].includes(v)) return reply(`XP chat: *${g.on ? 'AKTIF' : 'MATI'}*\nUbah: ${prefix}xpchat on / off`)
        g.on = v === 'on'; save()
        return reply(`XP chat grup ini *${g.on ? 'diaktifkan ✅' : 'dimatikan'}*.`)
    }

    if (!g.on) return reply(`XP chat belum aktif di grup ini. Admin bisa menyalakan dengan ${prefix}xpchat on`)

    if (command === 'levelgrup') {
        const me = num(m.sender)
        const u = g.users[me]
        if (!u) return reply('Kamu belum punya XP. Ngobrol dulu di grup ya 💬')
        const lvl = levelOf(u.xp), lo = needFor(lvl), hi = needFor(lvl + 1)
        const rank = Object.values(g.users).sort((a, b) => b.xp - a.xp).findIndex(x => x === u) + 1
        return reply(`╭─▣「 *LEVEL GRUP* 」▣─╮\n┃ 👤 @${me}\n┃ 🏅 Level : ${lvl}\n┃ ✨ XP    : ${u.xp}\n┃ 🏆 Rank  : #${rank}\n╰─────────────➤\n${bar(u.xp - lo, hi - lo)} ${u.xp - lo}/${hi - lo}\n_${hi - u.xp} XP lagi menuju level ${lvl + 1}_`, { mentions: [m.sender] })
    }

    // rankgrup
    const top = Object.entries(g.users).sort((a, b) => b[1].xp - a[1].xp).slice(0, 10)
    if (!top.length) return reply('Belum ada data. Ayo ngobrol!')
    const medal = ['🥇', '🥈', '🥉']
    return reply(`🏆 *TOP AKTIF GRUP*\n\n${top.map(([id, u], i) => `${medal[i] || `${i + 1}.`} @${id} — Lv ${levelOf(u.xp)} • ${u.xp} XP`).join('\n')}`, { mentions: top.map(([, u]) => u.jid) })
}

handler.command = ['xpchat', 'levelgrup', 'rankgrup']
handler.customPrefix = /[\s\S]/
handler.help = ['xpchat', 'xpchat levelgrup', 'xpchat rankgrup']
handler.tags = ['group']
handler.group = true

export default handler
