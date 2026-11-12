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

// ───────── weather ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdWeather = rpgCmd(["weather"], async (A) => {
    const { reply } = A
    switch (0) {
        default:
            {
              const cuaca = ['cerah', 'hujan', 'badai', 'berkabut']
              const now = cuaca[Math.floor(Math.random() * cuaca.length)]
              global.rpgWeather = now
              reply(`🌦️ Cuaca hari ini: *${now.toUpperCase()}*`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdWeather, 'weather')
