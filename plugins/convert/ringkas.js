// .ringkas <teks>  -> ringkasan teks panjang dengan AI. Bisa juga reply pesan teks, atau reply / kirim FOTO
// (teks di foto dibaca dulu dengan OCR lalu diringkas).
import { runApiTool } from '../../lib/services/scraper.js'
import { pickMedia, reactTo } from '../../lib/core/file.js'

// definisi fitur API yang dipakai ringkas (sebelumnya di lib/services/scraper.js)
const gptSpec = {
    name: 'gpt',
    title: 'GPT', path: 'ai/gpt', kind: 'text', plain: true, timeout: 60000,
    fields: [{ key: 'text', label: 'teks', req: true, rest: true }], quoted: true, example: 'Apa itu JavaScript?'
}
const ocrSpec = {
    name: 'ocr', title: 'OCR (Gambar ke Teks)', path: 'tools/ocr', kind: 'text', image: ['url'], fields: [] }

const CHUNK = 1200
const MAX_CHUNKS = 4
const ask = async (prompt, prefix) => {
    const r = await runApiTool(gptSpec, { rawArgs: prompt, prefix })
    if (r.usage || !r.text) throw new Error('AI tidak memberi jawaban')
    return String(r.text).trim()
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    let input = String(text || '').trim() || String(m.quoted?.text || '').trim()
    const media = pickMedia(m)

    try {
if (!input && media && /image/i.test(media.mime || '')) {
    await reactTo(sock, m, '⏳')
    const r = await runApiTool(ocrSpec, { hasImage: true, getImage: () => media.download(), prefix })
    if (r.usage || !r.text) return reply('Teks di gambar tidak terbaca.')
    input = String(r.text).trim()
}
        if (!input) return reply(`Kirim teks panjang, reply pesan, atau reply foto berisi teks.\nContoh: ${prefix}${command} <teks panjang>`)
        if (input.length < 200) return reply('Teksnya sudah cukup pendek, tidak perlu diringkas.')

        await reactTo(sock, m, '⏳')
        const chunks = []
        for (let i = 0; i < input.length && chunks.length < MAX_CHUNKS; i += CHUNK) chunks.push(input.slice(i, i + CHUNK))
        const cut = input.length > CHUNK * MAX_CHUNKS

        let summary
        if (chunks.length === 1) {
            summary = await ask(`Ringkas teks berikut dalam bahasa Indonesia dengan maksimal 5 poin singkat:\n\n${chunks[0]}`, prefix)
        } else {
            const parts = []
            for (const c of chunks) parts.push(await ask(`Ringkas bagian teks berikut dalam bahasa Indonesia secara padat:\n\n${c}`, prefix))
            summary = await ask(`Gabungkan ringkasan berikut menjadi satu ringkasan utuh dalam bahasa Indonesia, maksimal 6 poin:\n\n${parts.join('\n\n')}`, prefix)
        }

        await reactTo(sock, m, '✅')
        return reply(`*▢ RINGKASAN*\n\n${summary}${cut ? `\n\n_Hanya ${CHUNK * MAX_CHUNKS} karakter pertama yang diringkas._` : ''}`)
    } catch (e) {
        console.error('[RINGKAS]', e?.message || e)
        await reactTo(sock, m, '❌')
        return reply('Gagal meringkas. API AI mungkin sedang down, coba lagi nanti.')
    }
}

handler.command = ['ringkas']
handler.help = ['ringkas <teks>']
handler.tags = ['convert']

handler.limit = true

export default handler
