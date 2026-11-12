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
import { reactTo } from '../../lib/core/file.js'

const BASE = {
    users: 'https://users.roblox.com',
    avatar: 'https://avatar.roblox.com',
    thumbnails: 'https://thumbnails.roblox.com',
    friends: 'https://friends.roblox.com',
    presence: 'https://presence.roblox.com',
    groups: 'https://groups.roblox.com',
    badges: 'https://badges.roblox.com',
    account: 'https://accountinformation.roblox.com',
    games: 'https://games.roblox.com'
}

const http = axios.create({
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RobloxStalker/1.3)', Accept: 'application/json' }
})

const get = (url) => http.get(url).then(r => r.data)
const post = (url, body) => http.post(url, body, { headers: { 'Content-Type': 'application/json' } }).then(r => r.data)
const safe = async (fn, fallback) => { try { return await fn() } catch { return fallback } }

const fmt = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('id-ID'))
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s))

const PRESENCE = ['Offline', 'Online', 'Sedang main game', 'Di Roblox Studio', 'Invisible']

async function getUserByName(username) {
    const data = await post(`${BASE.users}/v1/usernames/users`, { usernames: [username], excludeBannedUsers: false })
    if (!data.data?.length) throw new Error(`Username "${username}" tidak ditemukan.`)
    return data.data[0]
}

async function thumb(path) {
    const d = await safe(() => get(`${BASE.thumbnails}${path}`), null)
    return d?.data?.[0]?.imageUrl || null
}

