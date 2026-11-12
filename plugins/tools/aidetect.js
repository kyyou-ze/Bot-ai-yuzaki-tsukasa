// Deteksi gambar AI (hivedetect.ai) — scraper asli: lihat kanal https://whatsapp.com/channel/0029VbDWBmtA89MamPba8q3f
import axios from 'axios'
import FormData from 'form-data'
import { pickMedia, reactTo } from '../../lib/core/file.js'

const baseURL = 'https://hivedetect.ai'

const headers = {
    accept: 'application/json, text/plain, */*',
    origin: baseURL,
    referer: `${baseURL}/new`,
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
}

const persen = (n) => typeof n === 'number' ? (n * 100).toFixed(2) + '%' : 'Tidak tersedia'

let handler = async (m, { sock, prefix, command, reply }) => {
    try {
        const media = pickMedia(m)
        const mime = media?.mime || ''
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) {
            return reply(`Reply atau kirim gambar dengan caption *${prefix}${command}*`)
        }

        await reactTo(sock, m, '⏳')
        const buffer = await media.download()
        if (!buffer?.length) throw new Error('Gagal mengunduh gambar.')

        const form = new FormData()
        form.append('media', buffer, { filename: `image.${mime.split('/')[1]}`, contentType: mime })

        const upload = await axios.post(`${baseURL}/api/v1/upload`, form, {
            headers: { ...headers, ...form.getHeaders() },
            timeout: 120000,
            maxBodyLength: Infinity
        })

        const key = upload.data?.data?.short_key
        if (!key) throw new Error('Gagal mengunggah gambar.')

        const { data } = await axios.get(`${baseURL}/json/${key}.json`, { headers, timeout: 60000 })
        const classes = data?.visual?.status?.[0]?.response?.output?.[0]?.classes
        if (!Array.isArray(classes)) throw new Error('Hasil deteksi belum tersedia, coba lagi sebentar lagi.')

        const ai = classes.find(v => v.class === 'ai_generated')?.score
        const human = classes.find(v => v.class === 'not_ai_generated')?.score
        const deepfake = classes.find(v => v.class === 'deepfake')?.score

        const hasil = typeof ai === 'number' && typeof human === 'number'
            ? (ai > human ? 'Kemungkinan gambar dibuat oleh AI.' : 'Kemungkinan gambar bukan hasil AI.')
            : 'Hasil belum dapat disimpulkan.'

        await reply(
            `*🔍 DETEKSI GAMBAR AI*\n\n` +
            `Status: ${hasil}\n\n` +
            `AI Generated: ${persen(ai)}\n` +
            `Not AI Generated: ${persen(human)}\n` +
            `Deepfake: ${persen(deepfake)}\n\n` +
            `_Hasil berupa estimasi model deteksi, bukan kepastian mutlak._`
        )
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        const detail = typeof e.response?.data === 'string' ? e.response.data.slice(0, 200) : e.message
        reply(`❌ Gagal memeriksa gambar.\n${detail}`)
    }
}

handler.command = ['aidetect']
handler.help = ['aidetect']
handler.tags = ['tools']

handler.limit = true

export default handler
