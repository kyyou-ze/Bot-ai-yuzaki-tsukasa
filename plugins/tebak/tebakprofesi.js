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

import { runGame } from '../../lib/engine/plugins.js'

// Dipindah dari script Kaguya (.tebak profesi). Soal: plugins/game/data/tebakkaguya.json
const handler = (m, ctx) => runGame('tebakprofesi', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakprofesi']
export default handler
