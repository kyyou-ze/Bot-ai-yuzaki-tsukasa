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

// Wiki Free Fire: ff-karakter (data lokal di ./data/karakter.json, edit file itu untuk menambah/mengubah data)

import { readFileSync } from 'fs'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

const DATA = JSON.parse(readFileSync(new URL('./data/karakter.json', import.meta.url), 'utf8'))

const _plugin = (() => {
const handler = async (m, { conn, text, usedPrefix, command }) => {
    const q = String(text || '').trim().toLowerCase()
    if (!q) {
        return m.reply(`*Karakter Free Fire*\n\nContoh: *${usedPrefix}${command} ${DATA[0].nama.toLowerCase()}*\n\nTersedia:\n${DATA.map(d => d.nama).join(', ')}`)
    }
    const exact = DATA.filter(d => d.nama.toLowerCase() === q)
    const hits = exact.length ? exact : DATA.filter(d => d.nama.toLowerCase().includes(q))
    if (!hits.length) return m.reply(`*Karakter* "${text}" tidak ditemukan.\n\nTersedia:\n${DATA.map(d => d.nama).join(', ')}`)
    if (hits.length > 1) return m.reply(`Ada beberapa hasil, pilih salah satu:\n${hits.map(d => '• ' + d.nama).join('\n')}`)
    const d = hits[0]
    return m.reply(`*${d.nama}*\n\n• Jenis: ${d.jenis}\n• Skill: ${d.skill}\n\n${d.info}`)
}
handler.help = ['ff-karakter <nama>']
handler.tags = ['freefire']
handler.command = ['ff-karakter']
handler.register = true
handler.limit = true
return wrapClassic(handler)
})()

_plugin.tags = ['freefire']

// satu command = nama file
export default oneCommand(_plugin, 'ff-karakter')
