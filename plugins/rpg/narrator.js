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

// ───────── narrator ─────────
// Dipecah dari plugins/rpg/cerita.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdNarrator = rpgCmd(["narrator"], async (A) => {
    const { reply } = A
    switch (0) {
        default:
            {
              let teks = `🎙️ *Narator Berbisik...*\n\n“Langkahmu baru saja dimulai. Dunia menantimu.”\n\nGunakan *storyquest* untuk menjelajah kisahmu.`
              return reply(teks)
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdNarrator, 'narrator')
