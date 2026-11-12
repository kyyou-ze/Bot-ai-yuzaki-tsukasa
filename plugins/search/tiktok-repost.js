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
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { reactTo } from '../../lib/core/file.js'

const execFileP = promisify(execFile)
const BASE = 'https://petdii.com'
const PER = 6, MAX_PAGES = 5
const LINE = '─────────────────────'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

// Pakai curl (async) — server petdii menolak axios/fetch Node dengan HTTP 403, tapi menerima curl.
async function postJson(url, body) {
    const args = ['-s', '-L', '--max-time', '30', '-X', 'POST', url,
        '-H', 'accept: application/json, text/plain, */*',
        '-H', 'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        '-H', 'cache-control: no-cache', '-H', 'content-type: application/json', '-H', 'pragma: no-cache',
        '-H', `referer: ${BASE}/tiktok-repost-viewer`, '-H', `user-agent: ${UA}`,
        '-d', JSON.stringify(body)]
    try {
        const { stdout } = await execFileP('curl', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 35000 })
        return stdout
    } catch (e) {
        if (e.code !== 'ENOENT') throw new Error(`curl gagal: ${e.message.split('\n')[0]}`)
        // curl tidak terpasang → coba axios (mungkin kena 403)
        const r = await axios.post(url, body, { timeout: 30000, validateStatus: () => true, responseType: 'text', transformResponse: x => x, headers: { 'content-type': 'application/json', referer: `${BASE}/tiktok-repost-viewer`, 'user-agent': UA } })
        return String(r.data || '')
    }
}

async function fetchPage(username, count = PER, cursor = 0) {
    const raw = await postJson(`${BASE}/api/tiktok/get-reposts`, { unique_id: username, count, cursor })
    let d
    try { d = JSON.parse(raw) } catch {
        const hint = /cloudflare|just a moment|attention required/i.test(raw) ? ' (diblokir Cloudflare)' : ''
        throw new Error(`Respons server tidak valid${hint}${raw ? ': ' + raw.replace(/\s+/g, ' ').slice(0, 120) : ' (kosong)'}`)
    }
    if (d.code !== 0) throw new Error(d.msg || 'Gagal ambil data repost.')
    const { videos = [], cursor: next, hasMore } = d.data || {}
    return { cursor: next, hasMore: !!hasMore, videos: videos.map(mapVideo) }
}

const mapVideo = (v) => ({
    id: v.video_id, aweme: v.aweme_id, title: v.title || '', region: v.region, duration: v.duration, cover: v.cover,
    play: v.play, playWm: v.wmplay, size: v.size, created: v.create_time ? new Date(v.create_time * 1000) : null,
    stats: { plays: v.play_count, likes: v.digg_count, comments: v.comment_count, shares: v.share_count, downloads: v.download_count, saves: v.collect_count },
    author: { username: v.author?.unique_id, name: v.author?.nickname },
    music: v.music_info ? { title: v.music_info.title, artist: v.music_info.author } : null
})

async function fetchUntil(username, need, maxPages = MAX_PAGES) {
    let cursor = 0, hasMore = true, pages = 0, all = []
    while (hasMore && pages < maxPages && all.length < need) {
        const r = await fetchPage(username, PER, cursor)
        all = all.concat(r.videos); cursor = r.cursor; hasMore = r.hasMore; pages++
        if (!r.videos.length) break
    }
    return { videos: all, hasMore }
}

const nf = (n) => Number(n || 0).toLocaleString('id-ID')
const mb = (b) => b ? (b / 1048576).toFixed(1) + ' MB' : '-'
const clip = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t }

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean)
    const username = (parts[0] || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '').split(/[/?]/)[0]
    if (!username) return reply(`*🔁 TIKTOK REPOST*\n${LINE}\n${prefix}${command} <username>\n${prefix}${command} <username> semua\n${prefix}${command} <username> <nomor>\n\nContoh: *${prefix}${command} dimeh493*`)

    const arg = (parts[1] || '').toLowerCase()
    try {
        await reactTo(sock, m, '⏳')
        const n = parseInt(arg, 10)

        if (n > 0) {
            if (n > PER * MAX_PAGES) throw new Error(`Maksimal nomor ${PER * MAX_PAGES}.`)
            const { videos } = await fetchUntil(username, n)
            const v = videos[n - 1]
            if (!v) throw new Error(`Repost ke-${n} tidak ditemukan (hanya ada ${videos.length}).`)
            const cap = `*🔁 Repost @${username}* #${n}\n${LINE}\n${clip(v.title, 200) || '-'}\n\nPembuat : @${v.author.username || '-'} (${v.author.name || '-'})\nDurasi  : ${v.duration || '?'} detik • ${mb(v.size)}\n▶️ ${nf(v.stats.plays)} • ❤️ ${nf(v.stats.likes)} • 💬 ${nf(v.stats.comments)} • 🔗 ${nf(v.stats.shares)}${v.music ? `\n🎵 ${v.music.title} — ${v.music.artist}` : ''}`
            try {
                const r = await axios.get(v.play, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 80 * 1024 * 1024, headers: { 'User-Agent': UA } })
                await sock.sendMessage(m.chat, { video: Buffer.from(r.data), caption: cap }, { quoted: m })
            } catch {
                await sock.sendMessage(m.chat, { video: { url: v.play }, caption: cap }, { quoted: m })
            }
        } else {
            const all = arg === 'semua' || arg === 'all'
            const { videos, hasMore } = all ? await fetchUntil(username, PER * MAX_PAGES) : await fetchUntil(username, 1, 1)
            if (!videos.length) throw new Error(`Tidak ada repost untuk @${username} (akun privat / tidak ada repost / username salah).`)
            const lines = videos.map((v, i) => `${i + 1}. ${clip(v.title, 70) || '(tanpa judul)'}\n   @${v.author.username || '-'} • ${v.duration || '?'}s • ▶️ ${nf(v.stats.plays)} • ❤️ ${nf(v.stats.likes)}`)
            await reply(`*🔁 REPOST @${username}* (${videos.length}${hasMore ? '+' : ''})\n${LINE}\n${lines.join('\n\n')}\n\nUnduh: *${prefix}${command} ${username} <nomor>*${!all && hasMore ? `\nLebih banyak: *${prefix}${command} ${username} semua*` : ''}`)
        }
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal memproses.'}`)
    }
}

handler.command = ['tiktok-repost']
handler.help = ['ttrepost <username> [semua|nomor]']
handler.tags = ['search']
handler.limit = true

export default handler
export { fetchPage as ttFetchRepost }
