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

// ───────── judibola ─────────
// Dipindah dari script Kaguya (command .judi). Mesin game ada di lib/rpg/bridge.js (judiBolaRun),
// data room tersimpan di database game (database/rpg.json). Pakai: .judibola create | join | player | mulai | vote 1/2 | delete

import { rpgCmd, judiBolaRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["judibola"], (A) => judiBolaRun(A), { tags: 'game', group: true, desc: 'Judi bola: tebak klub pemenang, taruhan 10 limit' })

// satu command = nama file
export default oneCommand(cmd, 'judibola')
