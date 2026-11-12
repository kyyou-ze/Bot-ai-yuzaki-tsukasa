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

// ───────── craft ─────────
// Dipasang dari menu RPG Kaguya (.craft). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { invCount, invTake } from '../../lib/db/database.js'

const cmd = rpgCmd(["craft"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const bahan = ['tulang', 'kulit']
    const hasil = 'armor'

    if (!bahan.every(b => invCount(u, b) > 0)) return reply(`🧪 Untuk membuat *${hasil}*, kamu butuh:\n- tulang\n- kulit`)
    for (const b of bahan) invTake(u, b, 1)
    u.inv.push(hasil)
    saveRpg()
    return reply(`🧪 Kamu berhasil membuat *${hasil}*!`)
}, { tags: 'rpg', desc: 'Craft armor (tulang + kulit)' })

// satu command = nama file
export default oneCommand(cmd, 'craft')
