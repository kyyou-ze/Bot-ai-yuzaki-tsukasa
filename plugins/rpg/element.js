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

// ───────── element ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdElement = rpgCmd(["element"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, text, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]

              if (user.element) {
                reply(`🔮 Elemenmu sudah dipilih: *${user.element}*`)
                break
              }

              const pilihan = ['api', 'air', 'tanah', 'angin']
              if (!text || !pilihan.includes(text.toLowerCase())) {
                reply(`Pilih elemen: *api*, *air*, *tanah*, *angin*\nContoh: *element api*`)
                break
              }

              user.element = text.toLowerCase()
              saveRpg()
              reply(`✅ Elemenmu kini: *${user.element}*`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdElement, 'element')
