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

// ───────── uno-color ─────────
// Dipindah dari script Kaguya (command .uno color). Mesin game ada di lib/rpg/bridge.js (unoRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, unoRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["uno-color"], (A) => unoRun(A, 'color'), { tags: 'uno', group: true, desc: 'Pilih warna setelah wild: .uno-color <red|yellow|green|blue>' })

// satu command = nama file
export default oneCommand(cmd, 'uno-color')
