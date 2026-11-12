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

// ───────── ludo-board ─────────
// Folder game baru. Mesin: lib/games/ludo.js, data tersimpan di database game (database/rpg.json → arcade.ludo).

import { cmd } from '../../lib/games/common.js'
import { ludoRun } from '../../lib/games/ludo.js'

// satu command = nama file
export default cmd('ludo', 'ludo-board', (A) => ludoRun(A, 'board'), "Lihat papan", { group: true })
