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

async function stalkX(username) {
    username = username.replace(/^@/, '')
    const url = `https://x.com/${username}`
    const { data: html } = await axios.get(url, {
        headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
        },
        timeout: 20000,
    })
    const $ = cheerio.load(html)
    const p = { username, name: '', description: '', avatar: '', banner: '', posts: '0', joined: '', followers: 0, following: 0, url }

    $('meta').each((_, el) => {
        const k = $(el).attr('name') || $(el).attr('property')
        const v = $(el).attr('content')
        if (!k || !v) return
        if (k === 'profile:first_name') p.name = v
        if (k === 'description') p.description = v
        if (k === 'og:image') p.avatar = v.replace('_200x200', '').replace('_normal', '')
        if (k === 'twitter:image' && v.includes('profile_banners')) p.banner = v + '/1500x500'
        if (k === 'twitter:data1') p.posts = v
        if (k === 'twitter:data2') p.joined = v
    })

    const fol = html.match(/followers:(\d+),following:(\d+)/)
    if (fol) { p.followers = parseInt(fol[1]); p.following = parseInt(fol[2]) }

    if (!p.name && p.followers === 0) throw new Error('Akun X tidak ditemukan.')
    return p
}

async function send(sock, m, reply, caption, photo) {
    if (photo) {
        try { return await sock.sendMessage(m.chat, { image: { url: photo }, caption }, { quoted: m }) } catch {}
    }
    return reply(caption)
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const target = String(text || '').trim().split(/\s+/)[0]
    if (!target) return reply(`Masukkan username X (Twitter).\n\nContoh:\n${prefix}${command} mrbeast`)
    try {
        await reactTo(sock, m, '⏳')
        const r = await stalkX(target)
        const caption = [
            '*𝕏 X (TWITTER) STALK*', '',
            `👤 Username : @${r.username}`,
            r.name ? `📛 Nama : ${r.name}` : '',
            `👥 Followers : ${fmt(r.followers)}`,
            `➡️ Following : ${fmt(r.following)}`,
            r.posts !== '0' ? `📝 Postingan : ${r.posts}` : '',
            r.joined ? `📅 Bergabung : ${r.joined}` : '',
            r.description ? `💬 Bio : ${r.description}` : '',
            `🔗 ${r.url}`,
        ].filter(Boolean).join('\n')
        await send(sock, m, reply, caption, r.avatar)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengambil profil.'}`)
    }
}

handler.command = ['xtstalk']
handler.help = ['xtstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
