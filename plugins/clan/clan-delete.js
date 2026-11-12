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

// ───────── clan-delete ─────────
// Dipindah dari script Kaguya (command .clan delete). Mesin game ada di lib/rpg/bridge.js (clanGameRun),
// data memakai store clan yang SAMA dengan clancreate/clanjoin/dst (db.data.clans, user.clanId).

import { rpgCmd, clanGameRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["clan-delete"], (A) => clanGameRun(A, 'delete'), { tags: 'clan', group: true, desc: 'Hapus clan milikmu (ketua)' })

// satu command = nama file
export default oneCommand(cmd, 'clan-delete')
