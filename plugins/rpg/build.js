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

// ───────── build ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdBuild = rpgCmd(["build"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              if (user.build) return reply(`🏠 Kamu sudah punya markas: *${user.build}*`)

              user.coin -= 500
              user.build = 'markas kayu'
              saveRpg()
              reply(`🧱 Kamu membangun *markas kayu*. (+rest, +safezone)`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdBuild, 'build')
