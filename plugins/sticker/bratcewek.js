// ───────── bratcewek ─────────
// Dipecah dari plugins/sticker/brat.js (dulu digabung dengan fitur lain dalam satu file)

import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'

const _bratcewek = (() => {
const pluginConfig = {
    name: 'bratcewek',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker brat',
    usage: '.bratcewek <text>',
    example: '.bratcewek Hai semua',
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
        return m.reply(`🖼️ *ʙʀᴀᴛ cᴇᴡᴇᴋ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratcewek Hai semua\``)
    }

    m.react('🕕')

    try {
        const url = `https://api.deline.web.id/maker/cewekbrat?text=${encodeURIComponent(text)}`
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

_bratcewek.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_bratcewek.limit = true
export default oneCommand(_bratcewek, 'bratcewek')
