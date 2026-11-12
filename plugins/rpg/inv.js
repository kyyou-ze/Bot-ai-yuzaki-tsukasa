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

// ───────── inv ─────────
// Dipasang dari menu RPG Kaguya (.inv). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'
import { invSummary } from '../../lib/db/database.js'

const cmd = rpgCmd(["inv"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply, fmt, prefix } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const items = invSummary(u)
    const status = `💰 Coin: ${fmt(u.coin)} | 🏦 Bank: ${fmt(u.bank)}\n⚔️ Senjata: ${u.weapon || '-'} | 🛡️ Armor: ${u.armor || '-'}`
    if (!items.length) return reply(`🎒 *INVENTORY*\n\n${status}\n\nTas kamu kosong.`)
    return reply(`🎒 *INVENTORY*\n\n${status}\n\n${items.map(([n, c]) => `• ${n} x${c}`).join('\n')}\n\nGunakan: *${prefix}equip <item>* untuk memasang\nGunakan: *${prefix}sell <item>* untuk menjual`)
}, { tags: 'rpg', desc: 'Lihat inventory' })

// satu command = nama file
export default oneCommand(cmd, 'inv')
