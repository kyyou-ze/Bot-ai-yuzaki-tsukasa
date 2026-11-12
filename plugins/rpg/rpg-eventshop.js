// .eventshop  -> event yang sedang aktif (diskon .buy + barang khusus)
// .eventbuy <id> [jumlah]  -> beli barang event
// Semua event diatur di config.js -> global.fitur.eventShop
import { adapt } from '../../lib/engine/plugins.js'
import { fiturCfg, activeEvents, eventBarang, eventBeli, fiturFmt, prefixOf, startFitur } from '../../lib/engine/features.js'

startFitur()

let handler = async (m, { conn, args, command }) => {
    const c = fiturCfg().eventShop
    if (!c.on) return m.reply('Shop event sedang dimatikan.')
    const p = prefixOf()

    if (/^eventbuy$/i.test(command)) {
        if (!args[0]) return m.reply(`Contoh: ${p}eventbuy paketevent 2\nLihat daftar: ${p}eventshop`)
        const r = eventBeli(m.sender, args[0], parseInt(args[1]) || 1)
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        return m.reply(`🎉 *PEMBELIAN EVENT BERHASIL*\n\n📦 ${r.nama}\n💰 Total : ${fiturFmt(r.total)}\n🎁 Didapat : ${r.got.join(', ') || '-'}`)
    }

    const ev = activeEvents()
    if (!ev.length) return m.reply('Belum ada event shop yang aktif sekarang.')
    const lines = [`🎉 *${(global.namebot || 'BOT').toUpperCase()} EVENT SHOP* 🎉`, '']
    for (const e of ev) {
        lines.push(`✦ *${e.nama}*`)
        if (e.diskon) lines.push(`🏷️ Diskon ${e.diskon}% untuk ${e.item === 'semua' ? 'semua item' : (e.item || []).join(', ')} (${p}buy)`)
        if (e.selesai) lines.push(`⏰ Sampai ${e.selesai}`)
        if (Array.isArray(e.hari) && e.hari.length) lines.push(`📅 Setiap ${e.hari.join(', ')}`)
        lines.push('')
    }
    const barang = eventBarang()
    if (barang.length) {
        lines.push('🛒 *BARANG KHUSUS*')
        for (const x of barang) {
            lines.push(`• *${x.id}* — ${x.b.nama || x.id}\n   💰 ${fiturFmt(x.b.harga)} | stok ${x.sisa === Infinity ? '∞' : x.sisa}${x.b.batasPerUser > 0 ? ` | max ${x.b.batasPerUser}/orang` : ''}\n   🎁 ${Object.entries(x.b.beri || {}).map(([k, v]) => `${k} x${v}`).join(', ')}`)
        }
        lines.push('', `Beli: ${p}eventbuy <id> [jumlah]`)
    }
    return conn.sendMessage(m.chat, { text: lines.join('\n').trim() }, { quoted: m })
}

handler.help = ['rpg-eventshop eventshop', 'rpg-eventshop eventbuy']
handler.tags = ['rpg']
handler.command = ['rpg-eventshop', 'eventshop', 'eventbuy']
handler.as = 'eventshop'

export default adapt(handler, { category: 'rpg' })
