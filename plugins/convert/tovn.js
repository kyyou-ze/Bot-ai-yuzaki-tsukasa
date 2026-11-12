import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const fs = (__m => __m.default ?? __m)((await import('node:fs')))
  const path = (__m => __m.default ?? __m)((await import('node:path')))
  const os = (__m => __m.default ?? __m)((await import('node:os')))
  const crypto = (__m => __m.default ?? __m)((await import('node:crypto')))
  const { spawn } = (await import('node:child_process'))

  async function convertAudioToVn(audioBuffer) {
    const tmpIn = path.join(os.tmpdir(), `tovn_in_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.tmp`)
    const tmpOut = path.join(os.tmpdir(), `tovn_out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.opus`)

    await fs.promises.writeFile(tmpIn, audioBuffer)

    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', tmpIn,
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-vbr', 'on',
        '-compression_level', '10',
        tmpOut
      ], { stdio: ['ignore', 'ignore', 'ignore'] })

      ff.on('close', async () => {
        try {
          if (fs.existsSync(tmpIn)) await fs.promises.unlink(tmpIn).catch(() => {})
          if (fs.existsSync(tmpOut)) {
            const res = await fs.promises.readFile(tmpOut)
            await fs.promises.unlink(tmpOut).catch(() => {})
            resolve(res)
          } else {
            reject(new Error('Failed to convert audio to vn'))
          }
        } catch (err) {
          reject(err)
        }
      })

      ff.on('error', async (err) => {
        if (fs.existsSync(tmpIn)) await fs.promises.unlink(tmpIn).catch(() => {})
        if (fs.existsSync(tmpOut)) await fs.promises.unlink(tmpOut).catch(() => {})
        reject(err)
      })
    })
  }

  let handler = async (m, { sock, conn, usedPrefix, command }) => {
    const client = conn || sock
    const quoted = m.quoted || m
    const mime = quoted.mimetype || m.mimetype || ''

    if (!mime || (!/audio/i.test(mime) && !/video/i.test(mime))) {
      return m.reply(`Kirim atau balas (reply) audio/video dengan command:\n${usedPrefix}${command}`)
    }

    let buffer
    try {
      buffer = typeof quoted.download === 'function' ? await quoted.download() : await m.download()
    } catch (e) {
      return m.reply(`Gagal mengunduh audio: ${e.message || e}`)
    }

    if (!buffer || !Buffer.isBuffer(buffer)) {
      return m.reply('Buffer audio tidak valid.')
    }

    try {
      const vnBuffer = await convertAudioToVn(buffer)
      return await client.sendMessage(
        m.chat,
        {
          audio: vnBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: m.raw }
      )
    } catch (e) {
      return m.reply(`Gagal mengonversi ke Voice Note:\n${e.message || e}`)
    }
  }

  handler.command = ['tovn']
  handler.owner = false
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("convert/tovn", feature)

let handler = (m, ctx) => rbRun("convert/tovn", m, ctx)

handler.command = ['tovn']
handler.tags = ['convert']

export default handler
