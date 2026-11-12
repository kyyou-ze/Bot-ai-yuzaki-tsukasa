/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */
import axios from 'axios'
import * as cheerio from 'cheerio'
import { reactTo } from '../../lib/core/file.js'

const fmt = (n) => {
    n = Number(n)
    if (!n || isNaN(n)) return '0'
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'M'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'jt'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'rb'
    return String(n)
}

function findKey(obj, key) {
    let found = null
    const walk = (o) => {
        if (!o || typeof o !== 'object') return false
        if (o[key] !== undefined) { found = o[key]; return true }
        for (const k in o) if (walk(o[k])) return true
        return false
    }
    walk(obj)
    return found
}

async function stalkYT(username) {
    if (!username.startsWith('@')) username = '@' + username
    const { data: html } = await axios.get(`https://www.youtube.com/${username}`, {
        headers: {
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
        timeout: 20000,
    })
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/)
    if (!match) throw new Error('Channel YouTube tidak ditemukan.')

    const data = JSON.parse(match[1])
    const meta = data.metadata?.channelMetadataRenderer
    if (!meta) throw new Error('Channel YouTube tidak ditemukan.')

    const thumbs = meta.avatar?.thumbnails || []
    const banner = findKey(data.header, 'imageBannerViewModel')?.image?.sources?.slice(-1)[0]?.url || ''
    const header = JSON.stringify(data.header || {})
    const subs = header.match(/"content":"([^"]+ subscribers?)"/i)?.[1] || '0'
    const vids = header.match(/"content":"([^"]+ videos?)"/i)?.[1] || '0'

    return {
        id: meta.externalId, handle: username, title: meta.title, description: meta.description,
        avatar: thumbs[thumbs.length - 1]?.url || '', banner, subscribers: subs, videos: vids,
        url: meta.channelUrl,
    }
}

async function send(sock, m, reply, caption, photo) {
    if (photo) {
        try { return await sock.sendMessage(m.chat, { image: { url: photo }, caption }, { quoted: m }) } catch {}
    }
    return reply(caption)
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const target = String(text || '').trim().split(/\s+/)[0]
    if (!target) return reply(`Masukkan username channel YouTube.\n\nContoh:\n${prefix}${command} @kingronal21`)
    try {
        await reactTo(sock, m, '⏳')
        const r = await stalkYT(target)
        const desc = r.description ? (r.description.length > 300 ? r.description.slice(0, 300) + '…' : r.description) : ''
        const caption = [
            '*▶️ YOUTUBE STALK*', '',
            `📛 Channel : ${r.title}`,
            `👤 Handle : ${r.handle}`,
            `🆔 ID : ${r.id}`,
            `👥 Subscribers : ${r.subscribers}`,
            `🎬 Video : ${r.videos}`,
            desc ? `📝 Deskripsi : ${desc}` : '',
            `🔗 ${r.url}`,
        ].filter(Boolean).join('\n')
        await send(sock, m, reply, caption, r.avatar)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengambil channel.'}`)
    }
}

handler.command = ['ytstalk']
handler.help = ['ytstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
