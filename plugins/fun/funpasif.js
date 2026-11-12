import { dioBefore } from '../../lib/engine/plugins.js'

// Plugin pasif: dipanggil untuk pesan biasa (tanpa command) dan hanya memproses
// kalau ada game fun yang sedang berjalan di chat ini (tebak, cepatketik, hilo, hitungbenda, topik, mastermind).
const handler = (m, ctx) => dioBefore(m, ctx)

handler.tags = ['fun']
handler.customPrefix = /^[\s\S]+$/

export default handler
