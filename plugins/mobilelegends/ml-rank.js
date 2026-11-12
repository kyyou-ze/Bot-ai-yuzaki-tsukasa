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


// Wiki Mobile Legends: ml-rank (data lokal di ./data/rank.json, edit file itu untuk menambah/mengubah data)

import { readFileSync } from 'fs'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

const DATA = JSON.parse(readFileSync(new URL('./data/rank.json', import.meta.url), 'utf8'))

const _plugin = (() => {
const handler = async (m) => {
    return m.reply(`*Tier Rank Mobile Legends*\n\n${DATA.tier.join(' → ')}\n\n*Setelah Mythic (berdasarkan bintang):*\n${DATA.tinggi.join(' → ')}`)
}
handler.help = ['ml-rank']
handler.tags = ['mobilelegends']
handler.command = ['ml-rank']
handler.register = true
handler.limit = true
return wrapClassic(handler)
})()

_plugin.tags = ['mobilelegends']

// satu command = nama file
export default oneCommand(_plugin, 'ml-rank')
