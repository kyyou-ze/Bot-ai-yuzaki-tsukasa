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

// ───────── revive ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdRevive = rpgCmd(["revive"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              if (user.hp > 0) return reply(`❤️ Kamu masih hidup.`)

              if (user.coin < 200) return reply(`💰 Butuh 200 koin untuk hidup kembali.`)

              user.coin -= 200
              user.hp = 100
              saveRpg()
              reply(`💉 Kamu bangkit kembali dengan 100 HP.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdRevive, 'revive')
