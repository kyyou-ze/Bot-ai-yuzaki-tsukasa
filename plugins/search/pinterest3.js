/*
- HARGAI WOY JANGAN DIHAPUS!
- Skrep by *JH a.k.a DHIKA - FIONY BOT*
- Credits to all Fiony's Bot Admin.
*/
// .pin3 <kata kunci>            → cari gambar Pinterest (default 10 gambar)
// .pin3 <kata kunci> <1-18>     → tentukan jumlah gambar (jumlah di akhir, maks 18)
// .pin3 <link pinterest/pin.it> → download video / gambar dari link
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
    const base = (global.termai?.url || 'https://api.termai.cc').replace(/\/+$/, '')
    const key = process.env.TERMAI_KEY || global.termai?.key || ''
    if (!key) throw new Error('API key Termai belum diisi di config.js (global.termai.key).')
    const { data } = await axios.get(`${base}/api/search/pinterest-image`, {
        params: { query, key },
        timeout: 20000
    })
    const images = (data?.data || []).slice(0, limit)
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

const react = (sock, m, text) => sock.sendMessage(m.chat, { react: { text, key: m.key } }).catch(() => null)

let handler = async (m, { sock, text, prefix, reply }) => {
    const input = String(text || '').trim()
    if (!input) {
        return reply(
            `*▢ PINTEREST*\n\n` +
            `${prefix}pin3 kaguya shinomiya       → cari 10 gambar\n` +
            `${prefix}pin3 kaguya shinomiya 18    → cari 18 gambar (maks 18)\n` +
            `${prefix}pin3 https://pin.it/xxx → download video/gambar dari link`
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
        const numMatch = input.match(/^(.+?)\s+(\d+)$/)
        const query = numMatch ? numMatch[1].trim() : input
        const limit = Math.min(18, Math.max(1, numMatch ? parseInt(numMatch[2], 10) : 10))
        const images = await searchPinterest(query, limit)

        // unduh dulu, supaya jumlah album pas dengan gambar yang berhasil diambil
        const mediaList = []
        for (const url of images) {
            try {
                const res = await axios.get(url, { responseType: 'arraybuffer', headers: baseHeaders, timeout: 30000 })
                mediaList.push({ image: Buffer.from(res.data) })
            } catch {}
        }
        if (!mediaList.length) throw new Error('Gagal mengirim gambar.')
        mediaList[0].caption = `*▢ PINTEREST: ${query}*\n_${mediaList.length} gambar_`

        const opener = generateWAMessageFromContent(
            m.chat,
            {
                messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                albumMessage: {
                    expectedImageCount: mediaList.length,
                    expectedVideoCount: 0
                }
            },
            {
                userJid: jidNormalizedUser(sock.user.id),
                quoted: m,
                upload: sock.waUploadToServer
            }
        )

        await sock.relayMessage(opener.key.remoteJid, opener.message, {
            messageId: opener.key.id
        })

        for (const content of mediaList) {
            const msg = await generateWAMessage(
                opener.key.remoteJid,
                content,
                { upload: sock.waUploadToServer }
            )

            msg.message.messageContextInfo = {
                messageSecret: crypto.randomBytes(32),
                messageAssociation: {
                    associationType: 1,
                    parentMessageKey: opener.key
                }
            }

            await sock.relayMessage(msg.key.remoteJid, msg.message, {
                messageId: msg.key.id
            })
        }
        return react(sock, m, '✅')
    } catch (e) {
        await react(sock, m, '❌')
        return reply(`❌ ${e.response?.data?.message || e.message}`)
    }
}

handler.command = ['pinterest3', 'pin3']
handler.help = ['pinterest3']
handler.tags = ['search']
handler.limit = true

export default handler
