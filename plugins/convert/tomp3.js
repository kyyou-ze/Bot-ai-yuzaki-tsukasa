import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { isType, mediaNode } from '../../lib/core/system.js'

const MEDIA_TYPES = ['videoMessage', 'audioMessage', 'documentMessage']
const MAX_SIZE = 100 * 1024 * 1024 // 100 MB

// Pakai file sementara (bukan pipe) supaya mp4 dengan moov di akhir tetap bisa dibaca
function convertToMp3(input, output) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-y',
            '-v', 'error',
            '-i', input,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            '-ac', '2',
            '-ar', '44100',
            output
        ])

        let err = ''

        ff.stderr.on('data', d => {
            err += d
        })

        ff.on('error', reject)

        ff.on('close', code => {
            if (code === 0 && fs.existsSync(output) && fs.statSync(output).size) {
                resolve()
            } else {
                reject(new Error(err.trim() || `ffmpeg exit ${code}`))
            }
        })
    })
}

let handler = async (m, { sock, jid, reply, example }) => {
    const type = MEDIA_TYPES.find(t => isType(m, t))

    if (!type) {
        return example('(kirim/reply video yang mau dijadikan mp3)')
    }

    const media = mediaNode(m, type)
    const loading = await reply('Sedang mengonversi ke mp3...')

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const inFile = path.join(os.tmpdir(), `tomp3-${id}.input`)
    const outFile = path.join(os.tmpdir(), `tomp3-${id}.mp3`)

    try {
        const buffer = await media.download()

        if (!buffer?.length) {
            throw new Error('Gagal mengunduh media.')
        }

        if (buffer.length > MAX_SIZE) {
            throw new Error('Ukuran file terlalu besar (maks 100 MB).')
        }

        fs.writeFileSync(inFile, buffer)

        await convertToMp3(inFile, outFile)

        await sock.sendMessage(
            jid,
            {
                audio: fs.readFileSync(outFile),
                mimetype: 'audio/mpeg',
                ptt: false
            },
            { quoted: m }
        )

        await sock.sendMessage(jid, { text: 'Berhasil dikonversi ke mp3.', edit: loading.key })
    } catch (e) {
        console.error('[TOMP3]', e)

        await sock.sendMessage(jid, { text: `Gagal: ${e.message}`, edit: loading.key })
    } finally {
        for (const f of [inFile, outFile]) {
            try {
                fs.unlinkSync(f)
            } catch {}
        }
    }
}

handler.command = ['tomp3']
handler.tags = ['convert']

export default handler
