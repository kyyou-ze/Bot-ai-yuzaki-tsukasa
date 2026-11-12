// ───────── bratanime ─────────
// Dipecah dari plugins/sticker/brat.js (dulu digabung dengan fitur lain dalam satu file)

import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'

const _animebrat = (() => {
const pluginConfig = {
    name: 'bratanime',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker brat',
    usage: '.bratanime <text>',
    example: '.bratanime Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🖼️ *ʙʀᴀᴛ ᴀɴɪᴍᴇ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratanime Hai semua\``)
    }

    m.react('🕕')

    try {
        const url = `https://api.nexray.web.id/maker/bratanime?text=${encodeURIComponent(text)}`
        await sock.sendImageAsSticker(m.chat, url, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

_animebrat.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_animebrat.limit = true
export default oneCommand(_animebrat, 'bratanime')
