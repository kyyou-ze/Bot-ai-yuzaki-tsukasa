// Referral
//   .invite              -> kode undanganmu + statistik
//   .kodeinvite KODE     -> pakai kode teman, kalian berdua dapat hadiah (sekali seumur hidup)
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, store, kodeUser, beri, boostReward, happy, fiturFmt as fmt } from '../../lib/engine/features.js'

const teks = (r) => Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${{ limit: '🎫', money: '💹', exp: '' }[k] || k} ${fmt(v)}`).join(' ')

let handler = async (m, { conn, command, args, usedPrefix }) => {
    const c = cfg('referral')
    if (!c.on) return m.reply('Fitur referral sedang dimatikan.')
    const user = global.db.data.users[m.sender]
    const k = store()

    // ───── pakai kode ─────
    if (/^(kodeinvite|pakaikode|redeeminvite|referral)$/i.test(command)) {
        const kode = String(args[0] || '').trim().toUpperCase()
        if (!kode) return m.reply(`Format: *${usedPrefix}kodeinvite KODE*\nContoh: ${usedPrefix}kodeinvite AB12CD\n\n Minta kode temanmu lewat *${usedPrefix}invite*`)
        if (user.refBy) return m.reply('Kamu sudah pernah memakai kode undangan.')
        const pemilik = k.refCodes[kode]
        if (!pemilik) return m.reply('Kode tidak ditemukan.')
        if (pemilik === m.sender) return m.reply('🍡 Tidak bisa memakai kode sendiri ya~')
        const teman = global.db.data.users[pemilik]
        if (!teman) return m.reply('Pemilik kode tidak ditemukan.')
        // cegah saling undang (A mengundang B, lalu B memakai kode A)
        if (teman.refBy === m.sender) return m.reply('🍡 Pemilik kode itu sudah kamu undang, tidak bisa saling memakai.')
        if ((teman.refCount || 0) >= c.maxUndangan) return m.reply('Kode ini sudah mencapai batas undangan.')

        user.refBy = pemilik
        user.refTime = Date.now()
        teman.refCount = (teman.refCount || 0) + 1
        teman.refList = [...(teman.refList || []), m.sender].slice(-100)

        const untukKamu = beri(user, c.hadiahTeman)
        const untukTeman = beri(teman, c.hadiahPengundang)
        let ms = ''
        const hadiahMs = c.milestone?.[teman.refCount]
        if (hadiahMs) {
            const got = beri(teman, hadiahMs, { boost: false })
            ms = `\n🎉 Milestone ${teman.refCount} undangan: ${got.join(', ')}`
        }
        global.db.kaguya = k

        await conn.sendMessage(pemilik, {
            text: `🍋 *UNDANGANMU BERHASIL!* 🍋\n\n${user.name || m.sender.split('@')[0]} memakai kodemu.\n${untukTeman.join(' • ')}\n🍰 Total undangan: ${teman.refCount}${ms}`
        }).catch(() => null)

        const hp = happy()
        return m.reply(`*KODE BERHASIL DIPAKAI*\n\n Hadiah untukmu:\n${untukKamu.join(' • ')}\n${hp.aktif ? `\n Jam Bahagia x${hp.mult} ikut dihitung!` : ''}`.trim())
    }

    // ───── lihat kode sendiri ─────
    const kode = kodeUser(m.sender)
    const hp = happy()
    const h1 = boostReward(c.hadiahPengundang), h2 = boostReward(c.hadiahTeman)
    const milestone = Object.entries(c.milestone || {}).map(([n, r]) => `   ${(user.refCount || 0) >= Number(n) ? '✅' : '🤍'} ${n} undangan: ${teks(r)}`).join('\n')

    await m.reply([
        '*UNDANG TEMAN*',
        '',
        `Kodemu: *${kode}*`,
        `Total undangan: *${user.refCount || 0}/${c.maxUndangan}*`,
        user.refBy ? 'Kamu diundang oleh seseorang' : '',
        '',
        `Cara pakai: suruh temanmu ketik\n*${usedPrefix}kodeinvite ${kode}*`,
        '',
        `🎁 Kamu dapat: ${teks(h1)}`,
        `🎁 Temanmu dapat: ${teks(h2)}`,
        '',
        'Bonus milestone:',
        milestone,
        hp.aktif ? `\n Jam Bahagia x${hp.mult} aktif, hadiah dikali ${hp.mult}!` : ''
    ].filter((v) => v !== '' || true).join('\n').replace(/\n{3,}/g, '\n\n'))
}

handler.help = ['invite', 'invite kodeinvite KODE']
handler.tags = ['rpg']
handler.command = ['invite', 'undang', 'kodeinvite', 'pakaikode', 'redeeminvite', 'referral']
handler.exp = 0

export default adapt(handler, { category: 'economy' })
