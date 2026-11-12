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

// ───────── daily ─────────
// Dipasang dari menu RPG Kaguya (.daily). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["daily"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg, msToTime, giveExp } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const now = Date.now()
    const cooldown = 1000 * 60 * 60 * 24
    const remaining = cooldown - (now - (u.dailyCooldown || 0))
    if (remaining > 0) return reply(`🕒 Kamu sudah klaim hari ini!\nTunggu *${msToTime(remaining)}* lagi.`)

    const reward = { coin: 300, exp: 120 }
    u.coin += reward.coin
    u.dailyCooldown = now
    saveRpg()
    await giveExp(reward.exp)
    return reply(`🎁 *Daily Reward*\n+💰 ${reward.coin} koin\n+⭐ ${reward.exp} exp`)
}, { tags: 'rpg', desc: 'Klaim hadiah harian' })

// satu command = nama file
export default oneCommand(cmd, 'daily')
