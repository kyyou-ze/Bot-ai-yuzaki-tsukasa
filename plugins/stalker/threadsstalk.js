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

async function stalkThreads(username) {
    username = username.replace(/^@/, '')
    const url = `https://www.threads.net/@${username}`
    const { data: html } = await axios.get(url, {
        headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
        timeout: 20000,
    })
    const $ = cheerio.load(html)
    let user = null
    $('script[type="application/json"]').each((_, el) => {
        if (user) return
        const t = $(el).html()
        if (!t || !t.includes('follower_count')) return
        const uname = t.match(/"username":"([^"]+)"/)
        if (!uname) return
        const unesc = (s) => { try { return JSON.parse(`"${s}"`) } catch { return s } }
        const bio = t.match(/"biography":("(?:[^"\\]|\\.)*")/)
        const hd = t.match(/"hd_profile_pic_version":\{"url":"([^"]+)"/)
        const pp = t.match(/"profile_pic_url":"([^"]+)"/)
        const name = t.match(/"full_name":"([^"]*)"/)
        const fol = t.match(/"follower_count":(\d+)/)
        const ver = t.match(/"is_verified":(true|false)/)
        let biography = ''
        if (bio) { try { biography = JSON.parse(bio[1]) } catch { biography = bio[1] } }
        user = {
            username: uname[1], name: name ? unesc(name[1]) : '', biography,
            avatar: unesc((hd || pp || [])[1] || ''), followers: fol ? parseInt(fol[1]) : 0,
            verified: ver ? ver[1] === 'true' : false, url,
        }
    })
    if (!user) throw new Error('Akun Threads tidak ditemukan.')
    return user
}

async function send(sock, m, reply, caption, photo) {
    if (photo) {
        try { return await sock.sendMessage(m.chat, { image: { url: photo }, caption }, { quoted: m }) } catch {}
    }
    return reply(caption)
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const target = String(text || '').trim().split(/\s+/)[0]
    if (!target) return reply(`Masukkan username Threads.\n\nContoh:\n${prefix}${command} clarissadaily.ig`)
    try {
        await reactTo(sock, m, '⏳')
        const r = await stalkThreads(target)
        const caption = [
            '*🧵 THREADS STALK*', '',
            `👤 Username : @${r.username}${r.verified ? ' ✔️' : ''}`,
            r.name ? `📛 Nama : ${r.name}` : '',
            `👥 Followers : ${fmt(r.followers)}`,
            r.biography ? `📝 Bio : ${r.biography}` : '',
            `🔗 ${r.url}`,
        ].filter(Boolean).join('\n')
        await send(sock, m, reply, caption, r.avatar)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengambil profil.'}`)
    }
}

handler.command = ['threadsstalk']
handler.help = ['threadsstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
