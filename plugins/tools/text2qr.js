// TEXT2QR (ALYA MD) — ubah teks/link jadi gambar QR.
// Command: text2qr / qrtext

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let QRCode = null

function qrcode() {
  if (!QRCode) QRCode = require('qrcode')
  return QRCode
}

let handler = async (m, { sock, jid, text, prefix, reply }) => {
  const value = String(text || m.quoted?.text || '').trim()
  if (!value) return reply(`Contoh: ${prefix || '.'}text2qr https://example.com`)

  try {
    const buffer = await qrcode().toBuffer(value, {
      type: 'png',
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
    return sock.sendMessage(jid, { image: buffer, caption: `🔳 QR untuk:\n${value.slice(0, 300)}` }, { quoted: m })
  } catch (err) {
    return reply(`❌ Gagal membuat QR: ${err.message}`)
  }
}

handler.command = ['text2qr', 'qrtext']
handler.help = ['text2qr <teks/link>']
handler.tags = ['tools']
handler.description = 'Buat gambar QR dari teks atau link'

export default handler
