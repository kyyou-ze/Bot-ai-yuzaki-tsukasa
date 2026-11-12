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
import crypto from 'crypto'
import { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } from '@whiskeysockets/baileys'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const baseHeaders = {
    'user-agent': UA,
    'accept-language': 'en-US,en;q=0.9',
    referer: 'https://www.pinterest.com/'
}
const PIN_URL = /^https?:\/\/(?:[a-z0-9-]+\.)?(?:pinterest\.[a-z.]+|pin\.it)\/\S+/i

// ───────── cari gambar ─────────
async function searchPinterest(query, limit) {
    const data = encodeURIComponent(JSON.stringify({ options: { query } }))
    const res = await axios.head(`https://www.pinterest.com/resource/BaseSearchResource/get/?data=${data}`, {
        headers: { ...baseHeaders, 'screen-dpr': '4', 'x-pinterest-pws-handler': 'www/search/[scope].js' },
        validateStatus: () => true,
        timeout: 20000
    })
    const link = res.headers.link || ''
    const re = /<\s*(https:\/\/i\.pinimg\.com\/[^>]+)\s*>\s*;\s*rel=preload;\s*as=image/gi
    const images = [...new Set([...String(link).matchAll(re)].map(v => v[1]))].slice(0, limit)
    if (!images.length) throw new Error('Gambar tidak ditemukan, coba kata kunci lain.')
    return images
}

