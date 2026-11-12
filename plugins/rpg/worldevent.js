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

// ───────── worldevent ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdWorldevent = rpgCmd(["worldevent"], async (A) => {
    const { rpgDb, saveRpg, reply } = A
    switch (0) {
        default:
            {
              let events = [
                '🌠 Hujan Meteor! Semua player +100 EXP!',
                '🌧️ Banjir besar! Semua bank player -20%',
                '🎁 Harta Karun Muncul! Gunakan *hunt* sekarang untuk dapat item langka!'
              ]
              let event = events[Math.floor(Math.random() * events.length)]

              for (let id in rpgDb) {
                if (event.includes('+100 EXP')) rpgDb[id].exp += 100
                if (event.includes('-20%')) rpgDb[id].bank = Math.floor(rpgDb[id].bank * 0.8)
              }

              saveRpg()
              reply(`🌍 *WORLD EVENT TERJADI!*\n\n${event}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdWorldevent, 'worldevent')
