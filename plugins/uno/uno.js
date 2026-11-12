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

// ───────── uno ─────────
// Dipindah dari script Kaguya (command .uno). Mesin game ada di lib/rpg/bridge.js (unoRun),
// data tersimpan di database game (database/rpg.json).
// `.uno` membuat permainan di grup; `.uno draw` mengambil kartu; `.uno join` dst. tetap jalan, versi pisahnya `.uno-join` dst.

import { rpgCmd, unoRun } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const SUBS = ['info', 'join', 'start', 'stop', 'hand', 'card', 'play', 'draw', 'pass', 'color']

const cmd = rpgCmd(["uno"], (A) => {
    const first = String(A.args[0] || '').toLowerCase()
    if (SUBS.includes(first)) { A.args.shift(); A.text = A.args.join(' '); return unoRun(A, first) }
    return unoRun(A, 'create')
}, { tags: 'uno', group: true, desc: 'Buat permainan UNO di grup (sub: draw)' })

// satu command = nama file
export default oneCommand(cmd, 'uno')