export async function stalkRoblox(input) {
    const clean = String(input || '').trim().replace(/^@/, '')
    if (!clean) throw new Error('Username kosong.')

    const basic = await getUserByName(clean)
    const id = basic.id

    const [user, avatar, social, presence, groups, badges, history, robloxBadges, favs, fullBody, headshot] = await Promise.all([
        get(`${BASE.users}/v1/users/${id}`),
        safe(() => get(`${BASE.avatar}/v1/users/${id}/avatar`), {}),
        Promise.all([
            safe(() => get(`${BASE.friends}/v1/users/${id}/friends/count`), {}),
            safe(() => get(`${BASE.friends}/v1/users/${id}/followers/count`), {}),
            safe(() => get(`${BASE.friends}/v1/users/${id}/followings/count`), {})
        ]).then(([f, fo, fi]) => ({ friends: f.count ?? null, followers: fo.count ?? null, followings: fi.count ?? null })),
        safe(async () => (await post(`${BASE.presence}/v1/presence/users`, { userIds: [id] })).userPresences?.[0] || null, null),
        safe(async () => ((await get(`${BASE.groups}/v2/users/${id}/groups/roles`)).data || []).map(g => ({
            name: g.group.name, members: g.group.memberCount, role: g.role.name, primary: !!g.isPrimaryAffiliation
        })), []),
        safe(async () => ((await get(`${BASE.badges}/v1/users/${id}/badges?limit=10&sortOrder=Desc`)).data || []).map(b => ({
            name: b.displayName || b.name, date: b.awardedDate
        })), []),
        safe(async () => {
            const d = await get(`${BASE.users}/v1/users/${id}/username-history?limit=50&sortOrder=Desc`)
                .catch(() => get(`${BASE.users}/v1/users/${id}/username-history`))
            return (d.data || []).map(h => h.name)
        }, []),
        safe(async () => {
            const d = await get(`${BASE.account}/v1/users/${id}/roblox-badges`)
            return (Array.isArray(d) ? d : d.data || []).map(b => b.name)
        }, []),
        safe(async () => ((await get(`${BASE.games}/v2/users/${id}/favorite/games?limit=10&sortOrder=Desc`)).data || []).map(g => ({
            name: g.name, visits: g.placeVisits ?? null
        })), []),
        thumb(`/v1/users/avatar?userIds=${id}&size=420x420&format=Png&isCircular=false`),
        thumb(`/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`)
    ])

    const assets = (avatar.assets || []).map(a => ({ name: a.name, type: a.assetType?.name || a.assetType || 'Unknown' }))

    return {
        id, user, social, presence, groups, badges, history, robloxBadges, favs, assets,
        avatar, fullBody, headshot,
        url: `https://www.roblox.com/users/${id}/profile`
    }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const target = String(text || '').trim().split(/\s+/)[0]
    if (!target) return reply(`Masukkan username Roblox.\n\nContoh:\n${prefix}${command} builderman`)

    try {
        await reactTo(sock, m, '⏳')
        const r = await stalkRoblox(target)
        const u = r.user
        const pr = r.presence
        const created = u.created ? new Date(u.created).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'

        const lines = [
            '*🎮 ROBLOX STALK*', '',
            `👤 Username : ${u.name}${u.hasVerifiedBadge ? ' ✔️' : ''}`,
            `📛 Display : ${u.displayName}`,
            `🆔 User ID : ${u.id}`,
            `📅 Dibuat : ${created}`,
            `🚫 Banned : ${u.isBanned ? 'Ya' : 'Tidak'}`,
            pr ? `🟢 Status : ${PRESENCE[pr.userPresenceType] ?? '-'}${pr.lastLocation ? ` (${pr.lastLocation})` : ''}` : '',
            '',
            `👥 Teman : ${fmt(r.social.friends)}`,
            `⭐ Followers : ${fmt(r.social.followers)}`,
            `➡️ Following : ${fmt(r.social.followings)}`
        ]

        if (u.description) lines.push('', `📝 Bio : ${clip(u.description.replace(/\s+/g, ' ').trim(), 250)}`)
        if (r.history.length) lines.push('', `🕘 Username lama : ${clip(r.history.slice(0, 8).join(', '), 200)}`)
        if (r.robloxBadges.length) lines.push(`🏅 Badge Roblox : ${r.robloxBadges.join(', ')}`)

        if (r.groups.length) {
            lines.push('', `🏰 *Grup (${r.groups.length})*`)
            r.groups.slice(0, 5).forEach(g => lines.push(`• ${clip(g.name, 35)} — ${g.role}${g.primary ? ' ⭐' : ''}`))
            if (r.groups.length > 5) lines.push(`  …dan ${r.groups.length - 5} grup lain`)
        }

        if (r.badges.length) {
            lines.push('', '🎖️ *Badge Terbaru*')
            r.badges.slice(0, 5).forEach(b => lines.push(`• ${clip(b.name, 40)}`))
        }

        if (r.favs.length) {
            lines.push('', '❤️ *Game Favorit*')
            r.favs.slice(0, 5).forEach(g => lines.push(`• ${clip(g.name, 40)}${g.visits != null ? ` (${fmt(g.visits)} visit)` : ''}`))
        }

        if (r.assets.length) {
            lines.push('', `👕 *Avatar (${r.assets.length} item)*`)
            r.assets.slice(0, 8).forEach(a => lines.push(`• ${clip(a.name, 35)} _(${a.type})_`))
            if (r.assets.length > 8) lines.push(`  …dan ${r.assets.length - 8} item lain`)
        }

        lines.push('', `🔗 ${r.url}`)
        const caption = lines.filter(l => l !== undefined && l !== null && l !== false).join('\n').replace(/\n{3,}/g, '\n\n')

        const photo = r.fullBody || r.headshot
        if (photo) {
            try {
                const short = caption.length <= 1000
                await sock.sendMessage(m.chat, { image: { url: photo }, ...(short ? { caption } : {}) }, { quoted: m })
                if (!short) await reply(clip(caption, 3800))
            } catch { await reply(caption) }
        } else await reply(caption)

        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        const msg = e.response?.status ? `HTTP ${e.response.status}` : (e.message || 'Gagal mengambil profil Roblox.')
        reply(`❌ ${msg}`)
    }
}

handler.command = ['robloxstalk']
handler.help = ['robloxstalk <username>']
handler.tags = ['stalker']
handler.limit = true

export default handler
