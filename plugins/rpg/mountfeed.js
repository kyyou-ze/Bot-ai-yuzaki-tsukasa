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

// ───────── mountfeed ─────────
// Dipecah dari plugins/rpg/bertahan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdMountfeed = rpgCmd(["mountfeed"], async (A) => {
    const { initRpgUser, sender, pushname, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              reply(`🧲 Tungganganmu diberi makan dan merasa bahagia.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdMountfeed, 'mountfeed')
