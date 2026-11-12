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

import { expandPlugins, menuCmds } from '../../lib/engine/plugins.js'

const FENCE = String.fromCharCode(96).repeat(3)

const categoryOf = (h) => {
    const tag = Array.isArray(h.tags) ? h.tags[0] : h.tags
    if (tag) return String(tag).toLowerCase()
    return h.owner ? 'owner' : 'main'
}

function countFeatures() {
    const cats = new Map()
    let fitur = 0
    let command = 0

    for (const h of expandPlugins()) {
        if (!h) continue
        if (!h.command) continue
        if (h.command instanceof RegExp) continue
        if (h.disabled) continue

        const cmds = menuCmds(h)
        if (!cmds.length) continue

        const cat = categoryOf(h)
        let entry = cats.get(cat)
        if (!entry) {
            entry = { fitur: 0, command: 0 }
            cats.set(cat, entry)
        }
        entry.fitur++
        entry.command += cmds.length

        fitur++
        command += cmds.length
    }

    const list = [...cats.entries()].sort((a, b) => {
        const diff = b[1].command - a[1].command
        return diff !== 0 ? diff : a[0].localeCompare(b[0])
    })
    return { fitur, command, list }
}

let handler = async (m, { reply }) => {
    const { fitur, command, list } = countFeatures()
    const nf = (n) => n.toLocaleString('id-ID')
    const width = Math.max(...list.map(([c]) => c.length), 4)
    const botName = global.namebot ? String(global.namebot) : 'BOT'

    const rows = list.map(([cat, v]) => '• ' + cat.padEnd(width) + ' : ' + nf(v.command) + ' command')

    return reply(
        '📊 *TOTAL FITUR ' + botName.toUpperCase() + '*\n\n' +
        'Total fitur   : *' + nf(command) + '*\n' +
        'Kategori      : *' + nf(list.length) + '*\n\n' +
        '*Per kategori*\n' +
        FENCE + '\n' + rows.join('\n') + '\n' + FENCE
    )
}

handler.command = ['totalfitur']
handler.help = ['totalfitur']
handler.tags = ['main']

export default handler
