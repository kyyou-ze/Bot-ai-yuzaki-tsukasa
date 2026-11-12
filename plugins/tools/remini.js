import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// .hdvideo  (reply / kirim video)
// Perbesar & perjelas video memakai ffmpeg: upscale lanczos + denoise + sharpen + koreksi warna.
// Catatan: ini filter ffmpeg biasa, bukan AI. Hasilnya lebih tajam & besar, tapi detail yang
// tidak ada di video asli tidak akan muncul. Butuh ffmpeg & ffprobe terpasang di server.

const feature = async () => {
  const fs = (__m => __m.default ?? __m)((await import('node:fs')))
  const path = (__m => __m.default ?? __m)((await import('node:path')))
  const os = (__m => __m.default ?? __m)((await import('node:os')))
  const crypto = (__m => __m.default ?? __m)((await import('node:crypto')))
  const { execFile } = (await import('node:child_process'))
  const { promisify } = (await import('node:util'))

  const execFileAsync = promisify(execFile)

  const MAX_BYTES = 50 * 1024 * 1024      // ukuran video maksimal
  const MAX_SECONDS = 60                  // durasi maksimal (beban CPU)
  const MAX_LONG_SIDE = 1920              // sisi terpanjang hasil maksimal (Full HD)
  const FFMPEG_TIMEOUT = 8 * 60 * 1000
  const DOC_THRESHOLD = 45 * 1024 * 1024  // di atas ini dikirim sebagai dokumen

  let busy = false // satu proses sekaligus, supaya server tidak berat

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatDuration = (seconds) => {
    const s = Math.max(0, Math.round(seconds || 0))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const parseFps = (rate) => {
    const mt = String(rate || '').match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
    if (!mt || !Number(mt[2])) return null
    const v = Number(mt[1]) / Number(mt[2])
    return v > 0 ? Math.round(v * 100) / 100 : null
  }

  const probe = async (file) => {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      file
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 60000 })

    const data = JSON.parse(stdout || '{}')
    const streams = data.streams || []
    const v = streams.find(s => s.codec_type === 'video')
    if (!v || !v.width || !v.height) throw new Error('Video tidak terbaca (tidak ada stream video).')

    return {
      width: Number(v.width),
      height: Number(v.height),
      fps: parseFps(v.avg_frame_rate) || parseFps(v.r_frame_rate),
      duration: parseFloat(data.format?.duration || v.duration || 0) || 0,
      audio: streams.some(s => s.codec_type === 'audio')
    }
  }

  // ukuran target: 2x, tapi sisi terpanjang tidak melebihi Full HD; selalu genap
  const targetSize = (w, h) => {
    const long = Math.max(w, h)
    const scale = Math.min(2, MAX_LONG_SIDE / long)
    if (scale <= 1) return { w, h, scaled: false }
    const even = n => Math.max(2, Math.round(n / 2) * 2)
    return { w: even(w * scale), h: even(h * scale), scaled: true }
  }

  const runFfmpeg = (input, output, filter, hasAudio) => execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-nostdin',
    '-loglevel', 'error',
    '-i', input,
    '-vf', filter,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-movflags', '+faststart',
    output
  ], { maxBuffer: 10 * 1024 * 1024, timeout: FFMPEG_TIMEOUT })

  const handler = async (m, { sock, conn, usedPrefix, command, reply }) => {
    const client = sock || conn
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mtype || ''

    if (!/video|gif/.test(mime)) {
      return reply(
        `🎞️ *HD VIDEO*\n\n` +
        `Balas atau kirim video dengan caption:\n` +
        `• \`${usedPrefix + command}\`\n\n` +
        `Video diperbesar sampai 2x (maks Full HD), dipertajam, dikurangi noise, dan warnanya dibuat lebih hidup.\n\n` +
        `_Batas: ${formatBytes(MAX_BYTES)}, durasi ${MAX_SECONDS} detik. Ini filter ffmpeg, bukan AI, jadi hasil terbaik muncul di video yang resolusinya kecil atau agak buram._`
      )
    }

    if (busy) return reply('⏳ Masih ada video lain yang diproses. Coba lagi sebentar ya.')
    busy = true

    const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const tmpIn = path.join(os.tmpdir(), `hdv_in_${id}.mp4`)
    const tmpOut = path.join(os.tmpdir(), `hdv_out_${id}.mp4`)
    const started = Date.now()

    try {
      let media
      if (typeof q.download === 'function') media = await q.download()
      else if (typeof client?.downloadMediaMessage === 'function') media = await client.downloadMediaMessage(q)

      if (!media || !Buffer.isBuffer(media)) {
        return reply('❌ Gagal mengunduh video. Pastikan video bisa diputar.')
      }
      if (media.length > MAX_BYTES) {
        return reply(`❌ Video terlalu besar (${formatBytes(media.length)}). Maksimal ${formatBytes(MAX_BYTES)}.`)
      }

      await fs.promises.writeFile(tmpIn, media)

      let meta
      try {
        meta = await probe(tmpIn)
      } catch (e) {
        if (e?.code === 'ENOENT') return reply('❌ ffmpeg/ffprobe belum terpasang di server bot.')
        throw e
      }

      if (meta.duration > MAX_SECONDS) {
        return reply(`❌ Durasi video terlalu panjang (${formatDuration(meta.duration)}). Maksimal ${MAX_SECONDS} detik.`)
      }

      await reply(global.mess?.wait || '⏳ Memproses video, mohon tunggu...')

      const t = targetSize(meta.width, meta.height)
      const scale = t.scaled ? `scale=${t.w}:${t.h}:flags=lanczos,` : ''
      // dari yang paling lengkap ke yang paling sederhana; lanjut ke berikutnya kalau gagal
      const chains = [
        `${scale}hqdn3d=1:0.8:6:6,unsharp=5:5:0.8:5:5:0.4,eq=contrast=1.06:saturation=1.10:brightness=0.02`,
        `${scale}unsharp=5:5:0.8:5:5:0.4`,
        t.scaled ? `scale=${t.w}:${t.h}:flags=bicubic` : 'null'
      ]

      let lastErr = null
      for (const [i, chain] of chains.entries()) {
        try {
          await runFfmpeg(tmpIn, tmpOut, chain, meta.audio)
          if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 1024) { lastErr = null; break }
          throw new Error('Hasil video kosong.')
        } catch (e) {
          lastErr = e
          console.warn(`[HDVIDEO] filter #${i + 1} gagal:`, String(e?.stderr || e?.message || e).slice(0, 200))
          await fs.promises.unlink(tmpOut).catch(() => null)
        }
      }
      if (lastErr) throw new Error('Semua filter ffmpeg gagal. Coba video lain.')

      const out = await probe(tmpOut)
      const outBuffer = await fs.promises.readFile(tmpOut)
      const took = ((Date.now() - started) / 1000).toFixed(1)

      const caption =
        `🎞️ *HD VIDEO*\n\n` +
        `• 📐 *Resolusi:* \`${meta.width}x${meta.height} ➔ ${out.width}x${out.height}\`\n` +
        `• ⏱️ *Durasi:* \`${formatDuration(out.duration)}\`${out.fps ? `  • 🎬 *FPS:* \`${out.fps}\`` : ''}\n` +
        `• 📦 *Ukuran:* \`${formatBytes(media.length)} ➔ ${formatBytes(outBuffer.length)}\`\n` +
        `• ⚙️ *Proses:* \`${took}s\`` +
        (t.scaled ? '' : `\n\n_Video sudah Full HD atau lebih, jadi hanya dipertajam tanpa diperbesar._`)

      if (outBuffer.length > DOC_THRESHOLD) {
        return await client.sendMessage(m.chat, {
          document: outBuffer,
          mimetype: 'video/mp4',
          fileName: `hd_${Date.now()}.mp4`,
          caption
        }, { quoted: m })
      }

      return await client.sendMessage(m.chat, { video: outBuffer, mimetype: 'video/mp4', caption }, { quoted: m })
    } catch (err) {
      console.error('[HDVIDEO ERROR]', err)
      return reply(`❌ Gagal memproses video: ${err?.message || err}`)
    } finally {
      busy = false
      await fs.promises.unlink(tmpIn).catch(() => null)
      await fs.promises.unlink(tmpOut).catch(() => null)
    }
  }

  handler.help = ['hdvideo', 'hdvid', 'vhd']
  handler.tags = ['tools']
  handler.command = ['hdvideo']
  handler.category = 'tools'
  handler.description = 'Perbesar & pertajam video dengan ffmpeg (upscale 2x, denoise, sharpen)'
  handler.limit = true
  handler.register = true
  return handler
}

rbRegister('tools/hdvideo', feature)

let handler = (m, ctx) => rbRun('tools/hdvideo', m, ctx)

handler.command = ['hdvideo', 'remini']
handler.help = ['hdvideo']
handler.tags = ['tools']

export default handler
