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

// ───────── rpgtop ─────────
// Dipecah dari plugins/rpg/ekonomi.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdRpgtop = rpgCmd(["rpgtop"], async (A) => {
    const { rpgDb, reply } = A
    switch (0) {
        default:
            {
              let list = Object.entries(rpgDb)
                .map(([id, u]) => ({ name: u.name, coin: u.coin }))
                .sort((a, b) => b.coin - a.coin)
                .slice(0, 10)
                .map((u, i) => `${i + 1}. ${u.name} - 💰 ${u.coin}`)
                .join('\n')

              reply(`🏆 *TOP 10 PEMAIN TERKAYA*\n\n${list}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdRpgtop, 'rpgtop')
