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

// ───────── esport ─────────
// Folder game baru (dunia role-play permanen). Mesin: lib/games/world.js, konfigurasi: lib/games/themes/esport.js
// Data tersimpan di database game (database/rpg.json → arcade.esport); koin = koin RPG.

import { cmd } from '../../lib/games/common.js'
import { worldRun } from '../../lib/games/world.js'
import THEME from '../../lib/games/themes/esport.js'

// satu command = nama file
export default cmd('esport', 'esport', (A) => worldRun(THEME, A, 'help'), "Menu esport")
