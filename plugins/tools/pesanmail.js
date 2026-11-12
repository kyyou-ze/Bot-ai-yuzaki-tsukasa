import { tempMailRead } from '../../lib/services/scraper.js'

// Baca isi pesan email sementara (ID dari .cekmail)
const fail = (reply, e) => reply(e.friendly ? e.message : `❌ ${e.message}`)

async function read(reply, prefix, id) {
    if (!id) return reply(`Contoh: ${prefix}pesanmail <message_id>`)

    const msg = await tempMailRead(id)
    const rawContent = msg.content || ''

    // ambil semua link sebelum tag HTML dibuang
    const links = [...new Set(rawContent.match(/(https?:\/\/[^\s"'<>]+)/g) || [])]
    const linkSection = links.length
        ? '\n\n🔗 *Link yang Ditemukan:*\n' + links.map((link, i) => `${i + 1}. ${link}`).join('\n')
        : ''

    const cleanContent = rawContent.replace(/<[^>]*>/g, '').trim()

    return reply(`📨 *Isi Pesan*
📌 Subjek: ${msg.subject}
👤 Dari: ${msg.from} <${msg.fromEmail}>
🕐 Diterima: ${msg.receivedAt}
🆔 ID: ${msg.id}

📬 Pesan:
${cleanContent || '(Tidak ada isi)'}${linkSection}`)
}

let handler = async (m, { text, reply, prefix }) => {
    try {
        return await read(reply, prefix, String(text || '').trim())
    } catch (e) {
        fail(reply, e)
    }
}

handler.command = ['pesanmail']
handler.help = ['pesanmail <id>']
handler.tags = ['tools']

export default handler
