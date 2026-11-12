//.wiki <kata>        -> ringkasan Wikipedia (Indonesia)
//    .wiki en <kata>     -> pilih bahasa lain (kode 2-3 huruf, contoh: en, ja, ms)
import axios from 'axios'
import { adapt } from '../../lib/engine/plugins.js'

const UA = { 'user-agent': 'KaguyaMD/1.0 (WhatsApp bot; wikipedia summary)', 'accept': 'application/json' }

async function cariJudul(lang, q) {
    const { data } = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
        params: { action: 'opensearch', search: q, limit: 5, namespace: 0, format: 'json', redirects: 'resolve' },
        headers: UA, timeout: 15000
    })
    return Array.isArray(data?.[1]) ? data[1] : []
}

async function ringkasan(lang, judul) {
    const { data } = await axios.get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(judul.replace(/ /g, '_'))}`, {
        headers: UA, timeout: 15000
    })
    return data
}

let handler = async (m, { conn, args, text, usedPrefix, command }) => {
    let lang = 'id'
    let q = String(text || '').trim()
    if (!q && m.quoted?.text) q = String(m.quoted.text).trim().slice(0, 100)
    if (args.length > 1 && /^[a-z]{2,3}$/i.test(args[0])) {
        lang = args[0].toLowerCase()
        q = args.slice(1).join(' ').trim()
    }
    if (!q) return m.reply(`*WIKIPEDIA*\n\nCari ringkasan apa saja!\n\n Contoh:\n${usedPrefix}${command} Candi Borobudur\n${usedPrefix}${command} en Black hole`)

    await m.reply('Mencari di Wikipedia...')
    try {
        const hasil = await cariJudul(lang, q)
        if (!hasil.length) return m.reply(`Tidak ada hasil untuk *${q}*.\n Coba kata kunci lain atau bahasa lain, contoh: ${usedPrefix}${command} en ${q}`)

        const data = await ringkasan(lang, hasil[0])
        if (!data?.extract) return m.reply('Artikel ditemukan tapi ringkasannya kosong.')

        let isi = data.extract.trim()
        if (isi.length > 900) isi = isi.slice(0, 900).replace(/\s+\S*$/, '') + '…'

        const lain = data.type === 'disambiguation' || hasil.length > 1
            ? `\n\n *Hasil lain:*\n${hasil.slice(1).map((h) => `• ${h}`).join('\n')}`
            : ''
        const caption = `*${data.title}*${data.description ? `\n_${data.description}_` : ''}\n\n${isi}\n\n ${data.content_urls?.desktop?.page || ''}${lain}`.trim()

        const gambar = data.thumbnail?.source
        if (gambar) {
            return await conn.sendMessage(m.chat, { image: { url: gambar }, caption }, { quoted: m }).catch(() => m.reply(caption))
        }
        return m.reply(caption)
    } catch (e) {
        if (e?.response?.status === 404) return m.reply(`🍅 Artikel *${q}* tidak ditemukan.`)
        throw `Gagal mengambil data Wikipedia: ${e?.message || e}`
    }
}

handler.help = ['wiki <kata>', 'wiki en <kata>']
handler.tags = ['search']
handler.command = ['wiki']
handler.limit = false
handler.exp = 0

export default adapt(handler, { category: 'search' })
