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

// ───────── stash ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdStash = rpgCmd(["stash"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              user.storage ||= []

              if (!text) {
                let list = user.storage.length ? user.storage.map(i => `- ${i}`).join('\n') : '📭 Kosong'
                reply(`📦 *STORAGE*\n${list}\n\nKetik *stash itemmu* untuk mengambil.`)
                break
              }

              let idx = user.storage.indexOf(text)
              if (idx === -1) {
                reply(`Item *${text}* tidak ada di storage.`)
                break
              }

              user.storage.splice(idx, 1)
              user.inv.push(text)
              saveRpg()

              reply(`📤 Kamu mengambil *${text}* dari storage.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdStash, 'stash')
