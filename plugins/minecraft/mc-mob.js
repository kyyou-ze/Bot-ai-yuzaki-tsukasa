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


// Wiki Minecraft: mc-mob (data lokal di ./data/mob.json, edit file itu untuk menambah/mengubah data)

import { readFileSync } from 'fs'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

const DATA = JSON.parse(readFileSync(new URL('./data/mob.json', import.meta.url), 'utf8'))

const _plugin = (() => {
const handler = async (m, { text, usedPrefix, command }) => {
    const q = String(text || '').trim().toLowerCase()
    const list = DATA.map(d => d.nama).join(', ')
    if (!q) return m.reply(`*Mob Minecraft*\n\nContoh: *${usedPrefix}${command} ${DATA[0].nama.toLowerCase()}*\n\nTersedia:\n${list}`)
    const exact = DATA.filter(d => d.nama.toLowerCase() === q)
    const hits = exact.length ? exact : DATA.filter(d => d.nama.toLowerCase().includes(q))
    if (!hits.length) return m.reply(`*Mob* "${text}" tidak ditemukan.\n\nTersedia:\n${list}`)
    if (hits.length > 1) return m.reply(`Ada beberapa hasil, pilih salah satu:\n${hits.map(d => '• ' + d.nama).join('\n')}`)
    const d = hits[0]
    return m.reply(`*${d.nama}*\n\n• Tipe: ${d.tipe}\n• HP: ${d.hp} (2 poin = 1 hati)\n\n${d.info}`)
}
handler.help = ['mc-mob <nama>']
handler.tags = ['minecraft']
handler.command = ['mc-mob']
handler.register = true
handler.limit = true
return wrapClassic(handler)
})()

_plugin.tags = ['minecraft']

// satu command = nama file
export default oneCommand(_plugin, 'mc-mob')
