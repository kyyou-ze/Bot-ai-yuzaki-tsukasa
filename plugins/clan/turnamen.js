// .turnamen           -> papan peringkat turnamen clan minggu ini + hadiah + sisa waktu
// .turnamen riwayat   -> juara periode-periode sebelumnya
// .turnamen selesai   -> (owner) tutup periode sekarang dan bagikan hadiah
// Skor clan = (war menang x 100) + exp clan yang naik selama periode. Hadiah otomatis ke SEMUA anggota clan juara 1-3.
import { toPN } from '../../lib/engine/plugins.js'
import { X, turnamenPeringkat, turnamenInfo, turnamenTick, clanOf } from '../../lib/rpg/extra.js'
import { rewardText, fiturFmt as fmt } from '../../lib/engine/features.js'
import { formatWib } from '../../lib/core/system.js'

let handler = async (m, { sock, text = '', reply, sender, isOwner }) => {
    const c = X().turnamen
    if (!c.on) return reply('Turnamen clan sedang dimatikan.')
    const sub = text.trim().toLowerCase()
    const info = turnamenInfo()

    if (sub === 'riwayat') {
        if (!info.hist.length) return reply('Belum ada turnamen yang selesai.')
        const baris = info.hist.map((h) => `📅 ${formatWib(h.tgl)}\n` + (h.top.length ? h.top.map((t, i) => `   ${['🥇', '🥈', '🥉'][i] || i + 1} ${t.nama} (${fmt(t.skor)})`).join('\n') : '   (tidak ada pemenang)'))
        return reply(`📜 *RIWAYAT TURNAMEN CLAN*\n\n${baris.join('\n\n')}`)
    }

    if (sub === 'selesai') {
        if (!isOwner) return reply(global.mess.owner)
        await turnamenTick(true)
        return reply('✅ Periode ditutup, hadiah dibagikan, periode baru dimulai.')
    }

    const rank = turnamenPeringkat()
    const jid = await toPN(sock, sender)
    const mine = clanOf(jid)
    const sisa = Math.max(0, info.berikutnya - Date.now())
    const hari = Math.floor(sisa / 864e5), jam = Math.floor(sisa / 36e5) % 24, mnt = Math.floor(sisa / 6e4) % 60

    const papan = rank.length
        ? rank.slice(0, 10).map((r, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${r.emblem} *${r.nama}* — ${fmt(r.skor)} poin (${r.menang}W, +${fmt(r.exp)} exp)${mine?.id === r.id ? ' ⬅️ clanmu' : ''}`).join('\n')
        : '_Belum ada clan yang mencetak skor. Mulai war dengan *.clanwar*!_'
    const posisi = mine ? rank.findIndex((r) => r.id === mine.id) : -2

    await reply([
        '🏆 *TURNAMEN CLAN MINGGUAN*',
        `Berakhir: ${formatWib(info.berikutnya)} WIB (${hari}h ${jam}j ${mnt}m lagi)`,
        '',
        papan,
        '',
        mine ? (posisi >= 0 ? `Clanmu (*${mine.name}*) peringkat *${posisi + 1}*.` : `Clanmu (*${mine.name}*) belum punya skor${(mine.members?.length || 0) < c.minAnggota ? ` — butuh minimal ${c.minAnggota} anggota` : ''}.`) : 'Kamu belum punya clan. Gabung dulu dengan *.clanjoin*.',
        '',
        '🎁 *Hadiah per anggota clan*',
        ...c.hadiah.map((h, i) => `${['🥇', '🥈', '🥉'][i] || i + 1} ${rewardText(h)}`),
        '',
        `Skor = war menang × ${c.skorPerMenang} + exp clan yang naik. Riwayat: *.turnamen riwayat*`
    ].join('\n'))
}

handler.help = ['turnamen', 'turnamen riwayat']
handler.tags = ['clan']
handler.command = ['turnamen']
export default handler
