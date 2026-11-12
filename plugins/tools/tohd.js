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
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const react = (sock, m, text) => sock.sendMessage(m.chat, { react: { text, key: m.key } }).catch(() => null)

let handler = async (m, { sock, reply, example }) => {
    if (!m.quoted) return example('dengan reply video atau dokumen (foto/video)')

    const q = m.quoted
    const isVideo = q.mtype === 'videoMessage'

    if (q.mtype !== 'documentMessage' && !isVideo) {
        return reply(' Reply video, atau file foto/video yang dikirim dalam bentuk *Dokumen*!')
    }

    const mime = (q.msg || q).mimetype || (isVideo ? 'video/mp4' : '')

    if (!mime.includes('image') && !mime.includes('video')) {
        return reply(' Dokumen yang direply bukan format foto atau video!')
    }

    await react(sock, m, '⏳')
    reply(global.mess.wait)

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tempIn = path.join(os.tmpdir(), `swhd_in_${id}.mp4`)
    const tempOut = path.join(os.tmpdir(), `swhd_out_${id}.mp4`)

    try {
        const buffer = await q.download()
        if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Gagal mengunduh dokumen')

        if (mime.includes('image')) {
            await sock.sendMessage(m.chat, {
                image: buffer,
                caption: `乂  *SW HD*\n\nSiap di-forward ke status WhatsApp!`
            }, { quoted: m })
        } else {
            fs.writeFileSync(tempIn, buffer)

            await execFileAsync('ffmpeg', [
                '-y', '-i', tempIn,
                '-c:v', 'libx264', '-crf', '20', '-preset', 'slow',
                '-c:a', 'aac', '-b:a', '128k',
                '-vf', "scale='min(720,iw)':-2",
                '-pix_fmt', 'yuv420p',
                tempOut
            ])

            await sock.sendMessage(m.chat, {
                video: fs.readFileSync(tempOut),
                caption: `乂  *Proses di selesaikan*`
            }, { quoted: m })
        }

        await react(sock, m, '')
    } catch (e) {
        console.error('[SWHD ERROR]', e)
        await react(sock, m, '')
        reply(' Terjadi kesalahan saat memproses dokumen.')
    } finally {
        for (const f of [tempIn, tempOut]) fs.promises.unlink(f).catch(() => null)
    }
}

handler.command = ['tohd']
handler.help = ['tohd <reply video / dokumen foto/video>']
handler.tags = ['tools']
handler.register = true

export default handler