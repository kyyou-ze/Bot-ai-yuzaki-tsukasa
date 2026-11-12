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

const formatCount = (n) => {
    if (!n || isNaN(n)) return '0'
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'M'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'jt'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'rb'
    return String(n)
}

function parseMetric(s) {
    if (!s) return 0
    const clean = s.replace(/,/g, '').trim()
    if (/m$/i.test(clean)) return Math.round(parseFloat(clean) * 1e6)
    if (/k$/i.test(clean)) return Math.round(parseFloat(clean) * 1e3)
    if (/b$/i.test(clean)) return Math.round(parseFloat(clean) * 1e9)
    return parseInt(clean, 10) || 0
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

async function stalkInstagram(rawUsername) {
    const username = String(rawUsername).replace(/^@+/, '').trim()
    if (!username || !/^[a-zA-Z0-9._]{1,30}$/.test(username)) throw new Error('Username Instagram tidak valid.')

    let followers = 0, followersF = '0', following = 0, followingF = '0', posts = 0, postsF = '0'
    let fullName = username, bio = '', isVerified = false, isPrivate = false, avatarUrl = '', found = false

    // 1. embed endpoint
    try {
        const res = await axios.get(`https://www.instagram.com/${username}/embed/`, {
            headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
            timeout: 8000,
            validateStatus: (s) => s < 500
        })
        const html = typeof res.data === 'string' ? res.data : ''
        if (res.status === 404 || html.includes('Page Not Found') || html.includes("Sorry, this page isn't available.")) {
            throw new Error(`Akun Instagram '@${username}' tidak ditemukan.`)
        }
        if (html.includes('followers_count') || html.includes('full_name')) {
            found = true
            const fM = html.match(/followers_count[^\d]*(\d+)/)
            const pM = html.match(/posts_count[^\d]*(\d+)/)
            const vM = html.match(/(?:is_verified|verified)[^\w]*(true|false)/)
            const prM = html.match(/is_private[^\w]*(true|false)/)
            const nM = html.match(/full_name\\*":\\*"([^"]+?)\\*",/)
            const picM = html.match(/profile_pic_url\\*":\\*"(https:[^"]+?)\\*",/)
            if (fM) { followers = parseInt(fM[1], 10); followersF = formatCount(followers) }
            if (pM) { posts = parseInt(pM[1], 10); postsF = formatCount(posts) }
            if (vM) isVerified = vM[1] === 'true'
            if (prM) isPrivate = prM[1] === 'true'
            if (nM?.[1]) {
                try { fullName = JSON.parse(`"${nM[1].replace(/\\\\/g, '\\')}"`) } catch { fullName = nM[1] }
            }
            if (picM?.[1]) {
                avatarUrl = picM[1].replace(/\\\//g, '/').replace(/\\\\/g, '').replace(/\\u0026/g, '&').replace(/\\u00253D/g, '=').replace(/\\u0025/g, '%')
            }
        }
    } catch (err) {
        if (err.message?.includes('tidak ditemukan')) throw err
    }

    // 2. metadata crawler (followers, following, bio)
    try {
        const res = await axios.get(`https://www.instagram.com/${username}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
            timeout: 6000,
            validateStatus: (s) => s < 500
        })
        if (res.status === 200 && typeof res.data === 'string') {
            const $ = cheerio.load(res.data)
            const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || ''
            const ogTitle = $('meta[property="og:title"]').attr('content') || ''
            const ogImage = $('meta[property="og:image"]').attr('content') || ''
            if (desc && (desc.includes('Followers') || desc.includes('Following'))) {
                found = true
                const d = desc.match(/([0-9.,KMBkmb]+)\s+Followers,\s+([0-9.,KMBkmb]+)\s+Following,\s+([0-9.,KMBkmb]+)\s+Posts/i)
                if (d) {
                    followers = parseMetric(d[1]); followersF = d[1]
                    following = parseMetric(d[2]); followingF = d[2]
                    posts = parseMetric(d[3]); postsF = d[3]
                }
                const t = (ogTitle || $('title').text()).match(/^(.*?)(?:\s*\(@|\s*•)/)
                if (t?.[1]?.trim()) fullName = t[1].trim()
                const b = desc.match(/on Instagram:\s*"([\s\S]*?)"\s*$/)
                if (b?.[1]) bio = b[1].trim()
                if (ogImage && !avatarUrl) avatarUrl = ogImage
                const titleText = $('title').text()
                if (titleText.includes('InstagramVerified') || titleText.includes('VerifiedOptions')) isVerified = true
            }
        }
    } catch {}

    if (!found) throw new Error(`Akun Instagram '@${username}' tidak ditemukan atau privat.`)
    return { username, fullName, bio, isVerified, isPrivate, followers, followersF, following, followingF, posts, postsF, avatarUrl }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const target = String(text || '').trim().split(/\s+/)[0]
    if (!target) return reply(`Masukkan username Instagram.\n\nContoh:\n${prefix}${command} instagram`)

    try {
        await reactTo(sock, m, '⏳')
        const r = await stalkInstagram(target)
        const caption = [
            '*📸 INSTAGRAM STALK*',
            '',
            `👤 Username : @${r.username}${r.isVerified ? ' ✔️' : ''}`,
            `📛 Nama : ${r.fullName}`,
            `👥 Followers : ${r.followersF}`,
            `➡️ Following : ${r.followingF}`,
            `🖼️ Postingan : ${r.postsF}`,
            `🔒 Private : ${r.isPrivate ? 'Ya' : 'Tidak'}`,
            r.bio ? `📝 Bio : ${r.bio}` : '',
            `🔗 https://instagram.com/${r.username}`
        ].filter(Boolean).join('\n')

        const photo = r.avatarUrl || global.thumb?.utama
        if (photo) {
            try {
                await sock.sendMessage(m.chat, { image: { url: photo }, caption }, { quoted: m })
            } catch {
                await reply(caption)
            }
        } else {
            await reply(caption)
        }
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengambil profil.'}`)
    }
}

handler.command = ['igstalk']
handler.help = ['igstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
