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

// ───────── crypto-watchlist ─────────
// Dipindah dari script Kaguya (command .crypto watchlist). Mesin ada di lib/rpg/bridge.js (cryptoRun),
// data tersimpan di database game (database/rpg.json).

import { rpgCmd, cryptoRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["crypto-watchlist"], (A) => cryptoRun(A, 'watchlist'), { tags: 'crypto' })

// satu command = nama file
export default oneCommand(cmd, 'crypto-watchlist')
