// .ocr  -> ubah teks di dalam gambar menjadi teks (kirim / reply foto)
import { handleApiTool } from '../../lib/services/scraper.js'

// definisi fitur API (sebelumnya di lib/services/scraper.js)
const spec = {
    name: 'ocr', title: 'OCR (Gambar ke Teks)', path: 'tools/ocr', kind: 'text', image: ['url'], fields: [] }

let handler = (m, ctx) => handleApiTool(spec, m, ctx)

handler.command = ['ocr']
handler.help = ['ocr']
handler.tags = ['convert']

handler.limit = true

export default handler
