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

import { countCommands } from '../../lib/engine/plugins.js'

let handler = async (m, { reply }) => {
    const total = countCommands().toLocaleString('id-ID')
    const botName = global.namebot ? String(global.namebot) : 'BOT'

    return reply(`📊 *TOTAL COMMAND ${botName.toUpperCase()}*\n\nTotal command : *${total}*`)
}

handler.command = ['t']
handler.help = ['t']
handler.tags = ['main']

export default handler
