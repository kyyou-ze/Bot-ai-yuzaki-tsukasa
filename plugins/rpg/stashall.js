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

// ───────── stashall ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdStashall = rpgCmd(["stashall"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, saveRpg, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              rpgDb[sender].storage = rpgDb[sender].storage || []
              rpgDb[sender].storage.push(...rpgDb[sender].inv)
              rpgDb[sender].inv = []
              saveRpg()
              reply(`📦 Semua item dipindah ke storage.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdStashall, 'stashall')
