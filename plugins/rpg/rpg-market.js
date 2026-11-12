// Marketplace antar user. Aturan (pajak, batas listing, item yang boleh) ada di config.js -> marketplace
//   .market [hal]            lihat listing
//   .mjual item jumlah harga jual (harga per item)
//   .mbeli id [jumlah]       beli
//   .mtarik id               tarik listing sendiri
//   .mku                     listing milikmu
import { adapt } from '../../lib/engine/plugins.js'
import { fiturCfg, fiturFmt, prefixOf, marketList, marketJual, marketBeli, marketTarik, startFitur } from '../../lib/engine/features.js'

startFitur()

const PER_HAL = 10

let handler = async (m, { conn, args, command }) => {
    const c = fiturCfg().marketplace
    if (!c.on) return m.reply('Marketplace sedang dimatikan.')
    const p = prefixOf()
    const cmd = command.toLowerCase()

    if (cmd === 'mjual') {
        if (args.length < 3) return m.reply(`Contoh: ${p}mjual potion 5 6000\n(jual 5 potion, harga 6000 per item)\nPajak penjualan: ${c.pajakPersen}%`)
        const r = marketJual(m.sender, args[0], args[1], args[2])
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        return m.reply(`✅ Listing #${r.id} dibuat.\nPembeli bisa membelinya dengan ${p}mbeli ${r.id}\nTarik kembali: ${p}mtarik ${r.id}`)
    }

    if (cmd === 'mbeli') {
        if (!args[0]) return m.reply(`Contoh: ${p}mbeli 3 2`)
        const r = marketBeli(m.sender, args[0], args[1])
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        await m.reply(`🛒 *PEMBELIAN BERHASIL*\n\n📦 ${r.item} x${fiturFmt(r.qty)}\n💰 Total : ${fiturFmt(r.total)}`)
        conn.sendMessage(m.chat, { text: `💰 @${r.seller.split('@')[0]} barangmu *${r.item} x${fiturFmt(r.qty)}* terjual! Kamu menerima ${fiturFmt(r.terima)} (pajak ${fiturFmt(r.pajak)}).`, mentions: [r.seller] }).catch(() => null)
        return
    }

    if (cmd === 'mtarik') {
        if (!args[0]) return m.reply(`Contoh: ${p}mtarik 3`)
        const r = marketTarik(m.sender, args[0])
        if (!r.ok) return m.reply(`❌ ${r.msg}`)
        return m.reply(`↩️ Listing ditarik. ${r.item} x${fiturFmt(r.qty)} dikembalikan ke inventory.`)
    }

    const all = marketList()
    const list = cmd === 'mku' ? all.filter(l => l.seller === m.sender) : all
    if (!list.length) return m.reply(cmd === 'mku' ? 'Kamu tidak punya listing aktif.' : `Marketplace masih kosong.\nJual barang: ${p}mjual item jumlah harga`)

    const page = Math.max(1, parseInt(args[0]) || 1)
    const max = Math.ceil(list.length / PER_HAL)
    const rows = [...list].sort((a, b) => b.at - a.at).slice((page - 1) * PER_HAL, page * PER_HAL)
    const mentions = rows.map(l => l.seller)
    const text = [
        `🏪 *${(global.namebot || 'BOT').toUpperCase()} MARKETPLACE*${cmd === 'mku' ? ' — listing kamu' : ''}`,
        `Halaman ${page}/${max} • pajak ${c.pajakPersen}%`, '',
        ...rows.map(l => `#${l.id} • *${l.item}* x${fiturFmt(l.qty)}\n   💰 ${fiturFmt(l.harga)}/item • @${l.seller.split('@')[0]}`),
        '', `Beli: ${p}mbeli <id> [jumlah]`
    ].join('\n')
    return conn.sendMessage(m.chat, { text, mentions }, { quoted: m })
}

handler.help = ['rpg-market market', 'rpg-market mjual', 'rpg-market mbeli', 'rpg-market mtarik', 'rpg-market mku']
handler.tags = ['rpg']
handler.command = ['rpg-market', 'market', 'pasar', 'mjual', 'mbeli', 'mtarik', 'mku']
handler.as = 'market'
handler.group = true

export default adapt(handler, { category: 'rpg' })
