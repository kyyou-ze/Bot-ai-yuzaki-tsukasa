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

// ───────── kingdom ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdKingdom = rpgCmd(["kingdom"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, text, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              if (user.kingdom) return reply(`👑 Kerajaanmu: *${user.kingdom}*`)

              if (!text) return reply(`Ketik: *kingdom nama_kerajaanmu*`)
              user.kingdom = text
              saveRpg()
              reply(`🏯 Kamu mendirikan kerajaan *${text}*!`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdKingdom, 'kingdom')
