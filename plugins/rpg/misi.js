// .misi          -> 3 misi acak per hari (reset 00:00 WIB)
// .misi klaim    -> ambil hadiah misi yang sudah selesai (+ bonus kalau ke-3 misi selesai)
// Progres dihitung otomatis oleh handler.js (lib/engine/features.js -> trackMisi), tidak perlu lapor manual.
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, MISI, misiDenganProgres, beri, boostReward, happy, happyBanner, fiturFmt as fmt, wibDate } from '../../lib/engine/features.js'

const bar = (a, b, len = 8) => {
    const on = Math.round((Math.max(0, Math.min(a, b)) / Math.max(1, b)) * len)
    return ''.repeat(on) + '🤍'.repeat(len - on)
}

const teksHadiah = (r) => Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${{ limit: '🎫', money: '💹', exp: '' }[k] || k} ${fmt(v)}`).join(' ')

let handler = async (m, { args, usedPrefix }) => {
    const c = cfg('misi')
    if (!c.on) return m.reply('Fitur misi sedang dimatikan.')

    const user = global.db.data.users[m.sender]
    const ms = misiDenganProgres(user)
    const klaim = /^(klaim|claim|ambil)$/i.test(args[0] || '')

    if (klaim) {
        const siap = ms.list.filter((q) => q.done && !q.claimed)
        if (!siap.length) {
            return m.reply(ms.list.every((q) => q.claimed)
                ? 'Semua hadiah misi hari ini sudah kamu ambil. Datang lagi besok ya~'
                : `Belum ada misi yang selesai. Cek progres dengan *${usedPrefix}misi*`)
        }
        const total = {}
        for (const q of siap) {
            for (const [k, v] of Object.entries(MISI[q.id].hadiah)) total[k] = (total[k] || 0) + v
            q.claimed = true
        }
        let bonusTeks = ''
        if (!ms.bonus && ms.list.every((q) => q.claimed)) {
            ms.bonus = true
            for (const [k, v] of Object.entries(c.hadiahBonus || {})) total[k] = (total[k] || 0) + v
            bonusTeks = '\n🎉 *BONUS 3/3 misi selesai!*'
        }
        beri(user, total)
        const hp = happy()
        return m.reply(`*HADIAH MISI DIAMBIL*\n\n${teksHadiah(boostReward(total))}${bonusTeks}${hp.aktif ? `\n\n Jam Bahagia x${hp.mult} ikut dihitung!` : ''}`)
    }

    const selesai = ms.list.filter((q) => q.done).length
    const baris = ms.list.map((q, i) => {
        const def = MISI[q.id]
        const status = q.claimed ? '✅ sudah diambil' : q.done ? '🎁 siap diklaim!' : `${fmt(q.progress)}/${fmt(q.target)}`
        return `${def.emoji} *${i + 1}. ${def.teks(q.target)}*\n     ${bar(q.progress, q.target)} ${status}\n     Hadiah: ${teksHadiah(def.hadiah)}`
    })

    const besok = new Date(wibDate().setUTCHours(24, 0, 0, 0) - 7 * 3_600_000)
    const sisaJam = Math.max(0, Math.floor((besok - Date.now()) / 3_600_000))
    const banner = happyBanner()

    await m.reply([
        '*MISI HARIAN*',
        '',
        baris.join('\n\n'),
        '',
        `Selesai: *${selesai}/3*  •  Bonus 3/3: ${teksHadiah(c.hadiahBonus || {})}`,
        `Reset ${sisaJam} jam lagi`,
        selesai ? `\n Ketik *${usedPrefix}misi klaim* untuk ambil hadiah` : '',
        banner
    ].filter((v) => v !== undefined && v !== null).join('\n').replace(/\n{3,}/g, '\n\n'))
}

handler.help = ['misi', 'misi klaim']
handler.tags = ['rpg']
handler.command = ['misi']
handler.exp = 0

export default adapt(handler, { category: 'rpg' })
