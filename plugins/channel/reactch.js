/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — react pesan WhatsApp Channel lewat API
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  .rch https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n/489 👍
 */

import fetch from 'node-fetch'

let handler = async (m, { text, prefix, command, reply }) => {
    const p = prefix || '.'
    const cmd = command || 'rch'

    if (!text) {
        return reply(`❌ *Format Salah!*\n\nContoh:\n> ${p}${cmd} https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n/489 👍`)
    }

    const args = text.trim().split(/\s+/)
    const url = args[0]
    const reaction = args[1] || '👍'

    if (!url.includes('whatsapp.com/channel/')) {
        return reply('❌ URL harus berupa link pesan WhatsApp Channel yang valid.')
    }

    try {
        const api = `https://api-cloud.my.id/tools/rchv2?link=${encodeURIComponent(url)}&emoji=${encodeURIComponent(reaction)}`

        const res = await fetch(api)
        const json = await res.json()

        if (!json.status && json.status !== 200 && !json.success) {
            throw new Error(json.message || json.msg || 'Gagal mengirim reaction.')
        }

        return reply(
            `✅ *Reaction berhasil dikirim!*\n\n` +
            `💬 Reaction : ${reaction}\n` +
            `📢 Channel : WhatsApp Channel\n` +
            `📝 Status : Berhasil mengirim react ke pesan channel`
        )
    } catch (error) {
        console.error('[RCH ERROR]', error)
        return reply('❌ *GAGAL*\n\n> ' + (error.message || error))
    }
}

handler.command = ['rch', 'reactch']
handler.help = ['rch <url pesan channel> <emoji>']
handler.tags = ['channel']

export default handler
