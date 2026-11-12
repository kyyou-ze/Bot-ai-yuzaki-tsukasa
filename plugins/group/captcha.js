// Verifikasi captcha anggota baru (tanpa API)
// .captcha on|off          aktif/nonaktifkan (admin). Default: mati.
// .captcha mode math|emoji soal hitungan atau pilih emoji
// .captcha waktu <detik>   batas waktu menjawab (30-600, default 120)
// .captcha status          lihat pengaturan
// Anggota baru wajib menjawab. Salah 3x atau telat = dikeluarkan (bot harus admin).
import { groupData, peekGroup, groupsWith, save, num, pick, shuffle, rememberSock, getSock } from '../../lib/group/sosial.js'

const EMOJIS = ['🍎', '🍌', '🍇', '🍓', '🍉', '🍒', '🐶', '🐱', '🐼', '🦊', '🚗', '🚀', '⚽', '🎸', '🌙', '⭐']
const MAX_TRIES = 3
// pengaturan + antrean verifikasi captcha tersimpan di data grupnya sendiri (groups[jid].captcha)
const cfgOf = (jid) => {
    const c = (groupData(jid).captcha ||= {})
    c.on ??= false; c.mode ??= 'math'; c.timeout ??= 120
    return c
}
const pendOf = (jid) => (cfgOf(jid).pending ||= {})

function makeChallenge(mode) {
    if (mode === 'emoji') {
        const list = shuffle(EMOJIS).slice(0, 6)
        const idx = Math.floor(Math.random() * 6)
        return {
            answer: String(idx + 1), emoji: list[idx],
            text: `Pilih nomor emoji ${list[idx]}\n\n${list.map((e, i) => `${i + 1}. ${e}`).join('   ')}\n\n_Balas dengan angkanya (atau kirim emojinya)._`
        }
    }
    let a = 2 + Math.floor(Math.random() * 9), b = 2 + Math.floor(Math.random() * 9)
    const op = pick(['+', '-', '×'])
    if (op === '-' && b > a) [a, b] = [b, a]
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b
    return { answer: String(ans), text: `Berapa hasil *${a} ${op} ${b}* ?\n\n_Balas dengan angkanya saja._` }
}

async function kick(sock, group, p, reason) {
    delete pendOf(group)[p.key]; save()
    try {
        await sock.groupParticipantsUpdate(group, [p.target], 'remove')
        await sock.sendMessage(group, { text: `🚫 @${p.name} dikeluarkan (${reason}).`, mentions: [p.target] })
    } catch {
        await sock.sendMessage(group, { text: `⚠️ Gagal mengeluarkan @${p.name} (${reason}). Jadikan bot admin agar captcha berfungsi.`, mentions: [p.target] }).catch(() => null)
    }
}

// dipanggil dari lib/platform/wa.js saat ada anggota baru
global.onCaptchaJoin = async (sock, update) => {
    try {
        rememberSock(sock)
        const { id: group, participants = [], action } = update || {}
        if (action !== 'add' || !group?.endsWith('@g.us')) return
        const cfg = cfgOf(group)
        if (!cfg.on) return
        const bots = [sock.user?.id, sock.user?.lid].filter(Boolean).map(num)
        for (const p of participants) {
            const target = typeof p === 'string' ? p : (p.id || p.phoneNumber)
            if (!target) continue
            const ids = [...new Set((typeof p === 'string' ? [p] : [p.id, p.lid, p.phoneNumber, p.jid]).filter(Boolean).map(num))]
            if (ids.some(i => bots.includes(i))) continue
            const ch = makeChallenge(cfg.mode)
            const key = `${group}|${ids[0]}`
            pendOf(group)[key] = { key, group, target, ids, name: ids[0], answer: ch.answer, emoji: ch.emoji || null, tries: 0, expire: Date.now() + cfg.timeout * 1000 }
            save()
            await sock.sendMessage(group, { text: `🛡️ *VERIFIKASI ANGGOTA BARU*\n@${ids[0]} selamat datang! Jawab dulu dalam *${cfg.timeout} detik*:\n\n${ch.text}\n\n_Salah ${MAX_TRIES}x atau telat = dikeluarkan._`, mentions: [target] }).catch(() => null)
        }
    } catch (e) { console.error('[captcha]', e?.message || e) }
}

if (!global.__captchaSweeper) {
    global.__captchaSweeper = setInterval(async () => {
        const sock = getSock(); if (!sock || !global.db) return
        for (const [jid, gd] of groupsWith('captcha')) for (const p of Object.values(gd.captcha.pending || {})) if (p && Date.now() >= p.expire) await kick(sock, jid, p, 'tidak menjawab captcha')
    }, 5000)
    global.__captchaSweeper.unref?.()
}

let handler = async (m, { sock, text, command, prefix, jid, reply, isAdmin, isOwner }) => {
    rememberSock(sock)

    // ── jalur pasif: jawaban captcha ──
    if (!command) {
        const mine = [m.sender, m.key?.participant, m.key?.participantAlt, m.key?.participantPn].filter(Boolean).map(num)
        const pending = peekGroup(jid)?.captcha?.pending // hanya antrean grup ini
        if (!pending) return false
        const p = Object.values(pending).find(x => x.ids.some(i => mine.includes(i)))
        if (!p) return false
        const ans = String(m.text || text || '').trim()
        const ok = ans === p.answer || (p.emoji && ans === p.emoji)
        if (ok) {
            delete pending[p.key]; save()
            await sock.sendMessage(jid, { text: `✅ @${p.name} terverifikasi. Selamat bergabung!`, mentions: [p.target] }).catch(() => null)
            return true
        }
        p.tries++
        if (p.tries >= MAX_TRIES) { await kick(sock, jid, p, `salah menjawab ${MAX_TRIES}x`); return true }
        save()
        await sock.sendMessage(jid, { text: `❌ Salah. Sisa percobaan: ${MAX_TRIES - p.tries}`, mentions: [p.target] }).catch(() => null)
        return true
    }

    if (!isAdmin && !isOwner) return reply(global.mess.admin)
    const cfg = cfgOf(jid)
    const [sub, val] = String(text).trim().toLowerCase().split(/\s+/)
    if (sub === 'on' || sub === 'off') { cfg.on = sub === 'on'; save(); return reply(`Captcha *${cfg.on ? 'AKTIF ✅' : 'MATI'}*.${cfg.on ? '\n⚠️ Pastikan bot jadi admin agar bisa mengeluarkan.' : ''}`) }
    if (sub === 'mode') {
        if (!['math', 'emoji'].includes(val)) return reply(`Pilih: ${prefix}captcha mode math / emoji`)
        cfg.mode = val; save(); return reply(`Mode captcha: *${val}*`)
    }
    if (sub === 'waktu') {
        const n = parseInt(val)
        if (!n || n < 30 || n > 600) return reply('Waktu 30-600 detik.')
        cfg.timeout = n; save(); return reply(`Batas waktu: *${n} detik*`)
    }
    return reply(`🛡️ *CAPTCHA*\nStatus : ${cfg.on ? 'AKTIF' : 'MATI'}\nMode   : ${cfg.mode}\nWaktu  : ${cfg.timeout} detik\n\n${prefix}captcha on|off\n${prefix}captcha mode math|emoji\n${prefix}captcha waktu <detik>`)
}

handler.command = ['captcha']
handler.customPrefix = /^\s*(\d{1,3}|\p{Extended_Pictographic}+)\s*$/u
handler.help = ['captcha']
handler.tags = ['group']
handler.group = true

export default handler
