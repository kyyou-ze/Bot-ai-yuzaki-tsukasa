// ───────── bratvid ─────────
// Dipecah dari plugins/sticker/brat.js (dulu digabung dengan fitur lain dalam satu file)

import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { bratVid } from 'brat-canvas/video'

const _bratvid = (() => {
const pluginConfig = {
    name: 'bratvid',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker brat animated',
    usage: '.bratvid <text>',
    example: '.bratvid Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🎬 *ʙʀᴀᴛ ᴀɴɪᴍᴀᴛᴇᴅ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratvid Hai semua\``)
    }

    m.react('🕕')

    try {
        const tempFile = path.join(os.tmpdir(), `brat-${Date.now()}.webp`)
        const url = await bratVid(text, {
            outputFormat: 'mp4',
        })
        await fs.promises.writeFile(tempFile, url)
        await sock.sendVideoAsSticker(m.chat, tempFile, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        await fs.promises.unlink(tempFile)
        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

_bratvid.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_bratvid.limit = true
export default oneCommand(_bratvid, 'bratvid')