// ───────── download dari link ─────────
const cleanMediaUrl = (u) => {
    try {
        let cl = String(u).trim()
        const em = cl.match(/^(.+?\.(?:jpg|jpeg|png|webp|mp4|m3u8))/i)
        if (em) cl = em[1]
        cl = cl.replace(/\\u002F/g, '/').replace(/\\u0026/g, '&').replace(/\\\//g, '/')
        const ur = new URL(cl)
        ur.search = ''
        return ur.toString()
    } catch {
        const em = String(u).match(/https:\/\/[a-z0-9.-]*pinimg\.com\/.+?\.(?:jpg|jpeg|png|webp|mp4|m3u8)/i)
        return em ? em[0] : u
    }
}
const hlsToMp4 = (u) => u.endsWith('.m3u8') ? u.replace('/hls/', '/720p/').replace('.m3u8', '.mp4') : u

async function downloadPinterest(inputUrl) {
    const initial = await axios.get(inputUrl, { headers: baseHeaders, maxRedirects: 5, validateStatus: () => true, timeout: 30000 })
    const finalUrl = initial.request?.res?.responseUrl || initial.config?.url || inputUrl
    const pinId = (inputUrl.match(/\/pin\/(\d+)/i) || finalUrl.match(/\/pin\/(\d+)/i) || [])[1]

    // 1) lewat API resmi Pinterest
    if (pinId) {
        const cleanUrl = `https://www.pinterest.com/pin/${pinId}/`
        const api = `https://www.pinterest.com/resource/PinResource/get/?data=${encodeURIComponent(JSON.stringify({
            options: { id: pinId, field_set_key: 'detailed' }
        }))}`
        const apiRes = await axios.get(api, {
            headers: { ...baseHeaders, 'x-pinterest-pws-handler': 'www/pin/[id].js', accept: 'application/json, text/javascript, */*, q=0.01', referer: cleanUrl },
            validateStatus: () => true,
            timeout: 30000
        })
        const pin = apiRes.data?.resource_response?.data
        if (pin) {
            const title = String(pin.title || pin.grid_title || pin.closeup_unified_description || 'Pinterest Media').trim()
            const videoList = pin.videos?.video_list || pin.story_pin_data?.pages?.[0]?.blocks?.[0]?.video?.video_list
            if (videoList) {
                const order = ['V_1080P', 'V_720P', 'V_EXP4', 'V_EXP3', 'V_EXP7', 'V_480P', 'V_HLSV4']
                let key = order.find(q => videoList[q]?.url) || Object.keys(videoList).find(k => videoList[k]?.url)
                if (key) {
                    const u = videoList[key].url
                    return {
                        type: 'video',
                        title,
                        quality: u.endsWith('.m3u8') ? '720p' : key.replace(/^V_/, '').toLowerCase(),
                        url: hlsToMp4(u),
                        source: cleanUrl
                    }
                }
            }
            const img = pin.images || {}
            const best = img.orig?.url || img['736x']?.url || img['564x']?.url || img['474x']?.url
            if (best) return { type: 'image', title, url: best, source: cleanUrl }
        }
    }

    // 2) cadangan: baca langsung dari HTML halaman
    const html = typeof initial.data === 'string' ? initial.data : JSON.stringify(initial.data || '')
    const find = (re) => [...html.matchAll(re)].map(v => cleanMediaUrl(v[0]))

    const videos = [...new Set([
        ...find(/https:\/\/[a-z0-9.-]*pinimg\.com\/videos\/[^"'\\\s<>]+\.mp4/gi),
        ...find(/https:\/\/[a-z0-9.-]*pinimg\.com\/videos\/[^"'\\\s<>]+\.m3u8/gi)
    ])]
    if (videos.length) return { type: 'video', title: 'Pinterest Video', quality: '720p', url: hlsToMp4(videos[0]), source: finalUrl }

    const images = [...new Set([
        ...find(/https:\/\/i\.pinimg\.com\/originals\/[^"'\\\s<>()]+?\.(?:jpg|jpeg|png|webp)/gi),
        ...find(/https:\/\/i\.pinimg\.com\/736x\/[^"'\\\s<>()]+?\.(?:jpg|jpeg|png|webp)/gi)
    ])].filter(u => !/logo|favicon|default|75x75|60x60/i.test(u))
    if (images.length) return { type: 'image', title: 'Pinterest Image', url: images[0], source: finalUrl }

    throw new Error('Media video maupun gambar tidak ditemukan di link itu.')
}

// ───────── kirim hasil pencarian sebagai album (grid) ─────────
async function fetchImages(urls) {
    const got = await Promise.all(urls.map(u =>
        axios.get(u, { headers: baseHeaders, responseType: 'arraybuffer', timeout: 20000 })
            .then(r => Buffer.from(r.data)).catch(() => null)))
    return got.filter(Boolean)
}

async function sendAlbum(sock, jid, buffers, caption) {
    const opener = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret: crypto.randomBytes(32) },
        albumMessage: { expectedImageCount: buffers.length, expectedVideoCount: 0 }
    }, { userJid: jidNormalizedUser(sock.user.id), upload: sock.waUploadToServer })
    await sock.relayMessage(opener.key.remoteJid, opener.message, { messageId: opener.key.id })

    for (const [i, image] of buffers.entries()) {
        const msg = await generateWAMessage(jid, { image, caption: i === 0 ? caption : '' }, { upload: sock.waUploadToServer })
        msg.message.messageContextInfo = {
            messageSecret: crypto.randomBytes(32),
            messageAssociation: { associationType: 1, parentMessageKey: opener.key }
        }
        await sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id })
    }
}

const react = (sock, m, text) => sock.sendMessage(m.chat, { react: { text, key: m.key } }).catch(() => null)

let handler = async (m, { sock, text, prefix, reply }) => {
    const input = String(text || '').trim()
    if (!input) {
        return reply(
            `*▢ PINTEREST*\n\n` +
            `${prefix}pin kaguya shinomiya       → cari 5 gambar\n` +
            `${prefix}pin kaguya shinomiya | 8    → cari 8 gambar (maks 10)\n` +
            `${prefix}pin kaguya shinomiya --8    → sama, pakai format --jumlah\n` +
            `${prefix}pin https://pin.it/xxx → download video/gambar dari link`
        )
    }

    await react(sock, m, '🕒')
    try {
        // ───────── link → download ─────────
        if (PIN_URL.test(input.split(/\s+/)[0])) {
            const r = await downloadPinterest(input.split(/\s+/)[0])
            const caption =
                `*▢ PINTEREST*\n\n` +
                `❀ Judul : ${r.title}\n` +
                `❀ Tipe  : ${r.type === 'video' ? `Video (${r.quality})` : 'Gambar'}\n` +
                `❀ Link  : ${r.source}`
            if (r.type === 'video') {
                await sock.sendMessage(m.chat, { video: { url: r.url }, mimetype: 'video/mp4', caption }, { quoted: m })
            } else {
                await sock.sendMessage(m.chat, { image: { url: r.url }, caption }, { quoted: m })
            }
            return react(sock, m, '✅')
        }

        // ───────── kata kunci → cari ─────────
        let [qRaw, nRaw] = input.split('|').map(s => s.trim())
        const flagN = qRaw.match(/\s*--(\d+)$/)
        if (flagN) { nRaw = nRaw || flagN[1]; qRaw = qRaw.replace(/\s*--\d+$/, '').trim() }
        const query = qRaw
        const limit = Math.min(10, Math.max(1, parseInt(nRaw, 10) || 5))
        const images = await searchPinterest(query, limit)

        // 2+ gambar → kirim sebagai album (grid); kalau gagal, kirim satu-satu seperti biasa
        if (images.length > 1) {
            try {
                const buffers = await fetchImages(images)
                if (buffers.length > 1) {
                    await sendAlbum(sock, m.chat, buffers, `*▢ PINTEREST: ${query}*\n_${buffers.length} gambar_`)
                    return react(sock, m, '✅')
                }
            } catch (e) {
                console.warn('[Pinterest] album gagal, kirim satu-satu:', e.message)
            }
        }

        let sent = 0
        for (const [i, url] of images.entries()) {
            const caption = i === 0 ? `*▢ PINTEREST: ${query}*\n_${images.length} gambar_` : ''
            try {
                await sock.sendMessage(m.chat, { image: { url }, ...(caption && { caption }) }, { quoted: m })
                sent++
            } catch {}
        }
        if (!sent) throw new Error('Gagal mengirim gambar.')
        return react(sock, m, '✅')
    } catch (e) {
        await react(sock, m, '❌')
        return reply(`❌ ${e.response?.data?.message || e.message}`)
    }
}

handler.command = ['pinterest2', 'pin']
handler.help = ['pinterest2']
handler.tags = ['search']
handler.limit = true

export default handler