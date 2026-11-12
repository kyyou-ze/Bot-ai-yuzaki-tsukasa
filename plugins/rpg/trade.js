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

// ───────── trade ─────────
// Dipecah dari plugins/rpg/ekonomi.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdTrade = rpgCmd(["trade"], async (A) => {
    const { initRpgUser, sender, pushname, m, reply, rpgDb, text, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!m.quoted) {
                reply(`reply pesan target trade.\nFormat: *trade itemnamanya* atau *trade 500* (koin)`)
                break
              }

              let targetId = m.quoted.sender
              initRpgUser(targetId)
              let user = rpgDb[sender]
              let target = rpgDb[targetId]

              if (!text) {
                reply(`Ketik item atau jumlah koin yang ingin kamu kirim.`)
                break
              }

              let jumlah = parseInt(text)
              if (!isNaN(jumlah)) {
                if (user.coin < jumlah) {
                  reply(`Uangmu tidak cukup!`)
                  break
                }
                user.coin -= jumlah
                target.coin += jumlah
                saveRpg()
                reply(`✅ Kamu mengirim ${jumlah} 💰 ke ${target.name}`)
              } else {
                let idx = user.inv.findIndex(i => i === text)
                if (idx === -1) {
                  reply(`Kamu tidak punya item *${text}*`)
                  break
                }
                user.inv.splice(idx, 1)
                target.inv.push(text)
                saveRpg()
                reply(`🎁 Kamu memberikan *${text}* ke ${target.name}`)
              }

              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdTrade, 'trade')
