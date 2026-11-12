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

// ───────── hunt ─────────
// Dipasang dari menu RPG Kaguya (.hunt). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["hunt"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg, msToTime, giveExp } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const now = Date.now()
    const cooldown = 1000 * 60 * 60
    const remaining = cooldown - (now - (u.huntCooldown || 0))
    if (remaining > 0) return reply(`🕒 Kamu butuh istirahat.\nTunggu *${msToTime(remaining)}* lagi.`)

    const drops = ['daging', 'kulit', 'tulang']
    const drop = drops[Math.floor(Math.random() * drops.length)]
    u.inv.push(drop)
    u.huntCooldown = now
    saveRpg()
    await giveExp(50)
    return reply(`🏹 Kamu berburu dan mendapat:\n+🎒 ${drop}\n+⭐ 50 exp`)
}, { tags: 'rpg', desc: 'Berburu, dapat drop + exp' })

// satu command = nama file
export default oneCommand(cmd, 'hunt')
