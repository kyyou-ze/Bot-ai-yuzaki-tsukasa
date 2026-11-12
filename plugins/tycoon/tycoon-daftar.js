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

// ───────── tycoon-daftar ─────────
// Folder game baru (dunia role-play permanen). Mesin: lib/games/world.js, konfigurasi: lib/games/themes/tycoon.js
// Data tersimpan di database game (database/rpg.json → arcade.tycoon); koin = koin RPG.

import { cmd } from '../../lib/games/common.js'
import { worldRun } from '../../lib/games/world.js'
import THEME from '../../lib/games/themes/tycoon.js'

// satu command = nama file
export default cmd('tycoon', 'tycoon-daftar', (A) => worldRun(THEME, A, 'daftar'), "Daftar & pilih peran")
