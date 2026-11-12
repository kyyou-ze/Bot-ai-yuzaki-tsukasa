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

// ───────── roleplay ─────────
// Dipecah dari plugins/rpg/cerita.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdRoleplay = rpgCmd(["roleplay"], async (A) => {
    const { initRpgUser, sender, pushname, text, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!text) {
                reply(`Ketik teks RP-mu. Contoh: *roleplay aku memeluk naga yang terluka...*`)
                break
              }

              reply(`🎭 *${pushname} beraksi:*\n_${text}_`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdRoleplay, 'roleplay')
