import { pickImage } from '../../lib/core/file.js'
import { upscaleImage, handleApiTool } from '../../lib/services/scraper.js'

// definisi fitur API hd v2 (sebelumnya di lib/services/scraper.js)
const hd2Spec = {
    name: 'hd2', title: 'HD Foto (versi 2)', path: 'ai-image/hd2', kind: 'image', image: ['url'], fields: [] }

// Gabungan: hd + hdr + hd2
//   .hd        -> perbesar 2x
//   .hd 4      -> perbesar 4x   (alias lama: .hdr)
//   .hd v2     -> HD versi 2    (alias lama: .hd2)
let handler = async (m, ctx) => {
    const { sock, reply, prefix, command, text } = ctx
    const arg = String(text || '').trim().toLowerCase().split(/\s+/)[0]

    let mode = '2x'
    if (command === 'hdr' || arg === '4' || arg === '4x') mode = '4x'
    else if (command === 'hd2' || arg === 'v2' || arg === 'hd2') mode = 'v2'

    if (mode === 'v2') return handleApiTool(hd2Spec, m, ctx)

    const image = pickImage(m)
    if (!image) {
return reply(
    `Kirim/Reply foto dengan caption:\n` +
    `• ${prefix}hd  → perbesar 2x\n` +
    `• ${prefix}hd 4  → perbesar 4x\n` +
    `• ${prefix}hd v2  → HD versi 2`
)
    }

    let media
    try {
media = await image.download()
    } catch (e) {
console.error('[HD] gagal download gambar:', e?.message || e)
return reply('❌ Gagal mengunduh gambar, coba kirim ulang.')
    }
    if (!media?.length) return reply('❌ Gagal mengunduh gambar, coba kirim ulang.')

    await reply('⏳ Memproses gambar, tunggu sebentar...')

    let result
    try {
result = await upscaleImage(media, mode === '4x' ? 4 : 2)
    } catch (e) {
return reply(`❌ Gagal memproses gambar. Error: ${e.message}`)
    }

    await sock.sendMessage(m.chat, { image: result, caption: 'Nih Hasilnya' }, { quoted: m })
}

handler.command = ['hd', 'hd2', 'hdr']
handler.hide = ['hdr', 'hd2']
handler.help = ['hd [4|v2]']
handler.tags = ['convert']

handler.limit = true

export default handler
