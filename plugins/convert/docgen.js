import { createRequire } from 'module'
import { dokumenMulti, kit, uitext, pdfdoc, numwords } from '../../lib/core/file.js'

const require = createRequire(import.meta.url)
// Pembuat dokumen PDF siap pakai: kwitansi, invoice, surat izin, surat lamaran, CV
const { create, Pen, hex } = pdfdoc
const { terbilang } = numwords
const { parseMoney, rp } = uitext

const bad = (m) => Object.assign(new Error('arg'), { userMessage: m })
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const wib = () => new Date(Date.now() + 7 * 3600e3)
const tgl = (d = wib()) => `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const parts = (c, min, usage) => {
  const p = kit.rest(c.body).split('|').map((s) => s.trim())
  if (p.filter(Boolean).length < min) throw bad(`Format:\n${c.prefix}${c.command} ${usage}`)
  return p
}
const kv = (p, rows, w = 82) => {
  for (const [k, v] of rows) {
    const y = p.y
    p.text(`${k}`, { width: w, lh: 1.55 })
    const y2 = p.y
    p.y = y
    p.text(`: ${v}`, { x: p.left + w, width: p.width - w, font: 'b', lh: 1.55 })
    p.y = Math.min(p.y, y2)
  }
  p.gap(8)
}
const out = (buffer, name, caption) => ({ documents: [{ buffer, name: `${name}.pdf`, mime: 'application/pdf', caption }] })
const fileName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'dokumen'
const nomor = (pre) => { const d = wib(); return `${pre}/${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}/${String(Math.floor(Math.random() * 900) + 100)}` }

// ---------------- KWITANSI ----------------
async function kwitansi({ dari, jumlah, untuk, penerima, kota }) {
  const ctx = await create()
  const p = new Pen(ctx, { top: 70, left: 50, right: 50 })
  const W = p.width
  p.rect(p.left - 14, p.y - 360, W + 28, 372, null, { border: '#1d2b55', bw: 2.5 })
  p.rect(p.left - 8, p.y - 354, W + 16, 360, null, { border: '#9aa7d1', bw: 0.8 })
  p.y -= 14
  p.text('KWITANSI', { size: 30, font: 'b', color: '#1d2b55', align: 'center', after: 2 })
  p.text(`No. ${nomor('KW')}`, { size: 10, color: '#666666', align: 'center', after: 12 })
  const field = (label, value, o = {}) => {
    p.text(label, { size: 9, color: '#777777', lh: 1.2 })
    p.text(value, { size: o.size || 12.5, font: o.font || 'b', color: '#111111', lh: 1.3, after: 7 })
  }
  field('Telah terima dari', dari)
  field('Uang sejumlah', `${cap(terbilang(jumlah))} rupiah`, { font: 'bi' })
  field('Untuk pembayaran', untuk, { font: 'r' })
  p.gap(6)
  const y0 = p.y
  p.rect(p.left, y0 - 44, 230, 44, '#eef2ff', { border: '#1d2b55', bw: 1 })
  p.page.drawText(rp(jumlah), { x: p.left + 14, y: y0 - 30, size: 19, font: ctx.F.b, color: hex(ctx.rgb, '#1d2b55') })
  p.page.drawText(`${kota ? `${kota}, ` : ''}${tgl()}`, { x: p.left + W - 190, y: y0 - 12, size: 11, font: ctx.F.r, color: hex(ctx.rgb, '#111111') })
  p.page.drawText('Penerima,', { x: p.left + W - 190, y: y0 - 28, size: 10, font: ctx.F.r, color: hex(ctx.rgb, '#555555') })
  if (jumlah > 5000000) p.page.drawText('[ Tempel meterai Rp10.000 di sini ]', { x: p.left + W - 215, y: y0 - 78, size: 8.5, font: ctx.F.i, color: hex(ctx.rgb, '#999999') })
  p.page.drawLine({ start: { x: p.left + W - 190, y: y0 - 125 }, end: { x: p.left + W - 20, y: y0 - 125 }, thickness: 0.8, color: hex(ctx.rgb, '#333333') })
  p.page.drawText(penerima || '(nama penerima)', { x: p.left + W - 190, y: y0 - 138, size: 11, font: ctx.F.b, color: hex(ctx.rgb, '#111111') })
  return p.save()
}

// ---------------- INVOICE ----------------
function parseItems(str) {
  const items = []
  for (const raw of str.split(/\s*;\s*|\n|,\s+/).map((s) => s.trim()).filter(Boolean)) {
    const m = raw.match(/^(.+?)\s*(?:x\s*(\d+(?:[.,]\d+)?))?\s*@\s*([\d.,]+\s*[a-zA-Z]*)$/i)
    if (!m) throw bad(`Item "${raw}" tidak dikenali.\nTulis: nama x jumlah @harga, contoh: Desain logo x1 @500rb`)
    const price = parseMoney(m[3])
    if (price == null) throw bad(`Harga "${m[3]}" tidak valid.`)
    items.push({ name: m[1].trim(), qty: m[2] ? Number(m[2].replace(',', '.')) : 1, price })
  }
  if (!items.length) throw bad('Tulis minimal 1 item.')
  if (items.length > 25) throw bad('Maksimal 25 item.')
  return items
}
async function invoice({ klien, items, diskon, pajak, dari }) {
  const ctx = await create()
  const p = new Pen(ctx, { top: 60, left: 50, right: 50 })
  const W = p.width
  p.rect(0, p.H - 120, p.W, 120, '#1d2b55')
  p.page.drawText('INVOICE', { x: 50, y: p.H - 75, size: 34, font: ctx.F.b, color: hex(ctx.rgb, '#ffffff') })
  const due = new Date(wib().getTime() + 14 * 864e5)
  const no = nomor('INV')
  p.page.drawText(no, { x: p.W - 50 - ctx.F.r.widthOfTextAtSize(no, 11), y: p.H - 62, size: 11, font: ctx.F.r, color: hex(ctx.rgb, '#cfd8ff') })
  p.y = p.H - 150
  const half = W / 2
  const y0 = p.y
  p.text('DITAGIHKAN KEPADA', { size: 8.5, color: '#888888', width: half, lh: 1.2 })
  p.text(klien, { size: 14, font: 'b', width: half, after: 4 })
  const y1 = p.y
  p.y = y0
  p.text('DARI', { size: 8.5, color: '#888888', x: p.left + half, width: half, lh: 1.2 })
  p.text(dari || '(nama usaha Anda)', { size: 14, font: 'b', x: p.left + half, width: half, after: 4 })
  p.y = Math.min(y1, p.y)
  p.text(`Tanggal : ${tgl()}`, { size: 10, color: '#444444', lh: 1.35 })
  p.text(`Jatuh tempo : ${tgl(due)}`, { size: 10, color: '#444444', lh: 1.35, after: 14 })
  const cw = [W * 0.46, W * 0.1, W * 0.2, W * 0.24]
  p.row([{ w: cw[0], text: 'DESKRIPSI', font: 'b', color: '#ffffff' }, { w: cw[1], text: 'QTY', font: 'b', color: '#ffffff', align: 'center' }, { w: cw[2], text: 'HARGA', font: 'b', color: '#ffffff', align: 'right' }, { w: cw[3], text: 'JUMLAH', font: 'b', color: '#ffffff', align: 'right' }], { bg: '#1d2b55', size: 9.5 })
  let sub = 0
  items.forEach((it, i) => {
    const line = it.qty * it.price
    sub += line
    p.row([{ w: cw[0], text: it.name }, { w: cw[1], text: String(it.qty).replace('.', ','), align: 'center' }, { w: cw[2], text: rp(it.price), align: 'right' }, { w: cw[3], text: rp(line), align: 'right', font: 'b' }], { bg: i % 2 ? '#f4f6fc' : null, size: 10 })
  })
  p.line('#1d2b55', 1.2, 10)
  const disc = sub * (diskon / 100)
  const after = sub - disc
  const tax = after * (pajak / 100)
  const total = after + tax
  const sum = (label, val, bold) => p.row([{ w: cw[0] + cw[1], text: '' }, { w: cw[2], text: label, align: 'right', font: bold ? 'b' : 'r' }, { w: cw[3], text: val, align: 'right', font: 'b', color: bold ? '#1d2b55' : '#111111' }], { size: bold ? 12 : 10, pad: 4 })
  sum('Subtotal', rp(sub))
  if (diskon) sum(`Diskon ${diskon}%`, `- ${rp(disc)}`)
  if (pajak) sum(`PPN ${pajak}%`, rp(tax))
  sum('TOTAL', rp(total), true)
  p.gap(10)
  p.text(`Terbilang: ${cap(terbilang(total))} rupiah`, { size: 10, font: 'i', color: '#444444', after: 14 })
  p.text('Catatan pembayaran', { size: 9, font: 'b', color: '#888888', lh: 1.2 })
  p.text('Mohon lakukan pembayaran sebelum tanggal jatuh tempo. Cantumkan nomor invoice pada berita transfer.', { size: 10, color: '#444444' })
  return { buffer: await p.save(), total }
}

// ---------------- SURAT ----------------
async function suratIzin({ nama, kelas, alasan, tanggal, tujuan, kota }) {
  const ctx = await create()
  const p = new Pen(ctx, { top: 70, left: 72, right: 72 })
  p.text(`${kota || '...........'}, ${tgl()}`, { align: 'right', after: 18 })
  p.text('Perihal : Permohonan Izin', { font: 'b', after: 14 })
  p.text(`Kepada Yth.\n${tujuan}\ndi tempat`, { after: 18 })
  p.text('Dengan hormat,', { after: 8 })
  p.text('Saya yang bertanda tangan di bawah ini:', { after: 6 })
  kv(p, [['Nama', nama], ['Kelas / Jabatan', kelas]], 100)
  p.text(`Dengan surat ini saya memohon izin untuk tidak dapat hadir pada ${tanggal} dikarenakan ${alasan}.`, { lh: 1.6, after: 10 })
  p.text('Demikian surat permohonan izin ini saya sampaikan. Atas perhatian dan pengertian Bapak/Ibu, saya ucapkan terima kasih.', { lh: 1.6, after: 30 })
  p.text('Hormat saya,', { x: p.left + p.width - 160, width: 160, after: 52 })
  p.text(nama, { font: 'b', x: p.left + p.width - 160, width: 160 })
  return p.save()
}
async function suratLamaran({ nama, posisi, perusahaan, pendidikan, skill, kota }) {
  const ctx = await create()
  const p = new Pen(ctx, { top: 64, left: 72, right: 72 })
  p.text(`${kota || '...........'}, ${tgl()}`, { align: 'right', after: 14 })
  p.text('Perihal : Lamaran Pekerjaan', { font: 'b', after: 14 })
  p.text(`Kepada Yth.\nHRD ${perusahaan}\ndi tempat`, { after: 14 })
  p.text('Dengan hormat,', { after: 8 })
  p.text(`Berdasarkan informasi lowongan yang saya ketahui, saya bermaksud mengajukan diri untuk mengisi posisi ${posisi} di ${perusahaan}. Adapun data diri saya:`, { lh: 1.55, after: 8 })
  kv(p, [['Nama', nama], ['Pendidikan', pendidikan], ['Keahlian', skill]], 90)
  p.text(`Saya memiliki ketertarikan yang besar terhadap bidang ini serta kemampuan bekerja secara mandiri maupun dalam tim. Saya berkomitmen untuk bekerja dengan disiplin, jujur, dan bertanggung jawab, serta bersedia belajar dan berkembang bersama ${perusahaan}.`, { lh: 1.55, after: 10 })
  p.text('Sebagai bahan pertimbangan, bersama surat ini saya lampirkan:', { after: 4 })
  p.text('1. Curriculum Vitae (CV)\n2. Fotokopi ijazah dan transkrip nilai terakhir\n3. Fotokopi KTP\n4. Pas foto terbaru\n5. Sertifikat pendukung (jika ada)', { lh: 1.5, after: 10 })
  p.text('Besar harapan saya untuk dapat diberi kesempatan wawancara agar dapat menjelaskan lebih lanjut mengenai kemampuan saya. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.', { lh: 1.55, after: 22 })
  p.text('Hormat saya,', { x: p.left + p.width - 160, width: 160, after: 46 })
  p.text(nama, { font: 'b', x: p.left + p.width - 160, width: 160 })
  return p.save()
}

// ---------------- CV ----------------
async function cv({ nama, jabatan, kontak, ringkasan, skill, kerja, sekolah }) {
  const ctx = await create()
  const side = 190
  const p = new Pen(ctx, { top: 50, left: side + 28, right: 36, bottom: 50 })
  const pageStyle = (page) => page.drawRectangle({ x: 0, y: 0, width: side, height: p.H, color: hex(ctx.rgb, '#1d2b55') })
  pageStyle(p.page)
  const sp = { page: p.page }
  let sy = p.H - 60
  const sTxt = (t, size, font, color, gap = 3) => {
    const lines = pdfdoc.wrap(ctx.F[font], size, side - 44, t)
    for (const ln of lines) { sp.page.drawText(ln, { x: 22, y: sy - size, size, font: ctx.F[font], color: hex(ctx.rgb, color) }); sy -= size * 1.4 }
    sy -= gap
  }
  sTxt(nama, 20, 'b', '#ffffff', 2)
  sTxt(jabatan, 11, 'r', '#9fb0d8', 18)
  if (kontak.length) { sTxt('KONTAK', 10, 'b', '#f6d365', 4); kontak.forEach((k) => sTxt(k, 9.5, 'r', '#ffffff', 2)); sy -= 14 }
  if (skill.length) { sTxt('KEAHLIAN', 10, 'b', '#f6d365', 4); skill.forEach((k) => sTxt(`- ${k}`, 9.5, 'r', '#ffffff', 2)) }
  p.y = p.H - 56
  const head = (t) => { p.gap(6); p.text(t, { size: 12.5, font: 'b', color: '#1d2b55', lh: 1.2, after: 2 }); p.line('#1d2b55', 1.2, 8) }
  if (ringkasan) { head('PROFIL'); p.text(ringkasan, { size: 10, lh: 1.5, after: 8 }) }
  if (kerja.length) {
    head('PENGALAMAN')
    for (const k of kerja) {
      p.text(k.title, { size: 11, font: 'b', lh: 1.3 })
      if (k.meta) p.text(k.meta, { size: 9, color: '#666666', font: 'i', lh: 1.3 })
      if (k.desc) p.text(k.desc, { size: 9.5, lh: 1.45 })
      p.gap(8)
    }
  }
  if (sekolah.length) {
    head('PENDIDIKAN')
    for (const k of sekolah) {
      p.text(k.title, { size: 11, font: 'b', lh: 1.3 })
      if (k.meta) p.text(k.meta, { size: 9, color: '#666666', font: 'i', lh: 1.3 })
      if (k.desc) p.text(k.desc, { size: 9.5, lh: 1.45 })
      p.gap(8)
    }
  }
  return p.save()
}
// "2022-2024 Desainer @ PT Maju: membuat materi; ..." -> {title, meta, desc}
function parseEntries(str) {
  return str.split(/\s*;\s*|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 8).map((s) => {
    const [head, ...d] = s.split(':')
    const [role, org] = head.split('@').map((x) => x.trim())
    const m = role.match(/^(\d{4}(?:\s*[-–]\s*(?:\d{4}|sekarang|now))?)\s+(.*)$/i)
    return { title: (m ? m[2] : role).slice(0, 80), meta: [org, m ? m[1] : ''].filter(Boolean).join('  |  '), desc: d.join(':').trim() }
  })
}
const list = (s) => (s || '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 14)

const specs = {
  kwitansi: { desc: 'Buat kwitansi PDF lengkap dengan terbilang otomatis', usage: '<dari siapa> | <jumlah> | <untuk pembayaran> | [nama penerima] | [kota]', example: 'Budi Santoso | 2,5jt | Pembayaran jasa desain logo | Andi | Bandung', args: true, heavy: true, run: async (c) => {
    const [dari, jml, untuk, penerima, kota] = parts(c, 3, '<dari siapa> | <jumlah> | <untuk pembayaran> | [penerima] | [kota]')
    const jumlah = parseMoney(jml)
    if (!jumlah || jumlah <= 0 || jumlah >= 1e12) throw bad('Jumlah tidak valid. Contoh: 2,5jt, 750rb, 1.500.000')
    return out(await kwitansi({ dari: dari.slice(0, 80), jumlah, untuk: untuk.slice(0, 220), penerima: (penerima || '').slice(0, 40), kota: (kota || '').slice(0, 30) }), `kwitansi-${fileName(dari)}`, `🧾 Kwitansi ${rp(jumlah)}\n_${cap(terbilang(jumlah))} rupiah_`)
  } },
  invoice: { desc: 'Buat invoice/tagihan PDF dengan tabel item, diskon, PPN, dan terbilang', usage: '<klien> | <item x jml @harga; item2 @harga> | [diskon%] | [PPN%] | [nama usahamu]', example: 'Budi | Desain logo x1 @500rb; Revisi x2 @100rb | 0 | 11 | Studio Kreatif', args: true, heavy: true, run: async (c) => {
    const [klien, its, dsk, ppn, dari] = parts(c, 2, '<klien> | <item x jml @harga; …> | [diskon%] | [PPN%] | [usahamu]')
    const diskon = Math.min(100, Math.max(0, Number(String(dsk || 0).replace(',', '.')) || 0))
    const pajak = Math.min(100, Math.max(0, Number(String(ppn || 0).replace(',', '.')) || 0))
    const r = await invoice({ klien: klien.slice(0, 60), items: parseItems(its), diskon, pajak, dari: (dari || '').slice(0, 60) })
    return out(r.buffer, `invoice-${fileName(klien)}`, `🧾 Invoice untuk ${klien}\nTotal: *${rp(r.total)}*`)
  } },
  suratizin: { desc: 'Surat izin tidak masuk (sekolah/kerja) siap cetak', usage: '<nama> | <kelas/jabatan> | <alasan> | <tanggal izin> | [ditujukan ke] | [kota]', example: 'Rina Putri | Kelas XI IPA 2 | sakit demam | Senin, 12 Oktober 2026 | Wali Kelas | Bandung', args: true, heavy: true, run: async (c) => {
    const [nama, kelas, alasan, tanggal, tujuan, kota] = parts(c, 4, '<nama> | <kelas/jabatan> | <alasan> | <tanggal> | [tujuan] | [kota]')
    return out(await suratIzin({ nama: nama.slice(0, 50), kelas: kelas.slice(0, 40), alasan: alasan.slice(0, 160), tanggal: tanggal.slice(0, 60), tujuan: tujuan || 'Bapak/Ibu Guru', kota: (kota || '').slice(0, 30) }), `surat-izin-${fileName(nama)}`, '✉️ Surat izin siap dicetak & ditandatangani.')
  } },
  suratlamaran: { desc: 'Surat lamaran kerja formal siap cetak (lengkap daftar lampiran)', usage: '<nama> | <posisi> | <perusahaan> | <pendidikan> | <keahlian> | [kota]', example: 'Rina Putri | Staf Administrasi | PT Maju Jaya | S1 Manajemen | Microsoft Office, komunikasi | Jakarta', args: true, heavy: true, run: async (c) => {
    const [nama, posisi, perusahaan, pendidikan, skill, kota] = parts(c, 5, '<nama> | <posisi> | <perusahaan> | <pendidikan> | <keahlian> | [kota]')
    return out(await suratLamaran({ nama: nama.slice(0, 50), posisi: posisi.slice(0, 60), perusahaan: perusahaan.slice(0, 60), pendidikan: pendidikan.slice(0, 80), skill: skill.slice(0, 120), kota: (kota || '').slice(0, 30) }), `surat-lamaran-${fileName(nama)}`, '📄 Surat lamaran siap dicetak. Sesuaikan isi bila perlu (ini template umum).')
  } },
  cv: { desc: 'Buat CV 1-2 halaman rapi (sidebar kontak & keahlian). Pisahkan entri dengan titik koma', usage: '<nama> | <jabatan> | <telp, email, kota> | <ringkasan> | <skill1, skill2> | <2022-2024 Posisi @ Perusahaan: tugas; …> | <2018-2022 S1 Jurusan @ Kampus>', example: 'Rina Putri | Desainer Grafis | 0812-1111-2222, rina@mail.com, Bandung | Desainer 3 tahun pengalaman branding | Photoshop, Illustrator, Figma | 2023-sekarang Desainer @ Studio Maju: membuat identitas visual klien; 2021-2023 Junior Desainer @ Agensi Kreasi: desain konten sosial media | 2017-2021 S1 DKV @ Universitas Pasundan', args: true, heavy: true, run: async (c) => {
    const [nama, jabatan, kontak, ringkasan, skill, kerja, sekolah] = parts(c, 2, '<nama> | <jabatan> | <kontak> | <ringkasan> | <skill> | <pengalaman> | <pendidikan>')
    return out(await cv({ nama: nama.slice(0, 40), jabatan: jabatan.slice(0, 50), kontak: list(kontak), ringkasan: (ringkasan || '').slice(0, 500), skill: list(skill), kerja: parseEntries(kerja || ''), sekolah: parseEntries(sekolah || '') }), `cv-${fileName(nama)}`, '📇 CV siap. Tips: isi tiap bagian lebih lengkap lewat perintah yang sama, pisahkan beberapa pengalaman dengan titik koma (;).')
  } }
}

export default dokumenMulti({ name: 'docgen', specs })
