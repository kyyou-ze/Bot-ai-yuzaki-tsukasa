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

// ───────── uno-stop ─────────
// Dipindah dari script Kaguya (command .uno stop). Mesin game ada di lib/rpg/bridge.js (unoRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, unoRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["uno-stop"], (A) => unoRun(A, 'stop'), { tags: 'uno', group: true, desc: 'Hentikan permainan UNO' })

// satu command = nama file
export default oneCommand(cmd, 'uno-stop')
