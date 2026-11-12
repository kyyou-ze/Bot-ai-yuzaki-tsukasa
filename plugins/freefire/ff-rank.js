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

// Wiki Free Fire: ff-rank (data lokal di ./data/rank.json, edit file itu untuk menambah/mengubah data)

import { readFileSync } from 'fs'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

const DATA = JSON.parse(readFileSync(new URL('./data/rank.json', import.meta.url), 'utf8'))

const _plugin = (() => {
const handler = async (m) => {
    let out = '*Tier Rank Free Fire*\n'
    for (const [mode, tiers] of Object.entries(DATA)) {
        out += `\n*${mode}*\n${tiers.join(' → ')}\n`
    }
    return m.reply(out.trim())
}
handler.help = ['ff-rank']
handler.tags = ['freefire']
handler.command = ['ff-rank']
handler.register = true
handler.limit = true
return wrapClassic(handler)
})()

_plugin.tags = ['freefire']

// satu command = nama file
export default oneCommand(_plugin, 'ff-rank')
