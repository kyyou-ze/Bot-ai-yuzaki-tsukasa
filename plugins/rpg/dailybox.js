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

// ───────── dailybox ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdDailybox = rpgCmd(["dailybox"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let u = rpgDb[sender]
              let now = Date.now()
              if (u.lastBox && now - u.lastBox < 86400000) return reply(`📦 Kamu sudah ambil hari ini.`)

              u.lastBox = now
              let hadiah = ['ramuan', 'kunci', 'fragmen'][Math.floor(Math.random() * 3)]
              u.inv.push(hadiah)
              saveRpg()
              reply(`🎁 Kamu mendapat *${hadiah}* dari kotak harian!`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdDailybox, 'dailybox')
