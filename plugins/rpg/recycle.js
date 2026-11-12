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

// ───────── recycle ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdRecycle = rpgCmd(["recycle"], async (A) => {
    const { initRpgUser, sender, pushname, text, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!text || !rpgDb[sender].inv.includes(text)) return reply(`Item *${text}* tidak ada.`)
              rpgDb[sender].inv = rpgDb[sender].inv.filter(i => i !== text)
              rpgDb[sender].inv.push('fragmen')
              saveRpg()
              reply(`♻️ Item *${text}* dihancurkan jadi *fragmen*!`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdRecycle, 'recycle')
