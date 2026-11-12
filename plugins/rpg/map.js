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

// ───────── map ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdMap = rpgCmd(["map"], async (A) => {
    const { reply } = A
    switch (0) {
        default:
            {
              let mapText = `
            🗺️ *DUNIA RPG WHATSAPP*
            • 🌲 Hutan Kabut
            • ⛩️ Desa Hilang
            • 🏰 Kastil Tua
            • 🌋 Gunung Merapi
            Gunakan: *travel lokasi*
            `
              reply(mapText)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdMap, 'map')
