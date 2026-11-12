import { tempMailCreate, tempMailInbox, tempMailRead } from '../../lib/services/scraper.js'

// Email sementara. Lihat inbox: .cekmail <email>   Baca pesan: .pesanmail <id>
//   .tempmail               -> buat email sementara
//   .tempmail cek <email>   -> lihat inbox
//   .tempmail baca <id>     -> baca pesan 
const fail = (reply, e) => reply(e.friendly ? e.message : `❌ ${e.message}`)

async function create(reply, prefix) {
    const { email, deletedIn } = await tempMailCreate()
    return reply(`📫 *Email Sementara berhasil dibuat!*
📧 Email: ${email}
🕐 Expired: ${deletedIn}

Cek inbox:
*${prefix}tempmail cek ${email}*`)
}

async function inbox(reply, prefix, email) {
    if (!email) return reply(`Contoh: ${prefix}tempmail cek <alamat_email>`)

    const { mailbox, messages } = await tempMailInbox(email)
    if (!messages.length) return reply('📭 Belum ada pesan yang masuk.')

    let out = `📥 *Daftar Pesan Masuk*\n📫 Email: ${mailbox}\n\n`
    out += messages.map((v, i) => `🔹 *${i + 1}*. ${v.subject || '(Tanpa Subjek)'}\n📩 ID: ${v.id}`).join('\n\n')
    return reply(out + `\n\nBaca isi pesan: *${prefix}tempmail baca <id>*`)
}

async function read(reply, prefix, id) {
    if (!id) return reply(`Contoh: ${prefix}tempmail baca <message_id>`)

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
        const [first = '', ...rest] = String(text || '').trim().split(/\s+/)
        const arg = rest.join(' ').trim()
        const sub = first.toLowerCase()

        if (!sub) return await create(reply, prefix)
        if (['cek', 'inbox'].includes(sub)) return await inbox(reply, prefix, arg)
        if (['baca', 'read'].includes(sub)) return await read(reply, prefix, arg)

        // .tempmail <email> langsung dianggap cek inbox
        if (first.includes('@')) return await inbox(reply, prefix, first)

        return reply(
            `*Tempmail*\n` +
            `• ${prefix}tempmail  → buat email baru\n` +
            `• ${prefix}tempmail cek <email>  → lihat inbox\n` +
            `• ${prefix}tempmail baca <id>  → baca pesan`
        )
    } catch (e) {
        fail(reply, e)
    }
}

handler.command = ['tempmail']
handler.help = ['tempmail [cek <email> | baca <id>]']
handler.tags = ['tools']

export default handler
