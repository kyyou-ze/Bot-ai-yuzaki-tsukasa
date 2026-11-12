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

// ───────── ulartangga-stop ─────────
// Folder game baru. Mesin: lib/games/ulartangga.js, data tersimpan di database game (database/rpg.json → arcade.ulartangga).

import { cmd } from '../../lib/games/common.js'
import { ulartanggaRun } from '../../lib/games/ulartangga.js'

// satu command = nama file
export default cmd('ulartangga', 'ulartangga-stop', (A) => ulartanggaRun(A, 'stop'), "Hentikan", { group: true })
