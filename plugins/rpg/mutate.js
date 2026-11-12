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

// ───────── mutate ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdMutate = rpgCmd(["mutate"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, saveRpg, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let skill = ['firewave', 'windblast', 'darkspike']
              let acak = skill[Math.floor(Math.random() * skill.length)]
              rpgDb[sender].skill = acak
              saveRpg()
              reply(`🧬 Skillmu berubah menjadi *${acak}*`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdMutate, 'mutate')
