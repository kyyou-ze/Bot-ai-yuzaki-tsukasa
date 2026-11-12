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

// ───────── cook ─────────
// Dipasang dari menu RPG Kaguya (.cook). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { RECIPES } from '../../lib/db/database.js'

const cmd = rpgCmd(["cook"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, saveRpg, prefix } = A
    initRpgUser(sender, pushname)
    const key = String(text || '').trim().toLowerCase()
    if (!key) return reply(`Masukkan nama resep: contoh *${prefix}cook supikan*\nLihat resep: *${prefix}cookbook*`)
    const r = RECIPES[key]
    if (!r) return reply(`Resep *${key}* tidak dikenal.\nLihat resep: *${prefix}cookbook*`)

    const u = rpgDb[sender]
    const pick = []
    for (const n of r.need) {
        const idx = u.inv.findIndex((it, i) => !pick.includes(i) && (n.prefix ? String(it).toLowerCase().startsWith(n.match) : String(it).toLowerCase() === n.match))
        if (idx === -1) return reply(`🍲 Bahan kurang untuk *${key}*.\nButuh: ${r.label}`)
        pick.push(idx)
    }
    u.inv = u.inv.filter((_, i) => !pick.includes(i))
    u.inv.push(`masakan:${key}`)
    saveRpg()
    return reply(`🍲 Kamu memasak *${key}*!`)
}, { tags: 'rpg', desc: 'Masak makanan dari resep' })

// satu command = nama file
export default oneCommand(cmd, 'cook')
