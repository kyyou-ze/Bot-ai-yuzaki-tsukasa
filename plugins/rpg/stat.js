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

// ───────── stat ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdStat = rpgCmd(["stat"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let u = rpgDb[sender]
              reply(`📊 *STAT KARAKTER*
            💪 ATK: ${u.weapon ? 30 : 10}
            🛡️ DEF: ${u.armor ? 25 : 10}
            ⚡ SPD: ${u.class === 'archer' ? 20 : 10}
            `)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdStat, 'stat')
