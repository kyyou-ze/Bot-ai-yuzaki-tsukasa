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

// ───────── defend ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdDefend = rpgCmd(["defend"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!rpgDb[sender].build) return reply(`🧱 Kamu belum punya markas.`)
              let bonus = 50
              rpgDb[sender].def += bonus
              saveRpg()
              reply(`🛡️ Kamu memperkuat markas. DEF bertambah ${bonus}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdDefend, 'defend')
