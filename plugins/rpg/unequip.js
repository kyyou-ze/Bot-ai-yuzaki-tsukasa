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

// ───────── unequip ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdUnequip = rpgCmd(["unequip"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              let removed = []

              if (user.weapon) {
                user.inv.push(user.weapon)
                removed.push(`🗡️ ${user.weapon}`)
                user.weapon = ''
              }
              if (user.armor) {
                user.inv.push(user.armor)
                removed.push(`🛡️ ${user.armor}`)
                user.armor = ''
              }

              if (!removed.length) {
                reply(`Kamu tidak sedang memakai senjata atau armor.`)
                break
              }

              saveRpg()
              reply(`🔧 Kamu melepas:\n${removed.join('\n')}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdUnequip, 'unequip')
