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

// ───────── loot ─────────
// Dipecah dari plugins/rpg/gudang.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdLoot = rpgCmd(["loot"], async (A) => {
    const { initRpgUser, sender, pushname, m, reply, rpgDb, saveRpg } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              if (!m.quoted) return reply(`reply ke pesan musuh yang mati.`)
              let target = m.quoted.sender
              initRpgUser(target)

              let musuh = rpgDb[target]
              if (musuh.hp > 0) return reply(`🎯 Target masih hidup.`)

              if (musuh.inv.length === 0) return reply(`📭 Tidak ada barang untuk di-loot.`)

              let ambil = musuh.inv.splice(0, 1)[0]
              rpgDb[sender].inv.push(ambil)
              saveRpg()
              reply(`💰 Kamu berhasil mengambil *${ambil}* dari musuh.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdLoot, 'loot')
