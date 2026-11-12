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

// ───────── talent ─────────
// Dipecah dari plugins/rpg/karakter.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdTalent = rpgCmd(["talent"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let kelas = rpgDb[sender].class || 'belum memilih'
              let teks = {
                knight: '⚔️ Damage +10 saat duel',
                mage: '🔮 Skill cooldown -10%',
                archer: '🏹 Critical +15%'
              }
              reply(`💡 *Talent Class ${kelas}:*\n${teks[kelas] || 'Belum tersedia'}`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdTalent, 'talent')
