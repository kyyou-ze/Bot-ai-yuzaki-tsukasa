// .gacha          -> putar gacha berhadiah limit & money (1x gratis per hari, selanjutnya bayar money)
// .gacha info     -> daftar hadiah & peluang
// .jambahagia     -> cek status jam bahagia (pengali hadiah). Owner: .jambahagia on [menit] [pengali] | off
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, beri, boostReward, happy, happyBanner, setHappyManual, fiturFmt as fmt, wibDay, durasi } from '../../lib/engine/features.js'

// peluang dalam persen (total 100)
const HADIAH = [
    { w: 40,   nama: 'Permen hiburan',      emoji: '🍬', r: { money: 500 } },
    { w: 25,   nama: 'Kue kecil',           emoji: '🍪', r: { money: 2500 } },
    { w: 15,   nama: 'Pudding manis',       emoji: '🍮', r: { money: 5000 } },
    { w: 10,   nama: 'Kotak camilan',       emoji: '🍡', r: { money: 2000, exp: 500 } },
    { w: 5,    nama: 'Tiket limit',         emoji: '🎫', r: { limit: 1 } },
    { w: 3,    nama: 'Tiket limit x2',      emoji: '🎫', r: { limit: 2 } },
    { w: 1.2,  nama: 'Tiket limit x3',      emoji: '🍓', r: { limit: 3 } },
    { w: 0.6,  nama: 'Tiket limit x5',      emoji: '🍰', r: { limit: 5 } },
    { w: 0.15, nama: 'Tiket limit x10',     emoji: '✨', r: { limit: 10 } },
    { w: 0.05, nama: 'JACKPOT strawberry!', emoji: '🍓', r: { limit: 20, money: 50000 } }
]
const PITY_MIN = HADIAH.findIndex((h) => h.r.limit >= 3) // hadiah minimal saat pity

function undi(dariIndex = 0) {
    const pool = HADIAH.slice(dariIndex)
    const total = pool.reduce((a, h) => a + h.w, 0)
    let x = Math.random() * total
    for (const h of pool) { if ((x -= h.w) < 0) return h }
    return pool[0]
}

const teksR = (r) => Object.entries(r).map(([k, v]) => `${{ limit: '🎫 Limit', money: '💹 Money', exp: 'Exp' }[k] || k} +${fmt(v)}`).join('\n')

async function jamBahagia(m, { args, isOwner, usedPrefix }) {
    const sub = (args[0] || '').toLowerCase()
    if (sub === 'on' || sub === 'off') {
        if (!isOwner) return m.reply(global.mess?.owner || 'Khusus owner')
        if (sub === 'off') { setHappyManual(0); return m.reply('🍰 Jam bahagia manual dimatikan. Jadwal otomatis tetap berlaku.') }
        const menit = Math.min(Math.max(parseInt(args[1]) || 60, 1), 1440)
        const mult = Math.min(Math.max(parseFloat(args[2]) || 2, 1), 10)
        setHappyManual(menit, mult)
        return m.reply(`*JAM BAHAGIA x${mult}* dinyalakan selama ${menit} menit!\nSemua hadiah (harian, misi, gacha, kuis, referral) dikali ${mult}.`)
    }
    const h = happy()
    const c = cfg('jamBahagia')
    const jadwal = (c.jam || []).map(([a, b]) => `${String(a).padStart(2, '0')}.00-${String(b).padStart(2, '0')}.00`).join(', ') || '-'
    return m.reply([
        '*JAM BAHAGIA*',
        '',
        h.aktif ? `Status: *AKTIF x${h.mult}* (sisa ${durasi(h.sampai - Date.now())})` : 'Status: tidak aktif',
        `Jadwal harian (WIB): ${jadwal}`,
        `Pengali: x${c.pengali}`,
        '',
        'Saat aktif, semua hadiah harian, misi, gacha, kuis & referral dikali pengali!',
        isOwner ? `\n Owner: ${usedPrefix}jambahagia on [menit] [pengali] | off` : ''
    ].join('\n'))
}

let handler = async (m, ctx) => {
    const { command, args, usedPrefix } = ctx
    if (/^(jambahagia|happyhour)$/i.test(command)) return jamBahagia(m, ctx)

    const c = cfg('gacha')
    if ((args[0] || '').toLowerCase() === 'info') {
        const baris = HADIAH.map((h) => `${h.emoji} ${h.nama} — ${h.w}%\n     ${teksR(h.r).replace(/\n/g, ' • ')}`)
        return m.reply(`*HADIAH GACHA*\n\n${baris.join('\n')}\n\n Biaya: 💹 ${fmt(c.biaya)} (1x gratis tiap hari)\n Pity: setiap ${c.pityTiap}x putar berbayar, hadiah minimal Tiket limit x3`)
    }

    const user = global.db.data.users[m.sender]
    const hari = wibDay()
    if (!user.gacha || user.gacha.day !== hari) user.gacha = { day: hari, putar: 0, gratis: false, last: 0, pity: user.gacha?.pity || 0 }
    const g = user.gacha

    const tunggu = (g.last + c.cooldownDetik * 1000) - Date.now()
    if (tunggu > 0) return m.reply(`Sabar ya, tunggu ${durasi(tunggu)} lagi sebelum putar gacha.`)
    if (g.putar >= c.maxPerHari) return m.reply(`Batas gacha hari ini (${c.maxPerHari}x) sudah tercapai. Besok lagi ya~`)

    const gratis = !g.gratis
    if (!gratis) {
        if ((Number(user.money) || 0) < c.biaya) return m.reply(`Money kurang!\n Biaya: 💹 ${fmt(c.biaya)}\n Money kamu: 💹 ${fmt(user.money)}`)
        user.money -= c.biaya
        g.pity = (g.pity || 0) + 1
    } else {
        g.gratis = true
    }

    let hadiah
    const pityKena = !gratis && g.pity >= c.pityTiap
    if (pityKena) { hadiah = undi(PITY_MIN); g.pity = 0 } else hadiah = undi()

    g.putar++
    g.last = Date.now()
    const got = beri(user, hadiah.r)
    const hp = happy()
    const besar = hadiah.r.limit >= 5

    await m.reply([
        besar ? '🎊 *GACHA BESAR!* 🎊' : '*GACHA*',
        '',
        `${hadiah.emoji} Kamu dapat: *${hadiah.nama}*`,
        ...got.map((t) => `   ${t}`),
        '',
        gratis ? '(putaran gratis hari ini)' : `Biaya: 💹 ${fmt(c.biaya)}${pityKena ? ' • Pity aktif!' : ` • pity ${g.pity}/${c.pityTiap}`}`,
        `Putaran hari ini: ${g.putar}/${c.maxPerHari}`,
        hp.aktif ? `\n${happyBanner()}` : ''
    ].join('\n'))
}

handler.help = ['gacha', 'gacha info', 'gacha jambahagia']
handler.tags = ['rpg']
handler.command = ['gacha', 'jambahagia', 'happyhour']
handler.exp = 0

export default adapt(handler, { category: 'rpg' })
