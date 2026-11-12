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
import { reactTo } from '../../lib/core/file.js'

const BACKEND = 'https://shinyfrydgdghfdgdgmouse-a6de.issam1996kech.workers.dev/api/v1/profile'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const flag = (cc) => (typeof cc === 'string' && cc.length === 2
    ? String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)))
    : '')

const fmt = (n) => Number(n || 0).toLocaleString('id-ID')
const regionLine = (code, name) => (code || name ? `${flag(code)} ${name || '-'}${code ? ` (${code})` : ''}` : '-')

async function checkRegion(username) {
    const clean = String(username || '').trim().replace(/^@+/, '')
    if (!clean) throw new Error('Username TikTok tidak valid.')

    const res = await fetch(`${BACKEND}?username=${encodeURIComponent(clean)}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://tikip.us', Referer: 'https://tikip.us/' },
        signal: AbortSignal.timeout(20000)
    })
    const json = await res.json().catch(() => null)
    if (json?.status === 'error') throw new Error(json.error || 'Username TikTok tidak ditemukan.')
    if (json?.status !== 'success' || !json.data?.user) throw new Error('Gagal mengambil data akun dari Tikip.')

    const u = json.data.user
    const s = json.data.stats || {}
    let likes = s.heartCount || 0
    if (typeof likes === 'number' && likes < 0) likes = likes >>> 0 // fix overflow 32-bit

    return {
        username: u.uniqueId || clean,
        nickname: u.nickname || '-',
        id: u.id || '-',
        bio: u.signature || '',
        verified: !!u.verified,
        private: !!u.privateAccount,
        language: u.language || '-',
        created: u.createTime ? new Date(u.createTime * 1000).toISOString().slice(0, 10) : '-',
        region: regionLine(json.data.region || u.current_region, json.data.region_name || u.current_region_name),
        registered: regionLine(u.registered_region, u.registered_region_name),
        locked: regionLine(u.locked_region, u.locked_region_name),
        followers: s.followerCount, following: s.followingCount, likes, videos: s.videoCount,
        avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb || ''
    }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const target = String(text || '').trim().split(/\s+/)[0]
    if (!target) return reply(`Masukkan username TikTok.\n\nContoh:\n${prefix}${command} @khaby.lame`)
    try {
        await reactTo(sock, m, '⏳')
        const r = await checkRegion(target)
        const caption = [
            '*🌏 TIKTOK REGION*', '',
            `👤 Username : @${r.username}${r.verified ? ' ✅' : ''}`,
            `📛 Nama : ${r.nickname}`,
            `🆔 ID : ${r.id}`,
            `🔒 Privat : ${r.private ? 'Ya' : 'Tidak'}`,
            `🗣️ Bahasa : ${r.language}`,
            `📅 Dibuat : ${r.created}`, '',
            `📍 Region : ${r.region}`,
            `📝 Terdaftar : ${r.registered}`,
            `🔐 Terkunci : ${r.locked}`, '',
            `👥 Followers : ${fmt(r.followers)}`,
            `➡️ Following : ${fmt(r.following)}`,
            `❤️ Likes : ${fmt(r.likes)}`,
            `🎬 Video : ${fmt(r.videos)}`,
            r.bio ? `\n📄 Bio : ${r.bio.slice(0, 300)}` : '',
            `\n🔗 https://www.tiktok.com/@${r.username}`
        ].filter(x => x !== '').join('\n')

        if (r.avatar) {
            try { await sock.sendMessage(m.chat, { image: { url: r.avatar }, caption }, { quoted: m }) }
            catch { await reply(caption) }
        } else await reply(caption)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengecek region.'}`)
    }
}

handler.command = ['ttregion']
handler.help = ['ttregion <@username>']
handler.tags = ['stalker']
handler.limit = true

export default handler
