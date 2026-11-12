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

// ───────── atmall ─────────
// Dipecah dari plugins/rpg/ekonomi.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdAtmall = rpgCmd(["atmall"], async (A) => {
    const { rpgDb, fmt, reply } = A
    switch (0) {
        default:
            {
              const ranking = Object.entries(rpgDb)
                .map(([id,u]) => ({ id, bank: (u&&u.bank)||0, name: (u&&u.name)||id.split('@')[0] }))
                .sort((a,b)=>b.bank-a.bank)
                .slice(0, 10)

              const teks = `🏦 *ATMALL LEADERBOARD*\n\n` +
                (ranking.length
                  ? ranking.map((u,i)=> `${i+1}. ${u.name} → ${fmt(u.bank)} coin`).join('\n')
                  : 'Belum ada data.')

              return reply(teks)
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdAtmall, 'atmall')
