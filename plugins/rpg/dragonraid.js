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

// ───────── dragonraid ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdDragonraid = rpgCmd(["dragonraid"], async (A) => {
    const { rpgDb, saveRpg, reply } = A
    switch (0) {
        default:
            {
              global.dragonHp = global.dragonHp || 3000
              let dmg = 150 + Math.floor(Math.random() * 100)
              global.dragonHp -= dmg

              if (global.dragonHp <= 0) {
                global.dragonHp = 0
                for (let id in rpgDb) rpgDb[id].exp += 2000
                saveRpg()
                reply(`🐉 RAID BERHASIL! Semua player +2000 EXP!`)
              } else {
                reply(`🐉 Kamu serang naga! DMG: ${dmg}, Sisa HP: ${global.dragonHp}`)
              }
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdDragonraid, 'dragonraid')
