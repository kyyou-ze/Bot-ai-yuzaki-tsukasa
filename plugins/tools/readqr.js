import { handleApiTool } from '../../lib/services/scraper.js'

// definisi fitur API (sebelumnya di lib/services/scraper.js)
const spec = {
    name: 'readqr', title: 'Baca QR Code', path: 'tools/readqr', kind: 'text', image: ['url'], fields: [] }

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool(spec, m, ctx)

handler.command = ['readqr']
handler.help = ['readqr']
handler.tags = ['tools']

export default handler
