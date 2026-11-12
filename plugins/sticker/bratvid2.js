// ───────── bratvid2 ─────────
// Dipecah dari plugins/sticker/brat.js (dulu digabung dengan fitur lain dalam satu file)

import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'

const _bratvid2 = (() => {
const pluginConfig = {
    name: 'bratvid2',
    alias: [],
    category: 'sticker',
    description: 'Generate brat video v2',
    usage: '.bratvid2 <text>',
    example: '.bratvid2 hello world',
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
        return m.reply(`🎬 *ʙʀᴀᴛ ᴠɪᴅᴇᴏ ᴠ2*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratvid2 hello world\``)
    }

    m.react('🕕')

    try {
        const url = `https://api-faa.my.id/faa/bratvid?text=${encodeURIComponent(text)}`
        await sock.sendVideoAsSticker(m.chat, url, m, {
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

_bratvid2.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_bratvid2.limit = true
export default oneCommand(_bratvid2, 'bratvid2')
