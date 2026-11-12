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

async function stalkTikTok(username) {
    username = username.replace(/^@/, '')
    const url = `https://www.tiktok.com/@${username}`
    const { data: html } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        timeout: 20000,
    })
    const raw = cheerio.load(html)('#__UNIVERSAL_DATA_FOR_REHYDRATION__').text()
    if (!raw) throw new Error('Data tidak ditemukan (kemungkinan diblokir WAF TikTok).')

    const detail = JSON.parse(raw)?.__DEFAULT_SCOPE__?.['webapp.user-detail']
    if (!detail || detail.statusCode !== 0 || !detail.userInfo) throw new Error('Akun TikTok tidak ditemukan.')

    const { user, stats } = detail.userInfo
    return {
        username: user.uniqueId, nickname: user.nickname, signature: user.signature,
        verified: user.verified, avatar: user.avatarLarger || user.avatarMedium,
        followers: stats.followerCount, following: stats.followingCount,
        videos: stats.videoCount, likes: stats.heartCount, friends: stats.friendCount, url,
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
    if (!target) return reply(`Masukkan username TikTok.\n\nContoh:\n${prefix}${command} asololepisanwan`)
    try {
        await reactTo(sock, m, '⏳')
        const r = await stalkTikTok(target)
        const caption = [
            '*🎵 TIKTOK STALK*', '',
            `👤 Username : @${r.username}${r.verified ? ' ✔️' : ''}`,
            `📛 Nama : ${r.nickname}`,
            `👥 Followers : ${fmt(r.followers)}`,
            `➡️ Following : ${fmt(r.following)}`,
            `🎬 Video : ${fmt(r.videos)}`,
            `❤️ Likes : ${fmt(r.likes)}`,
            `🤝 Teman : ${fmt(r.friends)}`,
            r.signature ? `📝 Bio : ${r.signature}` : '',
            `🔗 ${r.url}`,
        ].filter(Boolean).join('\n')
        await send(sock, m, reply, caption, r.avatar)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengambil profil.'}`)
    }
}

handler.command = ['ttstalk']
handler.help = ['ttstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
