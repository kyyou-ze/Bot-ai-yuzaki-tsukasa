// Info & ID grup / channel WhatsApp (dengan tombol salin ID)
//   .cekid <link grup WA>      -> info & ID grup
//   .cekid <link channel WA>   -> info & ID channel
const GROUP_RE = /(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
const CHANNEL_RE = /whatsapp\.com\/channel\/([0-9A-Za-z_-]+)/i

// kirim teks + tombol salin ID; kalau tombol gagal terkirim, kirim teks biasa
async function sendWithCopy(sock, m, jid, reply, text, label, code) {
    try {
        return await sock.sendButtons(jid, {
            text,
            footer: global.namebot || 'Kaguya MD',
            buttons: [{ type: 'copy', text: label, code: String(code) }]
        }, { quoted: m })
    } catch (e) {
        console.error('[cekid] tombol gagal:', e?.message || e)
        return reply(text)
    }
}

async function groupInfo(sock, m, jid, reply, code) {
    try {
        const info = await sock.groupGetInviteInfo(code)
        const created = info.creation ? new Date(info.creation * 1000).toLocaleString('id-ID') : '-'
        const text = `
— INFO GRUP —

❀ Nama: ${info.subject}
❀ ID Grup: ${info.id}
❀ Member: ${info.size || 0}
❀ Dibuat: ${created}
`.trim()
        return sendWithCopy(sock, m, jid, reply, text, 'Salin ID Grup', info.id)
    } catch (e) {
        console.error(e)
        return reply('Gagal mengambil info grup. Pastikan link invite masih valid.')
    }
}

async function channelInfo(sock, m, jid, reply, code) {
    try {
        const result = await sock.newsletterMetadata('invite', code)
        const meta = result.thread_metadata || {}
        const created = meta.creation_time ? new Date(Number(meta.creation_time) * 1000).toLocaleString('id-ID') : '-'
        const text =
            `╭─▣「 *INFORMASI CHANNEL* 」▣─╮\n` +
            `┃ ✦ Nama       : ${meta.name?.text || '-'}\n` +
            `┃ ✦ ID Channel : ${result.id}\n` +
            `┃ ✦ Subscriber : ${Number(meta.subscribers_count || 0).toLocaleString('id-ID')}\n` +
            `┃ ✦ Verifikasi : ${meta.verification || '-'}\n` +
            `┃ ✦ Status     : ${result.state?.type || '-'}\n` +
            `┃ ✦ Dibuat     : ${created}\n` +
            `╰─────────────➤`
        return sendWithCopy(sock, m, jid, reply, text, 'Salin ID Channel', result.id)
    } catch (e) {
        console.error(e)
        return reply('Gagal mengambil data channel.')
    }
}

let handler = async (m, { sock, text, reply, jid, prefix }) => {
    const input = String(text || '').trim()
    const chat = jid || m.chat
    if (!input) {
        return reply(
            `Masukkan link grup atau channel WhatsApp.\n\n` +
            `Contoh:\n${prefix}cekid https://chat.whatsapp.com/xxxx\n${prefix}cekid https://whatsapp.com/channel/xxxx`
        )
    }

    const ch = input.match(CHANNEL_RE)
    if (ch) return channelInfo(sock, m, chat, reply, ch[1])

    const gc = input.match(GROUP_RE)
    if (gc) return groupInfo(sock, m, chat, reply, gc[1])

    return reply('Link tidak valid. Gunakan link grup (chat.whatsapp.com) atau channel (whatsapp.com/channel).')
}

handler.command = ['cekid']
handler.help = ['cekid <link>']
handler.tags = ['tools']

export default handler
