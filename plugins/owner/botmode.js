/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Feature: Mode fitur (store only / rpg only / md only / dll)
 * Type: Plugins | ESM Modules
 *
 * .botmode            -> lihat mode & daftar kategori yang ada
 * .botmode store      -> hanya kategori "store" yang bisa dipakai/terlihat (selain owner)
 * .botmode all        -> semua kategori aktif lagi (default)
 *
 * Kategori = nama folder di dalam plugins/ (mis. plugins/store/, plugins/rpg/).
 * Owner selalu bisa pakai semua command apa pun mode-nya.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { updateConfigValue } from '../../lib/core/file.js'
import { botModeOn } from '../../lib/engine/plugins.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginsDir = path.join(__dirname, '../../plugins')

function listCategories() {
    try {
        return fs.readdirSync(pluginsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .sort()
    } catch {
        return []
    }
}

let handler = async (m, { reply, text, prefix, command }) => {
    const arg = String(text || '').trim().toLowerCase()
    const current = botModeOn() || 'all'

    if (!arg) {
        const cats = listCategories()
        return reply(
            `･ﾟ✦ *MODE BOT*\n\n` +
            `Mode saat ini: *${current}*\n` +
            (current !== 'all'
                ? `Selain owner, cuma kategori *${current}* yang bisa dipakai & kelihatan.\n\n`
                : `Semua kategori aktif untuk semua orang.\n\n`) +
            `*Cara pakai:*\n` +
            `${prefix}${command} <kategori>  — aktifkan mode khusus kategori itu\n` +
            `${prefix}${command} all  — matikan mode, balik normal\n\n` +
            `*Kategori tersedia:*\n${cats.map(c => `• ${c}`).join('\n')}`
        )
    }

    if (arg === 'all' || arg === 'off' || arg === 'normal') {
        updateConfigValue('botMode', 'all')
        global.botMode = 'all'
        return reply('･ﾟ✦ Mode bot dikembalikan ke *all* (semua kategori aktif untuk semua orang).')
    }

    const cats = listCategories()
    if (!cats.includes(arg)) {
        return reply(
            `Kategori *${arg}* tidak ditemukan.\n\n` +
            `Kategori tersedia:\n${cats.map(c => `• ${c}`).join('\n')}`
        )
    }

    updateConfigValue('botMode', arg)
    global.botMode = arg
    return reply(
        `･ﾟ✦ Mode bot diubah ke *${arg}*.\n\n` +
        `Selain owner, sekarang cuma command/menu kategori *${arg}* yang bisa dipakai dan kelihatan.\n` +
        `Ketik ${prefix}${command} all buat balikin ke normal.`
    )
}

handler.command = ['botmode', 'setmode']
handler.help = ['botmode', 'botmode <kategori>', 'botmode all']
handler.tags = ['owner']
handler.owner = true

export default handler
