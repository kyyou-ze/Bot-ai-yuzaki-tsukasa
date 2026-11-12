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

// ───────── equip ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdEquip = rpgCmd(["equip"], async (A) => {
    const { initRpgUser, sender, pushname, text, reply, rpgDb, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!text) return reply('Ketik nama item yang ingin kamu equip.')

              let user = rpgDb[sender]
              let index = user.inv.findIndex(item => String(item).toLowerCase() === text.toLowerCase())
              if (index === -1) return reply('Item tidak ditemukan di inventory kamu.')

              let item = String(user.inv[index])
              let tipe = /pedang|belati|busur|tombak|kapak|tongkat|sword|bow|dagger|axe|staff/i.test(item) ? 'weapon'
                : /armor|baju|perisai|zirah|helm|jubah|shield/i.test(item) ? 'armor' : null
              if (!tipe) return reply('Item ini tidak bisa di-equip.')

              user.inv.splice(index, 1)
              if (user[tipe]) user.inv.push(user[tipe]) // item lama kembali ke inventory
              user[tipe] = item
              saveRpg()
              reply(`✅ ${item} berhasil dipasang!`)
            }
            break
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdEquip, 'equip')
