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

// ───────── scout ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdScout = rpgCmd(["scout"], async (A) => {
    const { m, reply, initRpgUser, rpgDb } = A
    switch (0) {
        default:
            {
              if (!m.quoted) return reply('reply target untuk diintai.')
              let target = m.quoted.sender
              initRpgUser(target)
              let loc = rpgDb[target].location || 'rahasia'
              reply(`🔍 Lokasi musuh: ${loc}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdScout, 'scout')
