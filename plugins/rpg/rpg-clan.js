// Clan & clan war. Semua aturan (biaya, bobot kekuatan, hadiah, cooldown) ada di config.js -> clan
//   .clan buat <nama>   .clan gabung <nama>   .clan keluar   .clan info [nama]   .clan list   .clan top
//   .clan donasi <jumlah>   .clan kick @user
//   .clan war <nama clan>   .clan terima   .clan tolak
import { adapt } from '../../lib/engine/plugins.js'
import {
    fiturCfg,
    fiturFmt,
    prefixOf,
    startFitur,
    clanKey,
    getClan,
    allClans,
    clanOfUser,
    clanBuat,
    clanGabung,
    clanKeluar,
    clanKick,
    clanDonasi,
    clanPower,
    memberPower,
    clanTantang,
    clanTerima,
    clanTolak,
    giveReward,
    rewardText
} from '../../lib/engine/features.js'

startFitur()

const tag = (j) => `@${String(j).split('@')[0]}`

let handler = async (m, { conn, args, text }) => {
    const c = fiturCfg().clan
    if (!c.on) return m.reply('Fitur clan sedang dimatikan.')
    const p = prefixOf()
    const sub = (args[0] || '').toLowerCase()
    const rest = args.slice(1).join(' ').trim()
    const send = (t, mentions = []) => conn.sendMessage(m.chat, { text: t, mentions }, { quoted: m })

    if (!sub) {
        return send([
            `⚔️ *${(global.namebot || 'BOT').toUpperCase()} CLAN* ⚔️`, '',
            `${p}clan buat <nama>  (biaya ${fiturFmt(c.biayaBuat)})`, `${p}clan gabung <nama>`, `${p}clan keluar`, `${p}clan info [nama]`,
            `${p}clan list  |  ${p}clan top`, `${p}clan donasi <jumlah>`, `${p}clan kick @user  (ketua)`,
            `${p}clan war <nama clan>  (ketua)`, `${p}clan terima / ${p}clan tolak  (ketua yang ditantang)`, '',
            `Menang war: ${rewardText(c.menang)} untuk tiap peserta.${c.wajibGuild ? `\nSyarat: sudah ikut ${p}guild.` : ''}`
        ].join('\n'))
    }

    if (sub === 'buat') {
        const r = clanBuat(m.sender, rest)
        return m.reply(r.ok ? `✅ Clan *${rest}* berhasil dibuat. Kamu ketuanya!\nAjak teman: ${p}clan gabung ${rest}` : `❌ ${r.msg}`)
    }
    if (sub === 'gabung') {
        const r = clanGabung(m.sender, rest)
        return m.reply(r.ok ? `✅ Kamu bergabung ke clan *${r.nama}*.` : `❌ ${r.msg}`)
    }
    if (sub === 'keluar') {
        const r = clanKeluar(m.sender)
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        return m.reply(`👋 Kamu keluar dari clan *${r.nama}*.${r.bubar ? '\nClan bubar karena tidak ada anggota.' : ''}`)
    }
    if (sub === 'kick') {
        const target = m.mentionedJid?.[0] || m.quoted?.sender
        if (!target) return m.reply(`Contoh: ${p}clan kick @user`)
        const r = clanKick(m.sender, target)
        return r.ok ? send(`🚪 ${tag(target)} dikeluarkan dari clan *${r.nama}*.`, [target]) : m.reply(`❌ ${r.msg}`)
    }
    if (sub === 'donasi') {
        const r = clanDonasi(m.sender, args[1])
        return m.reply(r.ok ? `💝 Donasi masuk ke kas clan *${r.nama}*. Kas sekarang ${fiturFmt(r.kas)}.` : `❌ ${r.msg}`)
    }

    if (sub === 'info') {
        const cl = rest ? { key: clanKey(rest), ...(getClan(clanKey(rest)) || {}) } : clanOfUser(m.sender)
        if (!cl || !cl.nama) return m.reply(rest ? 'Clan tidak ditemukan.' : `Kamu belum punya clan. Buat dengan ${p}clan buat <nama>`)
        const pw = clanPower(cl.key)
        const mem = [...cl.anggota].sort((a, b) => memberPower(b) - memberPower(a))
        return send([
            `🏰 *CLAN ${cl.nama.toUpperCase()}*`, '',
            `👑 Ketua : ${tag(cl.ketua)}`, `👥 Anggota : ${cl.anggota.length}/${c.maxAnggota}`, `💰 Kas : ${fiturFmt(cl.kas)}`,
            `🏆 Menang : ${cl.menang} | Kalah : ${cl.kalah}`, `⚡ Kekuatan war (top ${c.pesertaWar}) : ${fiturFmt(pw.total)}`, '',
            ...mem.map((j, i) => `${i + 1}. ${tag(j)} • ⚡${fiturFmt(memberPower(j))}${j === cl.ketua ? ' 👑' : ''}`)
        ].join('\n'), cl.anggota)
    }

    if (sub === 'list' || sub === 'top') {
        const list = allClans().sort((a, b) => b.menang - a.menang || clanPower(b.key).total - clanPower(a.key).total).slice(0, 15)
        if (!list.length) return m.reply('Belum ada clan.')
        return send(`🏰 *DAFTAR CLAN*\n\n` + list.map((x, i) => `${i + 1}. *${x.nama}* • 👥${x.anggota.length} • 🏆${x.menang}W/${x.kalah}L • ⚡${fiturFmt(clanPower(x.key).total)}`).join('\n'))
    }

    if (sub === 'war') {
        const r = clanTantang(m.sender, rest, m.chat)
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        const me = clanOfUser(m.sender)
        return send(`⚔️ *TANTANGAN WAR*\nClan *${me.nama}* menantang clan *${r.lawan.nama}*!\n\n${tag(r.ketuaLawan)} ketik *${p}clan terima* atau *${p}clan tolak* dalam ${r.menit} menit.`, [r.ketuaLawan])
    }
    if (sub === 'tolak') {
        const r = clanTolak(m.sender)
        return m.reply(r.ok ? `🛡️ Tantangan dari clan *${r.dari}* ditolak.` : `❌ ${r.msg}`)
    }
    if (sub === 'terima') {
        const r = clanTerima(m.sender)
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        const W = r.pemenang, L = r.kalah
        const mentions = [...W.peserta, ...L.peserta]
        return conn.sendMessage(r.chat || m.chat, {
            text: [
                `⚔️ *HASIL CLAN WAR* ⚔️`, '',
                `🏆 Pemenang : *${W.nama}* (⚡${fiturFmt(W.power)})`,
                `💀 Kalah : *${L.nama}* (⚡${fiturFmt(L.power)})`, '',
                `Peserta ${W.nama}: ${W.peserta.map(tag).join(' ')}`, `→ ${rewardText(c.menang)} / orang`, '',
                `Peserta ${L.nama}: ${L.peserta.map(tag).join(' ')}`, `→ ${rewardText(c.kalah)} / orang`,
                r.rampas ? `\n💰 Kas ${L.nama} dirampas ${fiturFmt(r.rampas)} → ${W.nama}` : ''
            ].join('\n').trim(), mentions
        })
    }

    return m.reply(`Sub-perintah tidak dikenal. Ketik ${p}clan untuk bantuan.`)
}

handler.help = ['rpg-clan']
handler.tags = ['rpg']
handler.command = ['rpg-clan']
handler.group = true

export default adapt(handler, { category: 'rpg' })
