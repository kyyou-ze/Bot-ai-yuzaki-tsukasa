import { obfuscateJs } from '../../lib/engine/plugins.js'

let handler = async (m, { sock, text, reply }) => {
    if (!text) return reply('Masukkan kode JavaScript yang ingin di-obfuscate')

    try {
        const code = await obfuscateJs(text)

        await sock.sendMessage(m.chat, {
            document: Buffer.from(code),
            fileName: `obfuscated-${Date.now()}.js`,
            mimetype: 'application/javascript'
        }, { quoted: m })
    } catch (e) {
        console.error(e)
        reply(e.friendly ? e.message : 'Gagal meng-obfuscate kode')
    }
}

handler.command = ['enc']
handler.help = ['enc <code>']
handler.tags = ['tools']

export default handler
