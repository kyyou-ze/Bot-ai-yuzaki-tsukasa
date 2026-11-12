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

// ───────── sell ─────────
// Dipasang dari menu RPG Kaguya (.sell). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { sellPrice, invTake, invCount } from '../../lib/db/database.js'

const cmd = rpgCmd(["sell"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, fmt, saveRpg, prefix } = A
    initRpgUser(sender, pushname)
    if (!text) return reply(`Ketik nama item yang ingin dijual. Contoh: *${prefix}sell ramuan*\nJual banyak: *${prefix}sell daging 3* / *${prefix}sell daging all*`)

    const u = rpgDb[sender]
    const mt = text.trim().toLowerCase().match(/^(.*?)(?:\s+(\d{1,3}|all))?$/)
    const name = (mt[1] || '').trim()
    const have = invCount(u, name)
    if (!have) return reply(`Kamu tidak punya item *${name}* untuk dijual.`)

    const qty = mt[2] === 'all' ? have : Math.min(have, Math.max(1, parseInt(mt[2] || '1', 10)))
    const harga = sellPrice(name) * qty
    invTake(u, name, qty)
    u.coin += harga
    saveRpg()
    return reply(`💸 Kamu menjual *${name}*${qty > 1 ? ` x${qty}` : ''}\n+💰 ${fmt(harga)} koin`)
}, { tags: 'rpg', desc: 'Jual item ke sistem' })

// satu command = nama file
export default oneCommand(cmd, 'sell')
