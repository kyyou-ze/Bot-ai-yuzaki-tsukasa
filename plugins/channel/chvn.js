/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — kirim audio (reply) ke saluran sebagai voice note bergelombang
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  reply audio + .chvn                              → ke saluran bawaan (.setch)
 *          reply audio + .chvn 120363xxxxxxxxxxxxxx@newsletter
 *          reply audio + .chvn https://whatsapp.com/channel/0029VaXXXX
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { reactTo } from '../../lib/core/file.js'
import { parseRef, metadata, getCurrent, assertCanPost, explain } from './setch.js'

const execFileP = promisify(execFile)
const MAX_SIZE = 20 * 1024 * 1024
const WAVE_BARS = 64

// ───────── ffmpeg: audio apa saja → opus ogg mono 48kHz + waveform 64 bar ─────────
async function convertToOpus(inputBuffer) {
    const id = crypto.randomBytes(6).toString('hex')
    const inFile = path.join(os.tmpdir(), `chvn_in_${id}.bin`)
    const outFile = path.join(os.tmpdir(), `chvn_out_${id}.ogg`)
    try {
        fs.writeFileSync(inFile, inputBuffer)
        await execFileP('ffmpeg', [
            '-y', '-i', inFile, '-vn', '-map_metadata', '-1',
            '-ac', '1', '-ar', '48000',
            '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip',
            '-frame_duration', '60', outFile
        ], { timeout: 120000 })

        const buffer = fs.readFileSync(outFile)
        if (buffer.length < 1000) throw new Error('Hasil convert kosong.')
        return { buffer, ...(await buildWaveform(outFile)) }
    } finally {
        for (const f of [inFile, outFile]) { try { fs.rmSync(f, { force: true }) } catch {} }
    }
}

async function buildWaveform(file) {
    const RATE = 8000
    const { stdout } = await execFileP('ffmpeg', [
        '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', 'pipe:1'
    ], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120000 })

    const total = Math.floor(stdout.length / 2)
    const seconds = Math.max(1, Math.round(total / RATE))
    const waveform = new Uint8Array(WAVE_BARS)
    if (total < WAVE_BARS) return { waveform: waveform.fill(10), seconds }

    const block = Math.floor(total / WAVE_BARS)
    const avg = new Array(WAVE_BARS)
    for (let i = 0; i < WAVE_BARS; i++) {
        let sum = 0
        for (let j = 0; j < block; j++) sum += Math.abs(stdout.readInt16LE((i * block + j) * 2))
        avg[i] = sum / block
    }
    const max = Math.max(...avg)
    if (!max) return { waveform: waveform.fill(5), seconds }
    for (let i = 0; i < WAVE_BARS; i++) waveform[i] = Math.max(4, Math.min(100, Math.round((avg[i] / max) * 100)))
    return { waveform, seconds }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const p = prefix || '.'
    const cmd = command || 'chvn'

    // audio: dari pesan yang di-reply, atau audio yang dikirim langsung bareng command
    const src = (m.quoted?.mtype === 'audioMessage' && m.quoted.download) ? m.quoted
        : (m.mtype === 'audioMessage' && m.download) ? m : null

    if (!src) {
        return reply(
            `📢 *AUDIO KE SALURAN (VN)*\n\n` +
            `Reply audio dengan:\n` +
            `${p}${cmd} → ke saluran bawaan (.setch)\n` +
            `${p}${cmd} <id@newsletter / link saluran>\n\n` +
            `Contoh:\n${p}${cmd} 120363xxxxxxxxxxxxxx@newsletter`
        )
    }

    // ───── tentukan saluran tujuan ─────
    let channelId, channelLabel
    try {
        const raw = String(text || '').trim().split(/\s+/)[0]
        if (raw) {
            const ref = parseRef(raw) || (/^\d{15,}$/.test(raw) ? parseRef(`${raw}@newsletter`) : null)
            if (!ref) return reply('ID/link saluran tidak valid!\nContoh: 120363xxxxxxxxxxxxxx@newsletter')
            if (ref.type === 'jid') { channelId = ref.jid; channelLabel = ref.jid }
            else { const md = await metadata(sock, ref); channelId = md.id; channelLabel = md.name; assertCanPost(md) }
        } else {
            const cur = getCurrent()
            if (!cur) return reply(`Belum ada saluran tujuan. Tulis id/link saluran, atau atur dulu: ${p}setch <link saluran>`)
            channelId = cur.id; channelLabel = cur.name
            assertCanPost(cur)
        }
    } catch (err) {
        return reply(`❌ ${explain(err)}`)
    }

    await reactTo(sock, m, '⏳')

    try {
        const audio = await src.download()
        if (!Buffer.isBuffer(audio) || audio.length < 1000) throw new Error('Gagal mengunduh audio.')
        if (audio.length > MAX_SIZE) throw new Error('File terlalu besar! Maksimal 20MB.')

        const { buffer, waveform, seconds } = await convertToOpus(audio)

        const { prepareWAMessageMedia, generateMessageIDV2, proto } = await import('@whiskeysockets/baileys')
        const prepared = await prepareWAMessageMedia(
            { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true },
            { upload: sock.waUploadToServer, jid: channelId }
        )
        const payload = {
            audioMessage: {
                ...prepared.audioMessage,
                ptt: true,
                seconds,
                mimetype: 'audio/ogg; codecs=opus',
                waveform
            }
        }
        await sock.query({
            tag: 'message',
            attrs: { to: channelId, id: generateMessageIDV2(sock.user?.id), type: 'media' },
            content: [{ tag: 'plaintext', attrs: { mediatype: 'audio' }, content: proto.Message.encode(payload).finish() }]
        })

        await reactTo(sock, m, '✅')
        return reply(`✅ VN (${seconds}s) terkirim ke saluran *${channelLabel}*.`)
    } catch (err) {
        console.error('[CHVN ERROR]', err)
        await reactTo(sock, m, '❌')
        const msg = /ffmpeg/i.test(err.message) && /ENOENT|not found/i.test(err.message)
            ? 'FFmpeg belum terpasang di server.'
            : err.message || err
        return reply(`❌ Gagal kirim VN ke saluran.\n\n> ${msg}`)
    }
}

handler.command = ['chvn']
handler.help = ['chvn <id/link saluran> (reply audio)']
handler.tags = ['channel']

export default handler
