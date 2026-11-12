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

// ───────── gaple-hand ─────────
// Dipindah dari script Kaguya (command .gaple hand). Mesin game ada di lib/rpg/bridge.js (gapleRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, gapleRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["gaple-hand"], (A) => gapleRun(A, 'hand'), { tags: 'gaple', group: true, desc: 'Kirim kartu milikmu ke chat pribadi' })

// satu command = nama file
export default oneCommand(cmd, 'gaple-hand')
