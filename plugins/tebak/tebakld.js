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

// ───────── tebakld ─────────
// Dipindah dari script Kaguya (command .tebakld). Skor = jumlah jawaban benar di semua game tebak-tebakan,
// dicatat mesin game (lib/engine/plugins.js) di user.gameWins. Mesin leaderboard: lib/rpg/bridge.js (tebakLeaderboardRun).

import { rpgCmd, tebakLeaderboardRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["tebakld"], (A) => tebakLeaderboardRun(A), { tags: 'tebak', desc: 'Leaderboard game tebak-tebakan' })

// satu command = nama file
export default oneCommand(cmd, 'tebakld')
