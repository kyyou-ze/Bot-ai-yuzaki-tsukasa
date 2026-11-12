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

// ───────── mafia-help ─────────
// Folder game baru. Mesin: lib/games/mafia.js, data tersimpan di database game (database/rpg.json → arcade.mafia).

import { cmd } from '../../lib/games/common.js'
import { mafiaRun } from '../../lib/games/mafia.js'

// satu command = nama file
export default cmd('mafia', 'mafia-help', (A) => mafiaRun(A, 'help'), "Aturan Mafia", { group: true })
