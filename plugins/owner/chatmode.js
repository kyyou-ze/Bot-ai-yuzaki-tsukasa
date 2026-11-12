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

const ON = /^(on|1|true|aktif|nyala|hidup)$/i
const OFF = /^(off|0|false|mati|nonaktif)$/i
const flag = (v) => (v === true ? '✅ ON' : '❌ OFF')
const INFO = {
    pconly: 'hanya melayani *private chat* (di grup bot diam)',
    gconly: 'hanya melayani *grup* (di private chat bot diam)'
}

const status = (prefix) =>
    `*▢ MODE CHAT*\n\n` +
    `• PC Only : ${flag(global.pconly)}\n` +
    `• GC Only : ${flag(global.gconly)}\n\n` +
    `${prefix}pconly on/off\n${prefix}gconly on/off\n_Owner tetap dilayani di mana pun._`

let handler = async (m, { command, text, prefix, reply }) => {
    if (command === 'chatmode') return reply(status(prefix))

    const other = command === 'pconly' ? 'gconly' : 'pconly'
    const arg = String(text || '').trim().split(/\s+/)[0] || ''

    if (!ON.test(arg) && !OFF.test(arg)) {
        return reply(`${status(prefix)}\n\nGunakan: *${prefix}${command} on* atau *${prefix}${command} off*`)
    }

    const on = ON.test(arg)
    if ((global[command] === true) === on) return reply(`･ﾟ✦ ${command} sudah ${on ? 'aktif' : 'nonaktif'}.`)

    global[command] = on // berlaku langsung
    let note = ''
    if (on && global[other] === true) {
        // dua-duanya aktif = bot tidak melayani siapa pun, jadi yang lain otomatis dimatikan
        global[other] = false
        updateConfigValue(other, false)
        note = `\n${other} otomatis dimatikan.`
    }
    const saved = updateConfigValue(command, on) // simpan ke config.js supaya tetap setelah restart

    return reply(
        `･ﾟ✦ *${command}* ${on ? 'diaktifkan' : 'dimatikan'}.` +
        (on ? `\nBot sekarang ${INFO[command]}.` : '\nBot kembali melayani semua tempat.') +
        note +
        (saved ? '' : '\n\n_Gagal menyimpan ke config.js, pengaturan kembali seperti semula setelah restart._')
    )
}

handler.command = ['chatmode', 'gconly', 'pconly']
handler.help = ['chatmode pconly on/off', 'chatmode gconly on/off', 'chatmode']
handler.tags = ['owner']
handler.owner = true

export default handler
