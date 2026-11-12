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

// ───────── itemuse ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdItemuse = rpgCmd(["itemuse"], async (A) => {
    const { initRpgUser, sender, pushname, text, reply, rpgDb, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!text) return reply(`Gunakan: *itemuse ramuan*`)

              let user = rpgDb[sender]
              let i = user.inv.indexOf(text)
              if (i === -1) return reply(`Item tidak ditemukan.`)

              if (text === 'ramuan') {
                user.hp = Math.min(user.hp + 50, 100)
                user.inv.splice(i, 1)
                saveRpg()
                reply(`🧪 Kamu meminum ramuan. HP-mu pulih jadi ${user.hp}`)
                break
              }

              reply(`Item *${text}* tidak bisa digunakan.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdItemuse, 'itemuse')
