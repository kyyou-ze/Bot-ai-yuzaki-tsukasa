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

// ───────── storage ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdStorage = rpgCmd(["storage"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              user.storage ||= []

              if (!text) {
                reply(`Ketik nama item yang ingin disimpan. Contoh: *storage ramuan*`)
                break
              }

              let idx = user.inv.indexOf(text)
              if (idx === -1) {
                reply(`Item *${text}* tidak ada di inventory.`)
                break
              }

              user.inv.splice(idx, 1)
              user.storage.push(text)
              saveRpg()

              reply(`📦 Kamu menyimpan *${text}* ke dalam gudang.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdStorage, 'storage')
