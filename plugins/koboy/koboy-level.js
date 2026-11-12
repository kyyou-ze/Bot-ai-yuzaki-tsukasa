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

// ───────── koboy-level ─────────
// Dipindah dari script Kaguya (command .koboy level). Mesin game ada di lib/rpg/bridge.js (koboyRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, koboyRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdKoboy = rpgCmd(["koboy-level"], (A) => koboyRun(A, 'level'), { tags: 'koboy' })

// satu command = nama file
export default oneCommand(cmdKoboy, 'koboy-level')
