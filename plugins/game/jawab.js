import { runGameAnswer } from '../../lib/engine/plugins.js'

// Plugin pasif: dipanggil untuk pesan biasa (tanpa command) dan hanya memproses
// kalau ada game tebak-tebakan yang sedang berjalan di chat ini.
const handler = (m, ctx) => runGameAnswer(m, ctx)

handler.tags = ['game']
handler.customPrefix = /^[\s\S]+$/

export default handler
