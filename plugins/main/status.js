/**

* Kaguya Multi Device — WhatsApp & Tele Bot
*
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
*
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

import { countCommands } from '../../lib/engine/plugins.js'
import { runtime, formatBytes, percentOf, usageBar, antiban } from '../../lib/core/system.js'

const HOUR = 3_600_000
const MAX_SAMPLES = 6000

// data disimpan di global supaya tidak hilang saat plugin di-hot-reload
const S = (global.__botStatus ??= {
    since: Date.now(),
    total: 0,
    light: 0,
    failed: 0,
    samples: [],      // { t, jid, ms }
    lastError: null,
    reconnects: 0
})

function record(jid, ms, ok, light) {
    if (!ok) {
        S.failed++
        return
    }
    if (light) {
        S.light++
        return
    }
    S.total++
    S.samples.push({ t: Date.now(), jid, ms })
    if (S.samples.length > MAX_SAMPLES) S.samples.splice(0, S.samples.length - MAX_SAMPLES)
}

function isLight(sock, jid, content) {
    let self = ''
    try { self = sock.decodeJid(sock.user?.id) } catch {}
    return jid === self || jid === 'status@broadcast' || !!(content && (content.edit || content.delete || content.react))
}

function install(sock) {
    if (!sock || sock.__statusWrapped || typeof sock.sendMessage !== 'function') return
    sock.__statusWrapped = true
    S.reconnects++
    const orig = sock.sendMessage
    sock.sendMessage = async function (jid, content, options) {
        const t0 = Date.now()
        const light = isLight(sock, jid, content)
        try {
            const res = await orig.call(this, jid, content, options)
            record(jid, Date.now() - t0, true, light)
            return res
        } catch (e) {
            S.lastError = { t: Date.now(), msg: String(e?.message || e).slice(0, 80) }
            record(jid, Date.now() - t0, false, light)
            throw e
        }
    }
}

// pantau global.sock: setiap ada socket baru (reconnect), pasang penghitung lagi
if (global.__botStatusTimer) clearInterval(global.__botStatusTimer)
global.__botStatusTimer = setInterval(() => {
    try { install(global.sock) } catch {}
}, 3000)
global.__botStatusTimer.unref?.()
try { install(global.sock) } catch {}

// ───────── helper tampilan ─────────

const ago = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return `${s} dtk lalu`
    if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`
    return `${Math.floor(s / 3600)} jam lalu`
}

const countSince = (ms, now) => {
    let n = 0
    for (let i = S.samples.length - 1; i >= 0; i--) {
        if (now - S.samples[i].t > ms) break
        n++
    }
    return n
}

function statusText(sock) {
    const now = Date.now()
    // buang data lebih tua dari 1 jam
    while (S.samples.length && now - S.samples[0].t > HOUR) S.samples.shift()

    const ab = antiban()
    const m1 = countSince(60_000, now)
    const m5 = countSince(300_000, now)
    const m60 = S.samples.length

    // chat yang dikirimi dalam 1 menit terakhir
    const perChat = new Map()
    for (let i = S.samples.length - 1; i >= 0; i--) {
        const x = S.samples[i]
        if (now - x.t > 60_000) break
        perChat.set(x.jid, (perChat.get(x.jid) || 0) + 1)
    }
    const busiest = Math.max(0, ...perChat.values())

    // rata-rata waktu kirim (termasuk jeda antrean) dari 20 pesan terakhir
    const last = S.samples.slice(-20)
    const avgMs = last.length ? Math.round(last.reduce((a, b) => a + b.ms, 0) / last.length) : 0
    const lastSent = S.samples.length ? ago(now - S.samples[S.samples.length - 1].t) : '-'

    const limitPct = percentOf(m1, ab.perMinute)
    const chatPct = percentOf(busiest, ab.perChatPerMinute)
    const level = Math.max(limitPct, chatPct)
    const risk = level >= 90 ? '🔴 Hampir kena batas' : level >= 60 ? '🟡 Cukup ramai' : '🟢 Aman'

    const mem = process.memoryUsage()
    const heapPct = percentOf(mem.heapUsed, mem.heapTotal)

    let commands = 0
    try { commands = countCommands() } catch {}

    const platforms = Object.entries(global.platforms || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '-'
    const connected = !!sock?.user?.id
    const number = connected ? String(sock.decodeJid(sock.user.id)).split('@')[0] : '-'
    const mode = `WA ${global.isPublic?.('whatsapp') ? 'Public' : 'Self'} | TG ${global.isPublic?.('telegram') ? 'Public' : 'Self'}`

    let out =
        `╭━━━〔 *STATUS BOT* 〕━━━⬣\n` +
        `┃ ✦ Kondisi : ${risk}\n` +
        `╰━━━━━━━━━━━━━━━━⬣\n\n` +
        `╭─▣「 *KONEKSI* 」▣─╮\n` +
        `│ ✦ Status : ${connected ? 'Terhubung' : 'Terputus'}\n` +
        `│ ✦ Nomor : ${number}\n` +
        `│ ✦ Mode : ${mode}\n` +
        `│ ✦ Platform : ${platforms}\n` +
        `│ ✦ Uptime : ${runtime(process.uptime())}\n` +
        `│ ✦ Sambung ulang : ${Math.max(0, S.reconnects - 1)}x\n` +
        `╰─➤\n\n` +
        `╭─▣「 *PESAN KELUAR* 」▣─╮\n` +
        `│ ✦ 1 menit : ${m1} / ${ab.perMinute}\n` +
        `│   ${usageBar(limitPct)}\n` +
        `│ ✦ Chat tersibuk : ${busiest} / ${ab.perChatPerMinute} per menit\n` +
        `│   ${usageBar(chatPct)}\n` +
        `│ ✦ 5 menit : ${m5}\n` +
        `│ ✦ 1 jam : ${m60}\n` +
        `│ ✦ Total sejak start : ${S.total}\n` +
        `│ ✦ Pesan ringan : ${S.light}\n` +
        `│ ✦ Gagal kirim : ${S.failed}\n` +
        `│ ✦ Terakhir kirim : ${lastSent}\n` +
        `│ ✦ Rata-rata kirim : ${avgMs} ms\n` +
        `╰─➤\n\n` +
        `╭─▣「 *ANTI-BAN* 」▣─╮\n` +
        `│ ✦ Jeda antar pesan : ${ab.minDelayMs}-${ab.maxDelayMs} ms\n` +
        `│ ✦ Batas total : ${ab.perMinute} / menit\n` +
        `│ ✦ Batas per chat : ${ab.perChatPerMinute} / menit\n` +
        `╰─➤\n\n` +
        `╭─▣「 *RESOURCE* 」▣─╮\n` +
        `│ ✦ RAM proses : ${formatBytes(mem.rss)}\n` +
        `│ ✦ Heap : ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}\n` +
        `│   ${usageBar(heapPct)}\n` +
        `│ ✦ Command aktif : ${commands}\n` +
        `╰─➤`

    if (S.lastError) out += `\n\n⚠️ Error kirim terakhir (${ago(now - S.lastError.t)}):\n${S.lastError.msg}`
    if (level >= 90) out += `\n\n_Trafik keluar mendekati batas. Kurangi command beruntun atau naikkan jeda di global.antiban._`
    return out
}

let handler = async (m, { sock, reply }) => {
    try {
        install(sock)
        await reply(statusText(sock))
    } catch (e) {
        await reply(`❌ Gagal membaca status: ${e.message}`)
    }
}

handler.command = ['status']
handler.hide = ['botstatus']
handler.help = ['status']
handler.tags = ['main']
handler.owner = true

export default handler
