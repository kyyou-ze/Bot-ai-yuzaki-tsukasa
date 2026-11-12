/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — konversi ID saluran (xxxx@newsletter) jadi nama, pengikut & link
 *
 * Contoh:  .cvidch 120363xxxxxxxxxx@newsletter   |   reply pesan yang berisi ID saluran
 */

let handler = async (m, { sock, text, prefix, command, reply }) => {
    let idch = ''
    if (text) {
        idch = text.match(/\d+@newsletter/)?.[0] || ''
    } else if (m.quoted) {
        const q = m.quoted.text || m.quoted.caption || ''
        idch = q.match(/\d+@newsletter/)?.[0] || ''
    }

    if (!idch) return reply(`Contoh: ${prefix || '.'}${command} xxxx@newsletter\natau reply pesan yang mengandung newsletter id`)

    try {
        const meta = await sock.newsletterMetadata('jid', idch)
        const tm = meta.thread_metadata || {}
        const name = tm.name?.text || 'Unknown'
        const subs = Number(tm.subscribers_count || 0).toLocaleString('id-ID')
        const url = tm.invite ? `https://whatsapp.com/channel/${tm.invite}` : '-'
        return reply(`*INFO SALURAN*\n\n- Nama: ${name}\n- Pengikut: ${subs}\n- ID: ${idch}\n- Link: ${url}`)
    } catch (e) {
        return reply(`*ERROR!*\n\n${e.message}`)
    }
}

handler.command = ['cvidch']
handler.help = ['cvidch <id@newsletter>']
handler.tags = ['channel']
handler.limit = true

export default handler
