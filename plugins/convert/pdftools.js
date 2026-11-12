import { createRequire } from 'module'
import { dokumenMulti, kit, du, uitext } from '../../lib/core/file.js'

const require = createRequire(import.meta.url)
// Alat PDF: PDF↔gambar, potong/hapus/putar halaman, teks, watermark, nomor halaman, info, kompres, OCR, konversi dokumen Office
const fs = require('fs')
const path = require('path')
const { panel } = uitext

const fail = (msg) => Object.assign(new Error(msg), { userMessage: msg })
const PDFLIB = () => require('pdf-lib')
const load = (buf) => PDFLIB().PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false })
const baseName = (n) => du.safeName(String(n).replace(/\.[^.]+$/, ''), 'dokumen')
const pdfOut = (buffer, name) => ({ documents: [{ buffer: Buffer.from(buffer), name: `${name}.pdf`, mime: 'application/pdf', caption: '✅ Selesai' }] })

// ---------- PDF -> gambar ----------
async function renderPages(buf, pages, dpi) {
  if (du.which('pdftoppm')) {
    return du.withTmp(async (dir) => {
      const inp = path.join(dir, 'in.pdf')
      fs.writeFileSync(inp, buf)
      const out = []
      for (const pg of pages) {
        const r = await du.exec('pdftoppm', ['-r', String(dpi), '-f', String(pg), '-l', String(pg), '-jpeg', '-jpegopt', 'quality=90', '-singlefile', inp, path.join(dir, `p${pg}`)], { timeout: 90000 })
        const f = path.join(dir, `p${pg}.jpg`)
        if (r.code !== 0 || !fs.existsSync(f)) throw fail('Gagal merender halaman PDF (file mungkin rusak atau terkunci).')
        out.push({ page: pg, buffer: fs.readFileSync(f) })
      }
      return out
    })
  }
  // cadangan: pdfjs-dist + @napi-rs/canvas
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0 }).promise
  const out = []
  for (const pg of pages) {
    const page = await doc.getPage(pg)
    const vp = page.getViewport({ scale: dpi / 72 })
    const { createCanvas } = require('@napi-rs/canvas')
    const cv = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cv.width, cv.height)
    await page.render({ canvasContext: ctx, viewport: vp, canvas: cv }).promise
    out.push({ page: pg, buffer: await cv.encode('jpeg', 90) })
  }
  return out
}

// ---------- teks PDF ----------
async function pdfText(buf, range) {
  if (du.which('pdftotext')) {
    return du.withTmp(async (dir) => {
      const inp = path.join(dir, 'in.pdf')
      fs.writeFileSync(inp, buf)
      const args = ['-layout', '-enc', 'UTF-8']
      if (range) args.push('-f', String(range[0]), '-l', String(range[range.length - 1]))
      const r = await du.exec('pdftotext', [...args, inp, '-'], { timeout: 60000 })
      return r.out.toString('utf8')
    })
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise
  let text = ''
  for (const pg of range || Array.from({ length: doc.numPages }, (_, i) => i + 1)) {
    const c = await (await doc.getPage(pg)).getTextContent()
    text += `${c.items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join(' ')}\n\f`
  }
  return text
}

// ---------- teks -> PDF ----------
async function textToPdf(text) {
  const { PDFDocument, StandardFonts, rgb } = PDFLIB()
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  void bold
  const W = 595.28
  const H = 841.89
  const M = 56
  const size = 11
  const lead = 16
  const clean = (s) => [...s].map((ch) => { try { font.encodeText(ch); return ch } catch { return ch === '\t' ? '    ' : '?' } }).join('')
  const lines = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const para = clean(raw.replace(/\t/g, '    '))
    if (!para.trim()) { lines.push(''); continue }
    let cur = ''
    for (const w of para.split(/(\s+)/)) {
      if (font.widthOfTextAtSize(cur + w, size) > W - M * 2 && cur.trim()) { lines.push(cur.trimEnd()); cur = w.trimStart() } else cur += w
    }
    lines.push(cur.trimEnd())
  }
  const perPage = Math.floor((H - M * 2) / lead)
  for (let i = 0; i < Math.max(1, lines.length); i += perPage) {
    const page = pdf.addPage([W, H])
    lines.slice(i, i + perPage).forEach((l, k) => l && page.drawText(l, { x: M, y: H - M - k * lead, size, font, color: rgb(0.1, 0.1, 0.1) }))
  }
  return pdf.save()
}

