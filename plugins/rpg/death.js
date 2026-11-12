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

// ───────── death ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdDeath = rpgCmd(["death"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              if (user.hp && user.hp <= 0) {
                reply(`☠️ Kamu sudah mati! Gunakan *revive* untuk bangkit.`)
                break
              }

              user.hp = 0
              user.coin = Math.floor(user.coin * 0.5)
              reply(`☠️ Kamu tewas...\nKoinmu berkurang jadi ${user.coin}. Gunakan *revive* untuk hidup kembali.`)
              saveRpg()
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdDeath, 'death')
