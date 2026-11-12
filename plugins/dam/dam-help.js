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

// ───────── dam-help ─────────
// Folder game baru. Mesin: lib/games/dam.js, data tersimpan di database game (database/rpg.json → arcade.dam).

import { cmd } from '../../lib/games/common.js'
import { damRun } from '../../lib/games/dam.js'

// satu command = nama file
export default cmd('dam', 'dam-help', (A) => damRun(A, 'help'), "Aturan & panduan", { group: true })
