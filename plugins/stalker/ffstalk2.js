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

const ADENPEDIA_BASE = 'https://adenpedia.my.id/update01'

const SERVERS = { ID: 'Indonesia', BR: 'Brazil', US: 'United States', SAC: 'South America', EU: 'Europe', RU: 'Russia', IND: 'India', VN: 'Vietnam', TH: 'Thailand', TW: 'Taiwan', ME: 'Middle East', PK: 'Pakistan', BD: 'Bangladesh', SG: 'Singapore', NA: 'North America' }
const getServerName = (region) => SERVERS[(region || '').toUpperCase()] || region || 'Global'

function getBrRankingInfo(points) {
    const p = Number(points) || 0
    const tiers = [[1000, 'Bronze I'], [1100, 'Bronze II'], [1200, 'Bronze III'], [1300, 'Silver I'], [1400, 'Silver II'], [1500, 'Silver III'], [1600, 'Gold I'], [1725, 'Gold II'], [1850, 'Gold III'], [1975, 'Gold IV'], [2100, 'Platinum I'], [2225, 'Platinum II'], [2350, 'Platinum III'], [2475, 'Platinum IV'], [2600, 'Diamond I'], [2750, 'Diamond II'], [2900, 'Diamond III'], [3050, 'Diamond IV'], [3200, 'Heroic']]
    for (const [limit, name] of tiers) if (p < limit) return name
    return 'Grandmaster'
}

const CS_RANKS = { 1: 'Bronze I', 2: 'Bronze II', 3: 'Bronze III', 4: 'Silver I', 5: 'Silver II', 6: 'Silver III', 7: 'Gold I', 8: 'Gold II', 9: 'Gold III', 10: 'Gold IV', 11: 'Platinum I', 12: 'Platinum II', 13: 'Platinum III', 14: 'Platinum IV', 15: 'Diamond I', 16: 'Diamond II', 17: 'Diamond III', 18: 'Diamond IV', 21: 'Heroic', 22: 'Master', 23: 'Grandmaster' }

function estimatePrice(basic) {
    let val = 15000
    val += (Number(basic.level) || 1) * 3500
    val += (Number(basic.liked) || 0) * 15
    val += (Number(basic.badgeCnt) || 0) * 250
    if (basic.hasElitePass) val += 50000
    return Math.min(Math.max(val, 25000), 50000000)
}

const fmtTime = (s) => s ? new Date(Number(s) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'

async function stalkFF(uid) {
    const cleanUid = String(uid).trim().replace(/[^0-9]/g, '')
    if (!cleanUid) throw new Error('UID Free Fire harus berupa angka valid')

    const response = await fetch(`${ADENPEDIA_BASE}/info.php?uid=${encodeURIComponent(cleanUid)}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) throw new Error(`Gagal mengambil data akun (HTTP ${response.status})`)

    const raw = await response.json().catch(() => null)
    if (!raw?.basicInfo?.accountId) throw new Error('Akun Free Fire tidak ditemukan atau UID salah')

    return {
        basic: raw.basicInfo,
        clan: raw.clanBasicInfo || {},
        pet: raw.petInfo || {},
        social: raw.socialInfo || {},
        credit: raw.creditScoreInfo || {},
        captain: raw.captainBasicInfo || {}
    }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const uid = String(text || m.quoted?.text || '').replace(/[^0-9]/g, '')
    if (!uid) return reply(`Masukkan UID Free Fire.\n\nContoh:\n${prefix}${command} 123456789`)

    try {
        await reactTo(sock, m, '⏳')
        const { basic, clan, pet, social, credit, captain } = await stalkFF(uid)

        const lines = [
            '*🔥 FREE FIRE STALK*',
            '',
            `👤 Nickname : ${basic.nickname || '-'}`,
            `🆔 UID : ${basic.accountId}`,
            `🌏 Server : ${getServerName(basic.region)}`,
            `📈 Level : ${basic.level || 0} (EXP ${basic.exp || 0})`,
            `❤️ Like : ${basic.liked || 0}`,
            `🛡️ Credit score : ${credit.creditScore ?? basic.creditScore ?? 100}`,
            `🎖️ Badge : ${basic.badgeCnt || 0}`,
            `🎫 Elite Pass : ${basic.hasElitePass ? 'Ya' : 'Tidak'}`,
            `📅 Dibuat : ${fmtTime(basic.createAt)}`,
            `🕒 Login terakhir : ${fmtTime(basic.lastLoginAt)}`
        ]
        const bio = social.signature || basic.signature
        if (bio) lines.push(`📝 Bio : ${bio}`)

        lines.push('', '*🏆 RANK*',
            `BR : ${getBrRankingInfo(basic.rankingPoints)} (${basic.rankingPoints || 0} poin)`,
            `CS : ${CS_RANKS[Number(basic.csRank) || 0] || 'Unranked'} (${basic.csRankingPoints || 0} bintang)`)

        if (clan.clanId) {
            lines.push('', '*👥 GUILD*',
                `Nama : ${clan.clanName || '-'}`,
                `ID : ${clan.clanId}`,
                `Level : ${clan.clanLevel || 1}`,
                `Member : ${clan.memberNum || 0}/${clan.capacity || 0}`,
                `Leader : ${captain.nickname || '-'} (Lv ${captain.level || 0})`)
        }
        if (pet.id) lines.push('', '*🐾 PET*', `${pet.name || '-'} (Lv ${pet.level || 1}, EXP ${pet.exp || 0})`)

        lines.push('', `💰 Perkiraan nilai akun (kasar) : Rp ${estimatePrice(basic).toLocaleString('id-ID')}`)

        await reply(lines.join('\n'))
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal mengambil data akun.'}`)
    }
}

handler.command = ['ffstalk2']
handler.help = ['ffstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
