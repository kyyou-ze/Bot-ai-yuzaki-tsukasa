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

// ───────── bossfight ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdBossfight = rpgCmd(["bossfight"], async (A) => {
    const { reply, rpgDb, saveRpg } = A
    switch (0) {
        default:
            {
              global.bossHp = global.bossHp || 500
              let dmg = 100 + Math.floor(Math.random() * 100)
              global.bossHp -= dmg
              if (global.bossHp <= 0) {
                global.bossHp = 0
                reply(`👑 Boss dikalahkan! Semua player +500 EXP`)
                for (let id in rpgDb) rpgDb[id].exp += 500
                saveRpg()
              } else {
                reply(`⚔️ Kamu menyerang boss dan memberi ${dmg} DMG.\nSisa HP Boss: ${global.bossHp}`)
              }
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdBossfight, 'bossfight')
