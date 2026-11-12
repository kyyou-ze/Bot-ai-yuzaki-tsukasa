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

// ───────── shop ─────────
// Dipasang dari menu RPG Kaguya (.shop). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { SHOP, SHOP_ALIAS } from '../../lib/db/database.js'

const cmd = rpgCmd(["shop"], async (A) => {
    const { initRpgUser, sender, pushname, text, reply, fmt, prefix } = A
    initRpgUser(sender, pushname)
    const key = SHOP_ALIAS[String(text || '').trim().toLowerCase().replace(/\s+/g, '')]
    if (!key) {
        const cats = Object.entries(SHOP).map(([k, c], i) => `${i + 1}. *${c.title}* → ${prefix}shop ${k}`).join('\n')
        return reply(`🛒 *TOKO RPG UTAMA*\n\n📦 *Kategori Tersedia:*\n${cats}\n\nContoh: *${prefix}shop weapon*\nBeli item: *${prefix}buy <nama item>*`)
    }
    const cat = SHOP[key]
    const list = Object.entries(cat.items).map(([n, p]) => `• ${n} — ${fmt(p)} coin`).join('\n')
    return reply(`🛒 *${cat.title}*\n\n${list}\n\nBeli: *${prefix}buy <nama item>* (contoh: ${prefix}buy ${Object.keys(cat.items)[0]})`)
}, { tags: 'rpg', desc: 'Toko utama RPG' })

// satu command = nama file
export default oneCommand(cmd, 'shop')
