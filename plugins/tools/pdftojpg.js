// ───────── pdf to jpg (ilovepdf) ─────────
// Reply / kirim file PDF dengan caption .pdftojpg [dpi]
import axios from 'axios'
import FormData from 'form-data'
import { wrapPlugin } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const BASE = 'https://api.ilovepdf.com'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'

async function getPublicToken() {
  const res = await axios.get('https://www.ilovepdf.com/pdf_to_jpg', { headers: { 'User-Agent': UA }, timeout: 30000 })
  const match = String(res.data).match(/"token":"([^"]+)"/)
  if (!match) throw new Error('Token tidak ditemukan')
  return match[1]
}

async function startTask(token) {
  const res = await axios.get(`${BASE}/v1/start/pdfjpg`, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 })
  return { server: `https://${res.data.server}`, task: res.data.task }
}

async function uploadFile(server, task, token, buffer, filename) {
  const form = new FormData()
  form.append('task', task)
  form.append('file', buffer, { filename, contentType: 'application/pdf' })
  const res = await axios.post(`${server}/v1/upload`, form, {
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    maxBodyLength: Infinity,
    timeout: 120000
  })
  return res.data.server_filename
}

async function processTask(server, task, token, serverFilename, originalName, dpi) {
  const form = new FormData()
  form.append('task', task)
  form.append('tool', 'pdfjpg')
  form.append('pdfjpg_mode', 'pages')
  form.append('dpi', dpi)
  form.append('output_filename', '{filename}_page')
  form.append('packaged_filename', 'ilovepdf_pages-to-jpg')
  form.append('files[0][server_filename]', serverFilename)
  form.append('files[0][filename]', originalName)
  await axios.post(`${server}/v1/process`, form, {
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    timeout: 180000
  })
}

async function downloadResult(server, task, token) {
  const res = await axios.get(`${server}/v1/download/${task}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
    timeout: 180000
  })
  return Buffer.from(res.data)
}

async function pdfToJpg(buffer, filename, dpi = '150') {
  const token = await getPublicToken()
  const { server, task } = await startTask(token)
  const serverFilename = await uploadFile(server, task, token, buffer, filename)
  await processTask(server, task, token, serverFilename, filename, dpi)
  return downloadResult(server, task, token)
}

const pluginConfig = {
  name: 'pdftojpg',
  category: 'tools',
  description: 'Ubah halaman PDF jadi gambar JPG',
  usage: '.pdftojpg [dpi: 72-300] (reply PDF)',
  example: '.pdftojpg 150',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 2,
  isEnabled: true
}

async function handler(m, { sock }) {
  const q = m.quoted || m
  const mime = String(q.mimetype || q.msg?.mimetype || '')

  if (!/pdf/i.test(mime)) {
    m.react('❌')
    return m.reply(`📌 Reply atau kirim file *PDF* dengan caption *${m.prefix + m.command}*\nOpsional DPI: *${m.prefix + m.command} 300*`)
  }

  const dpiArg = parseInt(String(m.text || '').trim(), 10)
  const dpi = String(Number.isFinite(dpiArg) ? Math.min(300, Math.max(72, dpiArg)) : 150)

  m.react('🕕')
  try {
    const pdf = await q.download()
    if (!pdf?.length) throw new Error('Gagal mengunduh file PDF')

    const name = String(q.fileName || q.msg?.fileName || 'document.pdf')
    const result = await pdfToJpg(pdf, /\.pdf$/i.test(name) ? name : name + '.pdf', dpi)
    if (!result?.length) throw new Error('Hasil konversi kosong')

    const isZip = result[0] === 0x50 && result[1] === 0x4b
    if (isZip) {
      await sock.sendMessage(
        m.chat,
        { document: result, mimetype: 'application/zip', fileName: `pdf-to-jpg-${Date.now()}.zip`, caption: `✅ Selesai (${dpi} DPI)` },
        { quoted: m }
      )
    } else {
      await sock.sendMessage(m.chat, { image: result, caption: `✅ Selesai (${dpi} DPI)` }, { quoted: m })
    }
    m.react('✅')
  } catch (e) {
    console.error('[PDFtoJPG] Error:', e)
    m.react('❌')
    m.reply(`❌ *Gagal konversi*\n\n> ${e.message}`)
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

// satu command = nama file; command lama dibuang (alias)
__plugin.limit = true
export default oneCommand(__plugin, 'pdftojpg', { subs: false })
