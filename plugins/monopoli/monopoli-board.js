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

// ───────── monopoli-board ─────────
// Folder game baru. Mesin: lib/games/monopoli.js, data tersimpan di database game (database/rpg.json → arcade.monopoli).

import { cmd } from '../../lib/games/common.js'
import { monopoliRun } from '../../lib/games/monopoli.js'

// satu command = nama file
export default cmd('monopoli', 'monopoli-board', (A) => monopoliRun(A, 'board'), "Status pemain", { group: true })
