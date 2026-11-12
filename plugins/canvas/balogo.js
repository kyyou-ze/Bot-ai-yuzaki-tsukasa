/**

* YannRzy Multi Device — WhatsApp & Tele Bot
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

// ───────── balogo ─────────
// Plugin canvas: balogo (satu command)
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import sharp from 'sharp'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { config, te, wrapPlugin, mergePlugins, uploadToTmpFilesOrg as uploadToTmpFiles, uploadToCatboxFile as uploadToCatbox } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'
// ── balogo ──
const _balogo = (() => {
const pluginConfig = {
    name: 'balogo',
    alias: [],
    category: 'canvas',
    description: 'Membuat logo Blue Archive style',
    usage: '.balogo <textL> & <textR>',
    example: '.balogo Blue & Archive',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const input = m.text?.trim() || ''
    const parts = input.split(/[&,]/).map(s => s.trim()).filter(s => s)

    if (parts.length < 2) {
        return m.reply(`🎮 *ʙʟᴜᴇ ᴀʀᴄʜɪᴠᴇ ʟᴏɢᴏ*\n\n> Masukkan 2 teks untuk logo\n\n> Contoh: ${m.prefix}balogo Blue & Archive`)
    }

    const textL = parts[0]
    const textR = parts[1]

    m.react('🕕')

    try {
        await sock.sendMessage(m.chat, { image: { url: `https://api.nexray.web.id/maker/balogo?text=${encodeURIComponent(textL)} ${encodeURIComponent(textR)}` } }, { quoted: m })

        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _balogo
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'balogo')
