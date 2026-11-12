let handler = async (m, { sock, text, reply, example }) => {
    if (!text) return example('8991234567890')

    try {
        await sock.sendMessage(m.chat, {
            image: { url: `https://barcodeapi.org/api/128/${encodeURIComponent(text)}` },
            caption: `📦 Barcode:\n${text}`
        }, { quoted: m })
    } catch (e) {
        reply('Gagal membuat barcode.')
    }
}

handler.command = ['barcode']
handler.help = ['barcode <teks>']
handler.tags = ['tools']

export default handler
