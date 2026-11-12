// Convert teks / dokumen yang di-reply menjadi file dengan nama & ekstensi pilihan
import { TOFILE_MIME } from '../../lib/core/file.js'

let handler = async (m, { sock, text, reply, prefix, command }) => {
    const q = m.quoted
    const formats = Object.keys(TOFILE_MIME).join(', ')

    if (!q) {
        return reply(
            `Contoh:\n${prefix}${command} namafile.js (reply teks / dokumen)\n\n` +
            `Format didukung:\n${formats}`
        )
    }

    if (!text) return reply('❌ Nama file wajib diisi')

    const fileName = text.trim()
    const ext = fileName.split('.').pop().toLowerCase()
    const mimetype = TOFILE_MIME[ext]

    if (!mimetype) {
        return reply(`❌ Ekstensi .${ext} tidak didukung\n\nGunakan salah satu:\n${formats}`)
    }

    try {
        let content
        if (q.mtype === 'documentMessage') content = await q.download()
        else if (q.text) content = q.text
        else return reply('❌ Reply harus berupa teks atau dokumen')

        await sock.sendMessage(m.chat, {
            document: Buffer.isBuffer(content) ? content : Buffer.from(content),
            fileName,
            mimetype,
            caption: '✅ Success convert *tofile!*'
        }, { quoted: m })
    } catch (e) {
        console.error(e)
        reply('⚠️ Gagal membuat file')
    }
}

handler.command = ['tofile']
handler.help = ['tofile <namafile.ext>']
handler.tags = ['convert']

export default handler
