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

const HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
}

// "ID Zone", "ID(Zone)", "ID|Zone" atau dua argumen
function parseMlInput(rawId, rawZone) {
    if (!rawId) return null
    const str = String(rawId).trim()
    const paren = str.match(/^([0-9]{4,12})\s*[\(\[\{]([0-9]{3,8})[\)\]\}]$/)
    if (paren) return { id: paren[1], zoneId: paren[2] }
    const delim = str.match(/^([0-9]{4,12})[\s\|\/\-_,:;]+([0-9]{3,8})$/)
    if (delim) return { id: delim[1], zoneId: delim[2] }
    if (rawZone) {
        const id = String(rawId).replace(/[^0-9]/g, '')
        const zoneId = String(rawZone).replace(/[^0-9]/g, '')
        if (id && zoneId) return { id, zoneId }
    }
    return null
}

const notFound = (id, zone) => ({ status: false, message: `Akun Mobile Legends ${id} (${zone}) tidak ditemukan atau tidak valid.` })

async function stalkml(input) {
    const parsed = parseMlInput(input)
    if (!parsed) return { status: false, message: 'Format tidak valid. Contoh: 1114917746 13486 atau 1114917746(13486)' }
    const { id, zoneId } = parsed
    const ok = (nickname, country) => ({ status: true, data: { id, zoneId, nickname, country } })

    try {
        const res = await axios.get(`https://mlbb-api.isan.eu.org/find?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(zoneId)}`, { headers: HEADERS, timeout: 5000 })
        if (res.data?.success && res.data?.name) return ok(String(res.data.name).trim(), res.data.countryName || res.data.countryCode || 'Indonesia')
        if (res.data?.success === false && res.data?.message?.toLowerCase().includes('not found')) return notFound(id, zoneId)
    } catch {}

    try {
        const res = await axios.get(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(zoneId)}`, { headers: HEADERS, timeout: 6000 })
        if (res.data?.success && res.data?.name) return ok(String(res.data.name).trim(), res.data.country || 'Indonesia')
        if (res.data?.success === false && res.data?.message?.toLowerCase().includes('not found')) return notFound(id, zoneId)
    } catch {}

    try {
        const res = await axios.post('https://gopay.co.id/games/v1/order/user-account',
            { code: 'MOBILE_LEGENDS', data: { userId: id, zoneId } },
            { headers: { ...HEADERS, 'Content-Type': 'application/json' }, timeout: 6000 })
        const data = res.data?.data
        if (data?.username) return ok(String(data.username).trim(), data.countryOrigin ? String(data.countryOrigin).toUpperCase() : 'ID')
    } catch (err) {
        if (err.response?.status === 404 || err.response?.data?.message?.toLowerCase()?.includes('not recognized')) return notFound(id, zoneId)
    }

    return { status: false, message: `Akun ${id} (${zoneId}) tidak ditemukan atau server sedang sibuk.` }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const input = String(text || m.quoted?.text || '').trim()
    if (!input) return reply(`Masukkan ID dan Zone ID Mobile Legends.\n\nContoh:\n${prefix}${command} 1114917746 13486\n${prefix}${command} 1114917746(13486)`)

    try {
        await reactTo(sock, m, '⏳')
        const res = await stalkml(input)
        if (!res.status) {
            await reactTo(sock, m, '❌')
            return reply(`❌ ${res.message}`)
        }
        const d = res.data
        await reply(`*⚔️ MOBILE LEGENDS STALK*\n\n👤 Nickname : ${d.nickname}\n🆔 User ID : ${d.id}\n🌐 Zone ID : ${d.zoneId}\n🌏 Negara : ${d.country}`)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Terjadi kesalahan.'}`)
    }
}

handler.command = ['mlstalk']
handler.help = ['mlstalk']
handler.tags = ['stalker']
handler.limit = true

export default handler
