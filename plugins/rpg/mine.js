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

// ───────── mine ─────────
// Dipecah dari plugins/rpg/bertahan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdMine = rpgCmd(["mine"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, saveRpg, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let item = Math.random() < 0.5 ? 'batu' : 'emas'
              rpgDb[sender].inv.push(item)
              saveRpg()
              reply(`⛏️ Kamu menambang dan mendapatkan *${item}*!`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdMine, 'mine')
