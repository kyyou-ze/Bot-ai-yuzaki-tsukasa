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

// ───────── koboy-leveltop ─────────
// Dipindah dari script Kaguya (command .koboy leveltop). Mesin game ada di lib/rpg/bridge.js (koboyRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, koboyRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdKoboy = rpgCmd(["koboy-leveltop"], (A) => koboyRun(A, 'leveltop'), { tags: 'koboy' })

// satu command = nama file
export default oneCommand(cmdKoboy, 'koboy-leveltop')
