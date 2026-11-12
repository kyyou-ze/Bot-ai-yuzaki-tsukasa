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

// ───────── buy ─────────
// Dipasang dari menu RPG Kaguya (.buy). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { priceOf, applyPurchase } from '../../lib/db/database.js'

const cmd = rpgCmd(["buy"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, fmt, saveRpg, giveExp, prefix } = A
    initRpgUser(sender, pushname)
    if (!text) return reply(`Masukkan nama item yang ingin dibeli.\nLihat daftar: *${prefix}shop*`)

    const mt = text.trim().toLowerCase().match(/^(.*?)(?:\s+(\d{1,2}))?$/)
    const item = (mt[1] || '').trim()
    const harga = priceOf(item)
    if (harga === undefined) return reply(`Item tidak ditemukan di toko.\nLihat daftar: *${prefix}shop*`)

    const special = ['scrollclass', 'stonebless', 'essencexp', 'spiritcore', 'elixirlife'].includes(item)
    const qty = special ? 1 : Math.max(1, Math.min(99, parseInt(mt[2] || '1', 10)))
    const total = harga * qty
    const u = rpgDb[sender]
    if (u.coin < total) return reply(`💰 Uang kamu tidak cukup. Butuh ${fmt(total)}, kamu punya ${fmt(u.coin)}.`)

    u.coin -= total
    let note = ''
    for (let i = 0; i < qty; i++) {
        const r = applyPurchase(u, item)
        if (r && typeof r === 'object') { await giveExp(r.exp); note = r.text } else if (r) note = r
    }
    saveRpg()
    return reply(`✅ Kamu membeli *${item}*${qty > 1 ? ` x${qty}` : ''} seharga ${fmt(total)} coin.${note ? `\n${note}` : ''}`)
}, { tags: 'rpg', desc: 'Beli item dari toko' })

// satu command = nama file
export default oneCommand(cmd, 'buy')
