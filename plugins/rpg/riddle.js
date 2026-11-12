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

// ───────── riddle ─────────
// Dipecah dari plugins/rpg/cerita.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdRiddle = rpgCmd(["riddle"], async (A) => {
    const { reply } = A
    switch (0) {
        default:
            {
              let soal = `❓ Aku punya kaki tapi tak bisa jalan. Siapa aku?`
              reply(soal)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdRiddle, 'riddle')
