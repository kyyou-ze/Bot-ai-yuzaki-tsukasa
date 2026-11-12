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

// ───────── npc ─────────
// Dipasang dari menu RPG Kaguya (.npc). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["npc"], async (A) => {
    const { text, reply, prefix } = A
    const npcList = {
        penjaga: '⚔️ Penjaga: Dunia ini berbahaya... simpan koinmu di bank!',
        penjual: `🛒 Penjual: Aku punya ramuan langka, coba *${prefix}shop*!`,
        tetua: `🧙 Tetua: Dengarkan kisah dunia ini lewat *${prefix}lore* dan kabar terbaru lewat *${prefix}rumor*.`,
        pandai: `🔨 Pandai Besi: Bawa tulang dan kulit, aku ajari kamu *${prefix}craft*.`,
        nelayan: `🎣 Nelayan: Ikan hari ini melimpah, coba *${prefix}fish* lalu *${prefix}cook supikan*.`
    }
    const key = String(text || '').trim().toLowerCase()
    if (!key || !npcList[key]) return reply(`NPC tidak ditemukan. Coba: ${Object.keys(npcList).join(', ')}`)
    return reply(npcList[key])
}, { tags: 'rpg', desc: 'Bicara dengan NPC' })

// satu command = nama file
export default oneCommand(cmd, 'npc')
