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

// ───────── combo ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdCombo = rpgCmd(["combo"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let u = rpgDb[sender]
              let comboDmg = u.class === 'knight' ? 100 : u.class === 'mage' ? 90 : 80
              reply(`🗡️ Kamu gunakan COMBO! DMG: ${comboDmg}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdCombo, 'combo')
