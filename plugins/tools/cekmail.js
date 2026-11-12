import { tempMailInbox } from '../../lib/services/scraper.js'

// Lihat inbox email sementara. Buat email dulu lewat .tempmail
const fail = (reply, e) => reply(e.friendly ? e.message : `❌ ${e.message}`)

async function inbox(reply, prefix, email) {
    if (!email) return reply(`Contoh: ${prefix}cekmail <alamat_email>`)

    const { mailbox, messages } = await tempMailInbox(email)
    if (!messages.length) return reply('📭 Belum ada pesan yang masuk.')

    let out = `📥 *Daftar Pesan Masuk*\n📫 Email: ${mailbox}\n\n`
    out += messages.map((v, i) => `🔹 *${i + 1}*. ${v.subject || '(Tanpa Subjek)'}\n📩 ID: ${v.id}`).join('\n\n')
    return reply(out + `\n\nBaca isi pesan: *${prefix}pesanmail <id>*`)
}

let handler = async (m, { text, reply, prefix }) => {
    try {
        return await inbox(reply, prefix, String(text || '').trim())
    } catch (e) {
        fail(reply, e)
    }
}

handler.command = ['cekmail']
handler.help = ['cekmail <email>']
handler.tags = ['tools']

export default handler
