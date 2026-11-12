// .lbmingguan [kategori]  -> peringkat minggu ini + hadiah. Pembagian hadiah otomatis (lihat config.js -> lbMingguan)
import { adapt } from '../../lib/engine/plugins.js'
import { fiturCfg, lbRank, lbInfo, fiturFmt, rewardText, startFitur } from '../../lib/engine/features.js'
import { formatWib } from '../../lib/core/system.js'

startFitur()

let handler = async (m, { conn, args }) => {
    const c = fiturCfg().lbMingguan
    if (!c.on) return m.reply('Leaderboard mingguan sedang dimatikan.')
    const kat = (args[0] || '').toLowerCase()
    const list = kat ? [kat] : c.kategori
    if (kat && !c.kategori.includes(kat)) return m.reply(`Kategori tersedia: ${c.kategori.join(', ')}`)

    const info = lbInfo()
    const lines = [`🏆 *${(global.namebot || 'BOT').toUpperCase()} LEADERBOARD MINGGUAN* 🏆`, `Mode: ${c.mode === 'total' ? 'nilai total' : 'kenaikan minggu ini'}`, `Hadiah dibagikan: ${formatWib(info.berikutnya)} WIB`, '']
    const mentions = []
    for (const k of list) {
        lines.push(`📊 *${k.toUpperCase()}*`)
        const rank = lbRank(k).slice(0, Math.max(c.hadiah.length, 5))
        if (!rank.length) lines.push('_Belum ada yang masuk peringkat._')
        rank.forEach((r, i) => {
            mentions.push(r.jid)
            lines.push(`${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} @${r.jid.split('@')[0]} • ${fiturFmt(r.nilai)}${c.hadiah[i] ? `\n     🎁 ${rewardText(c.hadiah[i])}` : ''}`)
        })
        lines.push('')
    }
    return conn.sendMessage(m.chat, { text: lines.join('\n').trim(), mentions }, { quoted: m })
}

handler.help = ['rpg-lbmingguan']
handler.tags = ['rpg']
handler.command = ['rpg-lbmingguan']

export default adapt(handler, { category: 'rpg' })
