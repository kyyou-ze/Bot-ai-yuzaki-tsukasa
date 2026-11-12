import { createRequire } from 'module'
import { dokumenMulti, kit, du, io, ffm, pool, uitext } from '../../lib/core/file.js'

const require = createRequire(import.meta.url)
// Keranjang media: kumpulkan beberapa gambar/PDF/video/audio lalu gabungkan (PDF, kolase, slideshow, ZIP, video, audio)
const { panel } = uitext

const fail = (m) => Object.assign(new Error(m), { userMessage: m })
const ICON = { image: '🖼️', pdf: '📕', video: '🎬', audio: '🎵', other: '📄' }
const mine = (c, kind) => pool.list(c.sender).filter((i) => (Array.isArray(kind) ? kind.includes(i.kind) : !kind || i.kind === kind))
const need = (items, n, what) => {
  if (items.length < n) throw fail(`Butuh minimal ${n} ${what} di keranjang. Tambah dengan reply file lalu ketik .kumpul`)
}
const stamp = () => Date.now().toString(36)
const nameArg = (c, def) => du.safeName(kit.rest(c.body).trim().replace(/\.[a-z0-9]{2,4}$/i, '') || def, def)

const specs = {
  kumpul: { desc: 'Keranjang media: kumpulkan file (gambar/PDF/video/audio) untuk digabung. Pakai: reply file + .kumpul', usage: '[list|reset|hapus <no>]', run: async (c) => {
    const a = (c.args[0] || '').toLowerCase()
    if (a === 'reset' || a === 'kosong') {
      pool.clear(c.sender)
      return '🗑️ Keranjang dikosongkan.'
    }
    if (a === 'hapus') {
      const n = Number(c.args[1])
      return pool.remove(c.sender, n) ? `🗑️ Item #${n} dihapus.` : 'Nomor item tidak ada. Lihat daftar dengan .kumpul list'
    }
    if (a === 'list' || a === 'daftar') {
      const items = pool.list(c.sender)
      if (!items.length) return 'Keranjang kosong. Reply file dengan .kumpul untuk menambah.'
      return panel('KERANJANG MEDIA', [{ head: `📦 *${items.length} FILE*`, lines: items.map((i, n) => `${n + 1}. ${ICON[i.kind]} ${i.name} (${kit.fmtSize(i.buffer.length)})`) }, { head: '🛠️ *OLAH*', lines: ['.pdfbuat • .kolase • .slideshow • .zipkan', '.gabungvideo • .gabungaudio • .mixav', '.kumpul hapus <no> • .kumpul reset'] }])
    }
    let f
    try {
      f = await du.getFile(c.sock, c.msg)
    } catch (e) {
      throw fail(e.userMessage || e.message)
    }
    if (!f) {
      const items = pool.list(c.sender)
      return `📦 Keranjang: ${items.length} file.\n\nReply sebuah file/gambar/video/audio dengan *${c.prefix}kumpul* untuk menambahkannya, ulangi untuk file lain, lalu olah dengan:\n.pdfbuat  .kolase  .slideshow  .zipkan  .gabungvideo  .gabungaudio  .mixav\n\n.kumpul list • .kumpul hapus <no> • .kumpul reset`
    }
    const kind = ['image', 'pdf', 'video', 'audio'].includes(f.sniff.kind) ? f.sniff.kind : 'other'
    const n = pool.add(c.sender, { buffer: f.buffer, name: f.name, kind, mime: f.mime })
    return `✅ Ditambahkan #${n}: ${ICON[kind]} ${f.name}\nTotal keranjang: ${n} file. Lanjut tambah, atau olah (.kumpul list untuk daftar).`
  } },

  pdfbuat: { desc: 'Gabungkan semua gambar & PDF di keranjang jadi satu PDF (urut sesuai daftar)', usage: '[nama file]', heavy: true, run: async (c) => {
    const items = mine(c, ['image', 'pdf'])
    need(items, 1, 'gambar/PDF')
    const { PDFDocument } = require('pdf-lib')
    const sharp = require('sharp')
    const doc = await PDFDocument.create()
    for (const it of items) {
      if (it.kind === 'pdf') {
        const src = await PDFDocument.load(it.buffer, { ignoreEncryption: true, updateMetadata: false })
        const pages = await doc.copyPages(src, src.getPageIndices())
        pages.forEach((p) => doc.addPage(p))
      } else {
        const jpg = await sharp(it.buffer, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer()
        const img = await doc.embedJpg(jpg)
        const land = img.width > img.height * 1.15
        const [pw, ph] = land ? [842, 595] : [595, 842]
        const page = doc.addPage([pw, ph])
        const mg = 24
        const s = Math.min((pw - mg * 2) / img.width, (ph - mg * 2) / img.height)
        page.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s })
      }
    }
    const out = Buffer.from(await doc.save())
    return { documents: [{ buffer: out, name: `${nameArg(c, 'dokumen')}.pdf`, mime: 'application/pdf', caption: `✅ PDF dibuat: ${doc.getPageCount()} halaman • ${kit.fmtSize(out.length)}` }] }
  } },

  kolase: { desc: 'Susun semua gambar di keranjang jadi satu kolase rapi', usage: '[jumlah kolom]', heavy: true, run: async (c) => {
    const items = mine(c, 'image')
    need(items, 2, 'gambar')
    const sharp = require('sharp')
    const list = items.slice(0, 16)
    const cols = Math.min(list.length, Math.round(kit.numArg(c.args[0], Math.ceil(Math.sqrt(list.length)), 1, 6)))
    const rows = Math.ceil(list.length / cols)
    const cell = cols >= 4 ? 420 : 560
    const gap = 14
    const W = cols * cell + (cols + 1) * gap
    const H = rows * cell + (rows + 1) * gap
    const comps = []
    for (let i = 0; i < list.length; i++) {
      const t = await sharp(list[i].buffer, { failOn: 'none' }).rotate().resize(cell, cell, { fit: 'cover', position: 'attention' }).jpeg({ quality: 90 }).toBuffer()
      comps.push({ input: t, left: gap + (i % cols) * (cell + gap), top: gap + Math.floor(i / cols) * (cell + gap) })
    }
    const img = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comps).jpeg({ quality: 92 }).toBuffer()
    return { image: img, caption: `🖼️ Kolase ${list.length} foto (${cols}×${rows})${items.length > 16 ? '\nMaks 16 foto per kolase.' : ''}` }
  } },

  slideshow: { desc: 'Jadikan gambar di keranjang video slideshow (transisi halus, + musik bila ada audio di keranjang)', usage: '[detik per foto 1-8]', heavy: true, run: async (c) => {
    const items = mine(c, 'image').slice(0, 15)
    need(items, 2, 'gambar')
    const d = kit.numArg(c.args[0], 3, 1, 8)
    const fade = Math.min(0.6, d / 3)
    const frames = []
    for (const it of items) frames.push(await io.blurFit(it.buffer, 1280, 720))
    const aud = mine(c, 'audio')[0]
    const total = items.length * d - (items.length - 1) * fade
    const bufs = aud ? [...frames, aud.buffer] : frames
    const out = await ffm.runMulti(bufs, 'mp4', (ins, o) => {
      const args = []
      frames.forEach((_, i) => args.push('-loop', '1', '-framerate', '25', '-t', String(d), '-f', 'image2', '-i', ins[i]))
      if (aud) args.push('-i', ins[frames.length])
      let f = ''
      let last = '0:v'
      for (let i = 1; i < frames.length; i++) {
        const off = (i * (d - fade)).toFixed(2)
        f += `[${last}][${i}:v]xfade=transition=fade:duration=${fade.toFixed(2)}:offset=${off}[x${i}];`
        last = `x${i}`
      }
      f += `[${last}]format=yuv420p[v]`
      args.push('-filter_complex', f, '-map', '[v]')
      if (aud) args.push('-map', `${frames.length}:a`, '-af', `afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5`, '-c:a', 'aac', '-b:a', '128k', '-t', total.toFixed(2))
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', o)
      return args
    }, 240000)
    return { video: out, caption: `🎞️ Slideshow ${items.length} foto • ${total.toFixed(0)} detik${aud ? ' • + musik' : ''}` }
  } },

  zipkan: { desc: 'Kompres semua file di keranjang jadi satu ZIP', usage: '[nama arsip]', heavy: true, run: async (c) => {
    const items = pool.list(c.sender)
    need(items, 1, 'file')
    const JSZip = require('jszip')
    const zip = new JSZip()
    const used = new Set()
    items.forEach((it, i) => {
      let n = it.name
      if (used.has(n)) n = `${i + 1}-${n}`
      used.add(n)
      zip.file(n, it.buffer)
    })
    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    return { documents: [{ buffer: out, name: `${nameArg(c, 'arsip')}.zip`, mime: 'application/zip', caption: `🗜️ ${items.length} file → ${kit.fmtSize(out.length)}` }] }
  } },

  gabungvideo: { desc: 'Sambung semua video di keranjang jadi satu (diseragamkan 1280x720)', heavy: true, run: async (c) => {
    const items = mine(c, 'video').slice(0, 6)
    need(items, 2, 'video')
    const infos = await Promise.all(items.map((i) => kit.probe(i.buffer)))
    const withAudio = infos.every((p) => p && p.audio)
    const out = await ffm.runMulti(items.map((i) => i.buffer), 'mp4', (ins, o) => {
      const args = []
      ins.forEach((f) => args.push('-i', f))
      let f = ''
      ins.forEach((_, i) => {
        f += `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[v${i}];`
        if (withAudio) f += `[${i}:a]aresample=44100,aformat=channel_layouts=stereo[a${i}];`
      })
      f += ins.map((_, i) => `[v${i}]${withAudio ? `[a${i}]` : ''}`).join('') + `concat=n=${ins.length}:v=1:a=${withAudio ? 1 : 0}[v]${withAudio ? '[a]' : ''}`
      args.push('-filter_complex', f, '-map', '[v]')
      if (withAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '128k')
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-movflags', '+faststart', o)
      return args
    }, 300000)
    return { video: out, caption: `🎬 ${items.length} video digabung${withAudio ? '' : ' (tanpa suara: ada video tanpa audio)'}` }
  } },

  gabungaudio: { desc: 'Sambung semua audio/VN di keranjang jadi satu MP3', heavy: true, run: async (c) => {
    const items = mine(c, 'audio').slice(0, 12)
    need(items, 2, 'audio')
    const out = await ffm.runMulti(items.map((i) => i.buffer), 'mp3', (ins, o) => {
      const args = []
      ins.forEach((f) => args.push('-i', f))
      args.push('-filter_complex', ins.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo[a${i}]`).join(';') + `;${ins.map((_, i) => `[a${i}]`).join('')}concat=n=${ins.length}:v=0:a=1[a]`, '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '160k', o)
      return args
    }, 240000)
    return { audio: out, caption: `🎵 ${items.length} audio digabung` }
  } },

  mixav: { desc: 'Pasang audio dari keranjang sebagai musik/suara baru pada video di keranjang', heavy: true, run: async (c) => {
    const v = mine(c, 'video')[0]
    const a = mine(c, 'audio')[0]
    if (!v || !a) throw fail('Butuh 1 video dan 1 audio di keranjang. Tambah dengan reply lalu .kumpul')
    const out = await ffm.runMulti([v.buffer, a.buffer], 'mp4', (ins, o) => ['-i', ins[0], '-i', ins[1], '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', o], 240000)
    return { video: out, caption: '🎧 Audio dipasang pada video (suara asli diganti, durasi mengikuti yang terpendek)' }
  } }
}

export default dokumenMulti({ name: 'pooltools', specs })