// ---------- gambar -> PDF (satu halaman, ukuran mengikuti gambar) ----------
async function imageToPdf(buf) {
  const sharp = require('sharp')
  const { PDFDocument } = PDFLIB()
  const jpg = await sharp(buf, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer()
  const meta = await sharp(jpg).metadata()
  const pdf = await PDFDocument.create()
  const img = await pdf.embedJpg(jpg)
  // skala ke lebar A4 (595pt) agar ukuran halaman wajar
  const scale = 595.28 / meta.width
  const page = pdf.addPage([meta.width * scale, meta.height * scale])
  page.drawImage(img, { x: 0, y: 0, width: meta.width * scale, height: meta.height * scale })
  return pdf.save()
}

// ---------- dokumen Office -> PDF (butuh LibreOffice) ----------
async function officeToPdf(buf, ext) {
  const bin = ['soffice', 'libreoffice'].find((b) => du.which(b))
  if (!bin) throw fail('Konversi dokumen Office butuh LibreOffice di server (sudo apt install libreoffice-writer). Untuk teks biasa pakai .teks2pdf, untuk gambar pakai .topdf.')
  return du.withTmp(async (dir) => {
    const inp = path.join(dir, `dokumen.${ext}`)
    fs.writeFileSync(inp, buf)
    const r = await du.exec(bin, [`-env:UserInstallation=file://${dir}/profile`, '--headless', '--convert-to', 'pdf', '--outdir', dir, inp], { timeout: 180000, env: { HOME: dir } })
    const out = path.join(dir, 'dokumen.pdf')
    if (!fs.existsSync(out)) throw fail(`Konversi gagal${r.err ? `: ${r.err.split('\n')[0].slice(0, 80)}` : ''}.`)
    return fs.readFileSync(out)
  })
}

// ---------- OCR ----------
async function ocr(buf, lang) {
  if (!du.which('tesseract')) throw fail('OCR butuh Tesseract di server.\nDebian/Ubuntu: sudo apt install tesseract-ocr tesseract-ocr-ind\nTermux: pkg install tesseract')
  const sharp = require('sharp')
  const meta = await sharp(buf, { failOn: 'none' }).metadata()
  let s = sharp(buf, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' }).grayscale().normalise()
  if (Math.max(meta.width, meta.height) < 1600) s = s.resize({ width: Math.round(Math.min(2400, meta.width * 2)), kernel: 'lanczos3' })
  const png = await s.sharpen().png().toBuffer()
  return du.withTmp(async (dir) => {
    const inp = path.join(dir, 'in.png')
    fs.writeFileSync(inp, png)
    const have = (await du.exec('tesseract', ['--list-langs'])).out.toString().split(/\s+/)
    const want = (lang || 'ind+eng').split('+').filter((l) => have.includes(l))
    const use = want.length ? want.join('+') : 'eng'
    const r = await du.exec('tesseract', [inp, 'stdout', '-l', use, '--psm', '3'], { timeout: 120000 })
    return { text: r.out.toString('utf8').replace(/\f/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), lang: use, missing: (lang || 'ind+eng').split('+').filter((l) => !have.includes(l)) }
  })
}

const pdfPages = async (f) => (await load(f.buffer)).getPageCount()

const specs = {
  pdftoimg: { desc: 'Ubah halaman PDF jadi gambar (maks 10 halaman per perintah)', usage: '[halaman|1-3|semua] [hd]', example: '1-3', needs: 'pdf', heavy: true, run: async (c, f) => {
    const total = await pdfPages(f)
    const hd = c.args.some((a) => /^hd$/i.test(a))
    const spec = c.args.find((a) => !/^hd$/i.test(a))
    let pages = du.parseRange(spec || (total > 10 ? '1-10' : 'semua'), total)
    let note = ''
    if (pages.length > 10) { pages = pages.slice(0, 10); note = ' (dibatasi 10 halaman, pakai rentang untuk sisanya)' }
    const out = await renderPages(f.buffer, pages, hd ? 220 : 150)
    return { images: out.map((o) => o.buffer), captions: out.map((o) => `📄 Halaman ${o.page}/${total}${note && o === out[0] ? note : ''}`) }
  } },
  pdfsplit: { desc: 'Ambil halaman tertentu dari PDF jadi PDF baru (urutan sesuai yang kamu tulis)', usage: '<halaman, mis. 1-3,5>', example: '2-4', needs: 'pdf', heavy: true, run: async (c, f) => {
    if (!c.args[0]) throw fail('Tulis halaman yang diambil. Contoh: .pdfsplit 1-3,5')
    const src = await load(f.buffer)
    const pages = du.parseRange(c.args[0], src.getPageCount())
    const out = await PDFLIB().PDFDocument.create()
    for (const p of await out.copyPages(src, pages.map((x) => x - 1))) out.addPage(p)
    return pdfOut(await out.save(), `${baseName(f.name)}-hal-${c.args[0].replace(/[^\d,-]/g, '')}`)
  } },
  pdfhapus: { desc: 'Hapus halaman tertentu dari PDF', usage: '<halaman, mis. 2,5-6>', example: '2', needs: 'pdf', heavy: true, run: async (c, f) => {
    if (!c.args[0]) throw fail('Tulis halaman yang dihapus. Contoh: .pdfhapus 2,5-6')
    const src = await load(f.buffer)
    const del = new Set(du.parseRange(c.args[0], src.getPageCount()))
    if (del.size >= src.getPageCount()) throw fail('Tidak boleh menghapus semua halaman.')
    ;[...del].sort((a, b) => b - a).forEach((p) => src.removePage(p - 1))
    return pdfOut(await src.save(), `${baseName(f.name)}-edit`)
  } },
  pdfrotate: { desc: 'Putar halaman PDF (90, 180, 270)', usage: '[derajat] [halaman]', example: '90 1-2', needs: 'pdf', heavy: true, run: async (c, f) => {
    const { degrees } = PDFLIB()
    const deg = [90, 180, 270].includes(Number(c.args[0])) ? Number(c.args[0]) : 90
    const src = await load(f.buffer)
    const pages = du.parseRange(c.args[1], src.getPageCount())
    for (const p of pages) { const pg = src.getPage(p - 1); pg.setRotation(degrees((pg.getRotation().angle + deg) % 360)) }
    return pdfOut(await src.save(), `${baseName(f.name)}-putar`)
  } },
  pdfinfo: { desc: 'Info PDF: jumlah halaman, ukuran kertas, judul, pembuat', needs: 'pdf', run: async (c, f) => {
    const d = await load(f.buffer)
    const pg = d.getPage(0)
    const { width, height } = pg.getSize()
    const mm = (v) => Math.round((v / 72) * 25.4)
    const paper = [['A4', 210, 297], ['A3', 297, 420], ['A5', 148, 210], ['Letter', 216, 279], ['Legal', 216, 356]].find(([, w, h]) => (Math.abs(mm(width) - w) < 4 && Math.abs(mm(height) - h) < 4) || (Math.abs(mm(width) - h) < 4 && Math.abs(mm(height) - w) < 4))
    const dt = (x) => (x ? x.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-')
    return panel('INFO PDF', [
      { head: '📄 *DOKUMEN*', lines: [`Nama : ${f.name}`, `Halaman : ${d.getPageCount()}`, `Ukuran file : ${kit.fmtSize(f.buffer.length)}`, `Kertas : ${paper ? paper[0] : 'Khusus'} (${mm(width)}×${mm(height)} mm)`] },
      { head: '🧬 *METADATA*', lines: [`Judul : ${d.getTitle() || '-'}`, `Penulis : ${d.getAuthor() || '-'}`, `Pembuat : ${d.getCreator() || '-'}`, `Produser : ${d.getProducer() || '-'}`, `Dibuat : ${dt(d.getCreationDate())}`, `Diubah : ${dt(d.getModificationDate())}`, `Terenkripsi : ${d.isEncrypted ? 'ya' : 'tidak'}`] }
    ])
  } },
  pdftext: { desc: 'Ambil teks dari PDF (halaman tertentu atau semua)', usage: '[halaman]', example: '1-2', needs: 'pdf', heavy: true, run: async (c, f) => {
    const total = await pdfPages(f)
    const pages = c.args[0] ? du.parseRange(c.args[0], total) : null
    let text = (await pdfText(f.buffer, pages)).replace(/\f/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw fail('Tidak ada teks yang bisa diambil. PDF ini mungkin hasil scan; coba .pdftoimg lalu .ocr pada gambarnya.')
    if (text.length <= 3500) return `📄 *TEKS PDF*\n\n${text}`
    return { documents: [{ buffer: Buffer.from(text, 'utf8'), name: `${baseName(f.name)}.txt`, mime: 'text/plain', caption: `📄 Teks PDF (${text.length.toLocaleString('id-ID')} karakter)` }] }
  } },
  pdfwm: { desc: 'Tambah watermark teks miring di semua halaman PDF', usage: '<teks>', example: 'RAHASIA', needs: 'pdf', heavy: true, run: async (c, f) => {
    const t = kit.rest(c.body).trim()
    if (!t || t.length > 40) throw fail('Tulis teks watermark (maks 40 karakter). Contoh: .pdfwm RAHASIA')
    const { StandardFonts, rgb, degrees } = PDFLIB()
    const d = await load(f.buffer)
    const font = await d.embedFont(StandardFonts.HelveticaBold)
    const text = [...t].map((ch) => { try { font.encodeText(ch); return ch } catch { return '?' } }).join('')
    for (const pg of d.getPages()) {
      const { width, height } = pg.getSize()
      const a = (45 * Math.PI) / 180
      const diag = Math.hypot(width, height)
      let size = Math.min(110, (diag * 0.62) / Math.max(1, font.widthOfTextAtSize(text, 1)))
      const w = font.widthOfTextAtSize(text, size)
      const hgt = font.heightAtSize(size, { descender: false })
      pg.drawText(text, { x: width / 2 - (w / 2) * Math.cos(a) + (hgt / 2) * Math.sin(a), y: height / 2 - (w / 2) * Math.sin(a) - (hgt / 2) * Math.cos(a), size, font, color: rgb(0.55, 0.55, 0.55), opacity: 0.28, rotate: degrees(45) })
    }
    return pdfOut(await d.save(), `${baseName(f.name)}-wm`)
  } },
  pdfnomor: { desc: 'Tambah nomor halaman di bawah tiap halaman PDF', usage: '[kiri|tengah|kanan]', example: 'tengah', needs: 'pdf', heavy: true, run: async (c, f) => {
    const { StandardFonts, rgb } = PDFLIB()
    const d = await load(f.buffer)
    const font = await d.embedFont(StandardFonts.Helvetica)
    const pos = (c.args[0] || 'tengah').toLowerCase()
    const n = d.getPageCount()
    d.getPages().forEach((pg, i) => {
      const { width } = pg.getSize()
      const t = `${i + 1} / ${n}`
      const w = font.widthOfTextAtSize(t, 10)
      pg.drawText(t, { x: pos === 'kiri' ? 36 : pos === 'kanan' ? width - 36 - w : (width - w) / 2, y: 22, size: 10, font, color: rgb(0.3, 0.3, 0.3) })
    })
    return pdfOut(await d.save(), `${baseName(f.name)}-nomor`)
  } },
  pdfcompress: { desc: 'Perkecil ukuran PDF (hasil terbaik bila Ghostscript/qpdf terpasang)', needs: 'pdf', heavy: true, run: async (c, f) => {
    let out = null
    if (du.which('gs')) {
      out = await du.withTmp(async (dir) => {
        fs.writeFileSync(path.join(dir, 'in.pdf'), f.buffer)
        await du.exec('gs', ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', '-dPDFSETTINGS=/ebook', '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${path.join(dir, 'out.pdf')}`, path.join(dir, 'in.pdf')], { timeout: 180000 })
        return fs.existsSync(path.join(dir, 'out.pdf')) ? fs.readFileSync(path.join(dir, 'out.pdf')) : null
      })
    } else if (du.which('qpdf')) {
      out = await du.withTmp(async (dir) => {
        fs.writeFileSync(path.join(dir, 'in.pdf'), f.buffer)
        await du.exec('qpdf', ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9', path.join(dir, 'in.pdf'), path.join(dir, 'out.pdf')], { timeout: 120000 })
        return fs.existsSync(path.join(dir, 'out.pdf')) ? fs.readFileSync(path.join(dir, 'out.pdf')) : null
      })
    }
    if (!out) out = Buffer.from(await (await load(f.buffer)).save({ useObjectStreams: true }))
    if (out.length >= f.buffer.length) return `ℹ️ PDF ini sudah efisien (${kit.fmtSize(f.buffer.length)}), tidak bisa diperkecil lagi.${du.which('gs') ? '' : '\nUntuk PDF berisi banyak foto, pasang Ghostscript agar bisa dikompres lebih kuat.'}`
    return { documents: [{ buffer: out, name: `${baseName(f.name)}-kecil.pdf`, mime: 'application/pdf', caption: `✅ ${kit.fmtSize(f.buffer.length)} → ${kit.fmtSize(out.length)} (hemat ${Math.round((1 - out.length / f.buffer.length) * 100)}%)` }] }
  } },
  teks2pdf: { desc: 'Ubah teks (atau reply pesan/file .txt) jadi PDF', usage: '<teks>', example: 'Halo dunia', run: async (c) => {
    let t = kit.rest(c.body).trim()
    if (!t) {
      const q = (c.msg.quoted?.text || c.msg.quoted?.msg?.text || '')
      t = q || ''
    }
    if (!t) {
      const f = await du.getFile(c.sock, c.msg).catch(() => null)
      if (f && f.sniff.kind === 'text') t = f.buffer.toString('utf8')
    }
    if (!t) throw fail('Tulis teksnya, reply pesan teks, atau reply file .txt.\nContoh: .teks2pdf Halo dunia')
    if (t.length > 60000) throw fail('Teks terlalu panjang (maks 60.000 karakter).')
    return pdfOut(await textToPdf(t), `teks-${Date.now()}`)
  } },
  topdf: { desc: 'Ubah gambar, teks, atau dokumen Word/Excel/PowerPoint jadi PDF', needs: 'file', heavy: true, run: async (c, f) => {
    const k = f.sniff.kind
    if (k === 'image') return pdfOut(await imageToPdf(f.buffer), baseName(f.name))
    if (k === 'text') return pdfOut(await textToPdf(f.buffer.toString('utf8')), baseName(f.name))
    if (k === 'office' || /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(f.name)) return pdfOut(await officeToPdf(f.buffer, k === 'office' ? f.sniff.ext : (f.name.match(/\.(\w+)$/) || [])[1] || 'docx'), baseName(f.name))
    if (k === 'pdf') throw fail('File itu sudah PDF.')
    throw fail(`Jenis file "${f.sniff.label}" belum bisa dijadikan PDF. Didukung: gambar, teks, Word, Excel, PowerPoint.`)
  } },
  ocr: { desc: 'Baca teks dari foto/gambar (OCR, Indonesia + Inggris)', usage: '[bahasa, mis. eng]', needs: 'image', heavy: true, run: async (c, m) => {
    const r = await ocr(m.buffer, c.args[0])
    if (!r.text) return '🔍 Tidak ada teks yang terbaca. Coba foto yang lebih jelas, lurus, dan terang.'
    const note = r.missing.length ? `\n\n_Paket bahasa ${r.missing.join(', ')} belum terpasang, memakai ${r.lang}. Debian/Ubuntu: sudo apt install tesseract-ocr-${r.missing[0]}_` : ''
    return `📝 *HASIL OCR* (${r.lang})\n\n${r.text.slice(0, 3800)}${note}`
  } }
}

delete specs.topdf // .topdf kini dari plugins/tools/img2pdf.js (plugin baru)
delete specs.ocr // .ocr kini dari plugins/tools/ocr.js (plugin baru)
export default dokumenMulti({ name: 'pdftools', specs })
