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

// ───────── catur-rank ─────────
// Dipindah dari script Kaguya (command .caturrank). Mesin ada di lib/rpg/bridge.js (caturRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, caturRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["catur-rank"], (A) => caturRun(A, 'rank'), { tags: 'catur' })

// satu command = nama file
export default oneCommand(cmd, 'catur-rank')
