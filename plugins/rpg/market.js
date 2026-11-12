/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

// ───────── market ─────────
// Dipasang dari menu RPG Kaguya (.market). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["market"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, fmt, saveRpg, prefix } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const mk = global.market // daftar pasar tersimpan di database game
    const arg = String(text || '').trim()
    const aksi = (arg.split(/\s+/)[0] || '').toLowerCase()
    const rest = arg.slice(aksi.length).trim()
    const who = (jid) => String(jid).split('@')[0]

    if (!aksi || aksi === 'list') {
        const rows = mk.slice(0, 15).map((e, i) => `${i + 1}. *${e.item}* — ${fmt(e.harga)} 💰 (penjual ${who(e.seller)})`)
        return reply(`🛒 *MARKETPLACE*\n\n${rows.length ? rows.join('\n') : 'Belum ada barang dijual.'}\n\nJual: *${prefix}market jual <item> <harga>*\nBeli: *${prefix}market beli <item>*\nTarik: *${prefix}market batal <item>*`)
    }

    if (aksi === 'jual') {
        const mt = rest.match(/^(.+?)\s+(\d+)$/)
        if (!mt) return reply(`Format: *${prefix}market jual <item> <harga>*`)
        const item = mt[1].trim()
        const harga = parseInt(mt[2], 10)
        if (!Number.isInteger(harga) || harga <= 0 || harga > 1e9) return reply('Harga tidak valid.')
        const idx = u.inv.findIndex(i => String(i).toLowerCase() === item.toLowerCase())
        if (idx === -1) return reply(`Kamu tidak punya *${item}* untuk dijual.`)
        const real = u.inv[idx]
        u.inv.splice(idx, 1)
        mk.push({ seller: sender, item: real, harga })
        saveRpg()
        return reply(`✅ Kamu menjual *${real}* seharga ${fmt(harga)} 💰`)
    }

    if (aksi === 'beli') {
        if (!rest) return reply(`Format: *${prefix}market beli <item>*`)
        const list = mk.filter(e => String(e.item).toLowerCase() === rest.toLowerCase() && e.seller !== sender).sort((a, b) => a.harga - b.harga)
        const entry = list[0]
        if (!entry) return reply(`Item *${rest}* tidak tersedia di market.`)
        if (u.coin < entry.harga) return reply(`💸 Koinmu tidak cukup. Butuh ${fmt(entry.harga)}.`)
        const seller = initRpgUser(entry.seller, 'Player')
        u.coin -= entry.harga
        seller.coin += entry.harga
        u.inv.push(entry.item)
        mk.splice(mk.indexOf(entry), 1)
        saveRpg()
        return reply(`🛍️ Kamu membeli *${entry.item}* dari market seharga ${fmt(entry.harga)} 💰`)
    }

    if (aksi === 'batal') {
        const idx = mk.findIndex(e => e.seller === sender && String(e.item).toLowerCase() === rest.toLowerCase())
        if (idx === -1) return reply('Kamu tidak punya barang itu di market.')
        const [e] = mk.splice(idx, 1)
        u.inv.push(e.item)
        saveRpg()
        return reply(`↩️ *${e.item}* dikembalikan ke inventory.`)
    }

    return reply('Perintah market tidak valid.')
}, { tags: 'rpg', desc: 'Jual/beli di pasar antar player' })

// satu command = nama file
export default oneCommand(cmd, 'market')
