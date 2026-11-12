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

// ───────── huntboss ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdHuntboss = rpgCmd(["huntboss"], async (A) => {
    const { initRpgUser, sender, pushname, reply, rpgDb, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let dmg = Math.floor(Math.random() * 80) + 70
              global.bossHuntHp = global.bossHuntHp || 1000
              global.bossHuntHp -= dmg

              if (global.bossHuntHp <= 0) {
                global.bossHuntHp = 0
                reply(`🏆 Boss dikalahkan! Semua pemburu +1000 EXP`)
                for (let id in rpgDb) rpgDb[id].exp += 1000
                saveRpg()
              } else {
                reply(`🎯 Kamu serang boss, DMG: ${dmg}. Sisa HP: ${global.bossHuntHp}`)
              }
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdHuntboss, 'huntboss')
