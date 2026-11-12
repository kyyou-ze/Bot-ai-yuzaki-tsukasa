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

// ───────── reincarnate ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdReincarnate = rpgCmd(["reincarnate"], async (A) => {
    const { initRpgUser, sender, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender)
              let user = rpgDb[sender]
              if (user.level < 30) return reply(`🧘 Hanya yang sudah mencapai level 30 bisa bereinkarnasi.`)

              user.level = 1
              user.exp = 0
              user.gold = 0
              user.reincarnation = (user.reincarnation || 0) + 1
              user.passiveBonus = (user.passiveBonus || 0) + 5
              saveRpg()
              return reply(`🔁 Kamu telah bereinkarnasi!\nBonus permanen: +5% power setiap kali kamu bereinkarnasi.`)
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdReincarnate, 'reincarnate')
