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

import { updateConfigValue } from '../../lib/core/file.js'

const MODES = {
    off: 'Telepon dibiarkan (anti-call mati).',
    tolak: 'Telepon otomatis ditolak, penelepon diberi tahu.',
    block: 'Telepon ditolak dan penelepon diblokir.'
}
const ALIAS = { on: 'tolak', reject: 'tolak', nonaktif: 'off', mati: 'off', blokir: 'block' }

let handler = async (m, { text, prefix, reply }) => {
    const current = ['tolak', 'block'].includes(String(global.anticall).toLowerCase()) ? String(global.anticall).toLowerCase() : 'off'
    const arg = String(text || '').trim().toLowerCase().split(/\s+/)[0]
    const mode = ALIAS[arg] || arg

    if (!MODES[mode]) {
        return reply(
            `*▢ ANTI-CALL*\nStatus: *${current}*\n${MODES[current]}\n\n` +
            `${prefix}anticall off\n${prefix}anticall tolak\n${prefix}anticall block`
        )
    }
    if (mode === current) return reply(`･ﾟ✦ Anti-call sudah *${mode}*.`)

    global.anticall = mode
    const saved = updateConfigValue('anticall', mode)
    return reply(`･ﾟ✦ Anti-call: *${mode}*\n${MODES[mode]}${saved ? '' : '\n\n_Gagal menyimpan ke config.js, pengaturan kembali seperti semula setelah restart._'}`)
}

handler.command = ['anticall']
handler.help = ['anticall off/tolak/block']
handler.tags = ['owner']
handler.owner = true

export default handler
