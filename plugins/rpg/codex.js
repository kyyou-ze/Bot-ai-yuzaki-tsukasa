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

// ───────── codex ─────────
// Dipecah dari plugins/rpg/cerita.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdCodex = rpgCmd(["codex"], async (A) => {
    const { reply } = A
    switch (0) {
        default:
            {
              reply(`📜 *KODEX ITEM RPG*

            - 🗡️ pedang → +atk
            - 🛡️ armor → +def
            - 🧪 ramuan → pulih HP
            - 💀 tulang + kulit → ramuan (via *alchemy*)`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdCodex, 'codex')
