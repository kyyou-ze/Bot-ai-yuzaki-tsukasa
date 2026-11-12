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

// ───────── class ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdClass = rpgCmd(["class"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, text, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              if (user.class) return reply(`🧝‍♂️ Kamu sudah memilih kelas: *${user.class}*`)
              if (!text) return reply(`Kelas tersedia: *knight*, *mage*, *archer*`)

              let pilihan = ['knight', 'mage', 'archer']
              if (!pilihan.includes(text.toLowerCase())) return reply(`Kelas tidak valid.`)

              user.class = text.toLowerCase()
              saveRpg()
              reply(`✅ Kamu kini seorang *${user.class}*!`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdClass, 'class')
