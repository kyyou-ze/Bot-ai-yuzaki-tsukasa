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

// ───────── clan-member ─────────
// Dipindah dari script Kaguya (command .clan member). Mesin game ada di lib/rpg/bridge.js (clanGameRun),
// data memakai store clan yang SAMA dengan clancreate/clanjoin/dst (db.data.clans, user.clanId).

import { rpgCmd, clanGameRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["clan-member"], (A) => clanGameRun(A, 'member'), { tags: 'clan', group: true, desc: 'Daftar anggota clan: .clan-member <nama>' })

// satu command = nama file
export default oneCommand(cmd, 'clan-member')
