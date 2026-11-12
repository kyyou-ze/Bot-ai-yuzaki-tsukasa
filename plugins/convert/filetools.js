import { createRequire } from 'module'
import { dokumenMulti, kit, du, uitext } from '../../lib/core/file.js'

const require = createRequire(import.meta.url)
// Alat file: cek file, ganti nama, ekstrak ZIP, CSV↔JSON, teks/HTML → DOCX
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { panel } = uitext

const fail = (m) => Object.assign(new Error(m), { userMessage: m })
const base = (n) => String(n).replace(/\.[^.]+$/, '')
const asText = (f) => f.buffer.toString('utf8').replace(/^﻿/, '')

function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || ''
  const delim = [',', ';', '\t', '|'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === delim) { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else cur += ch
  }
  row.push(cur)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}
const csvCell = (v) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const specs = {
  cekfile: { desc: 'Cek jenis asli file, ukuran, dan checksum (MD5/SHA-1/SHA-256)', needs: 'file', run: async (c, f) => {
    const h = (a) => crypto.createHash(a).update(f.buffer).digest('hex')
    return panel('INFO FILE', [
      { head: '📄 *BERKAS*', lines: [`Nama : ${f.name}`, `Ukuran : ${kit.fmtSize(f.buffer.length)} (${f.buffer.length.toLocaleString('id-ID')} byte)`] },
      { head: '🔍 *JENIS*', lines: [`Terdeteksi : ${f.sniff.label}`, `Ekstensi asli : .${f.sniff.ext}`, `MIME : ${f.mime}`, path.extname(f.name).slice(1).toLowerCase() && path.extname(f.name).slice(1).toLowerCase() !== f.sniff.ext ? `⚠️ Ekstensi nama (.${path.extname(f.name).slice(1)}) tidak cocok dengan isi file` : ''].filter(Boolean) },
      { head: '🔐 *CHECKSUM*', lines: [`MD5 : ${h('md5')}`, `SHA-1 : ${h('sha1')}`, `SHA-256 : ${h('sha256')}`] }
    ])
  } },
  rename: { desc: 'Kirim ulang file dengan nama baru (ekstensi dipertahankan bila tidak ditulis)', usage: '<nama baru>', example: 'laporan-final', needs: 'file', args: true, run: async (c, f) => {
    let n = du.safeName(kit.rest(c.body).trim(), '')
    if (!n) throw fail('Tulis nama barunya.')
    if (!/\.[a-z0-9]{1,6}$/i.test(n)) n += path.extname(f.name) || `.${f.sniff.ext}`
    return { documents: [{ buffer: f.buffer, name: n, mime: f.mime, caption: `✅ Nama diganti: ${n}` }] }
  } },
  unzip: { desc: 'Ekstrak file ZIP dan kirim isinya (maks 15 file, 30 MB)', needs: 'file', heavy: true, run: async (c, f) => {
    if (f.sniff.kind !== 'zip' && f.sniff.kind !== 'office') throw fail('File itu bukan ZIP. (RAR/7z belum didukung.)')
    const JSZip = require('jszip')
    const zip = await JSZip.loadAsync(f.buffer)
    const entries = Object.values(zip.files).filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(e.name))
    if (!entries.length) throw fail('ZIP kosong.')
    const total = entries.reduce((s, e) => s + (e._data?.uncompressedSize || 0), 0)
    const list = entries.map((e, i) => `${i + 1}. ${e.name}`).join('\n')
    if (entries.length > 15 || total > 30 * 1024 * 1024) return `📦 ZIP berisi ${entries.length} file (${kit.fmtSize(total)}) — terlalu besar untuk dikirim semua (maks 15 file / 30 MB).\n\n${list.slice(0, 1500)}`
    const documents = []
    for (const e of entries) {
      const buf = await e.async('nodebuffer')
      const sn = du.sniff(buf)
      documents.push({ buffer: buf, name: du.safeName(path.basename(e.name)), mime: sn.mime })
    }
    documents[0].caption = `📦 ${documents.length} file diekstrak dari ${f.name}`
    return { documents }
  } },
  csv2json: { desc: 'Ubah file CSV jadi JSON (baris pertama = nama kolom)', needs: 'file', run: async (c, f) => {
    if (f.sniff.kind !== 'text') throw fail('Kirim file CSV (teks).')
    const rows = parseCsv(asText(f))
    if (rows.length < 2) throw fail('CSV minimal punya header dan 1 baris data.')
    const head = rows[0].map((h, i) => h.trim() || `kolom${i + 1}`)
    const data = rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
    return { documents: [{ buffer: Buffer.from(JSON.stringify(data, null, 2)), name: `${base(f.name)}.json`, mime: 'application/json', caption: `✅ ${data.length} baris • ${head.length} kolom` }] }
  } },
  json2csv: { desc: 'Ubah file JSON (array of object) jadi CSV', needs: 'file', run: async (c, f) => {
    let data
    try { data = JSON.parse(asText(f)) } catch { throw fail('JSON tidak valid.') }
    if (!Array.isArray(data) && data && typeof data === 'object') data = Object.values(data).find(Array.isArray) || [data]
    if (!Array.isArray(data) || !data.length) throw fail('JSON harus berupa array objek, mis. [{"a":1},{"a":2}].')
    const head = [...new Set(data.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))]
    if (!head.length) throw fail('Isi JSON harus berupa objek.')
    const csv = [head.map(csvCell).join(','), ...data.map((o) => head.map((h) => csvCell(o?.[h])).join(','))].join('\r\n')
    return { documents: [{ buffer: Buffer.from('﻿' + csv), name: `${base(f.name)}.csv`, mime: 'text/csv', caption: `✅ ${data.length} baris • ${head.length} kolom (UTF-8, bisa dibuka di Excel)` }] }
  } },
  todoc: { desc: 'Ubah teks/HTML/RTF/ODT jadi Word (DOCX) — butuh LibreOffice di server', needs: 'file', heavy: true, run: async (c, f) => {
    const ext = f.sniff.ext === 'txt' ? 'txt' : f.sniff.ext === 'html' ? 'html' : path.extname(f.name).slice(1).toLowerCase()
    if (!['txt', 'html', 'htm', 'rtf', 'odt', 'md'].includes(ext)) throw fail('Format didukung: TXT, HTML, RTF, ODT. (Untuk PDF→teks pakai .pdftext)')
    const bin = ['soffice', 'libreoffice'].find((b) => du.which(b))
    if (!bin) throw fail('Butuh LibreOffice di server (sudo apt install libreoffice-writer).')
    const out = await du.withTmp(async (dir) => {
      const inp = path.join(dir, `dokumen.${ext === 'md' ? 'txt' : ext}`)
      fs.writeFileSync(inp, f.buffer)
      await du.exec(bin, [`-env:UserInstallation=file://${dir}/profile`, '--headless', '--convert-to', 'docx', '--outdir', dir, inp], { timeout: 180000, env: { HOME: dir } })
      const o = path.join(dir, 'dokumen.docx')
      if (!fs.existsSync(o)) throw fail('Konversi gagal.')
      return fs.readFileSync(o)
    })
    return { documents: [{ buffer: out, name: `${base(f.name)}.docx`, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', caption: '✅ Dokumen Word dibuat' }] }
  } }
}

export default dokumenMulti({ name: 'filetools', specs })
