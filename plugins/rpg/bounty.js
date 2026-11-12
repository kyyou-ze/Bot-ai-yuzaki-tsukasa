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

// ───────── bounty ─────────
// Dipecah dari plugins/rpg/tempur.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdBounty = rpgCmd(["bounty"], async (A) => {
    const { initRpgUser, sender, pushname, text, reply, rpgDb, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!text) return reply('Gunakan: bounty @user jumlah')
              let [mention, jumlah] = text.split(' ')
              if (!mention || isNaN(jumlah)) return reply('Format salah. Contoh: bounty @target 1000')
              rpgDb.bounty ||= {}
              rpgDb.bounty[mention] = parseInt(jumlah)
              saveRpg()
              reply(`💰 Kamu pasang buronan ${mention} sebesar ${jumlah} coin!`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdBounty, 'bounty')
