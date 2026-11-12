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

// ───────── quest ─────────
// Dipasang dari menu RPG Kaguya (.quest). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { questRun } from '../../lib/db/database.js'

const cmd = rpgCmd(["quest"], async (A) => {
    return questRun(A)
}, { tags: 'rpg', desc: 'Misi harian (kumpulkan item)' })

// satu command = nama file
export default oneCommand(cmd, 'quest')
