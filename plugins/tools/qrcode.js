let handler = async (m, { sock, text, reply, example }) => {
    if (!text) return example('<teks>')

    try {
        await sock.sendMessage(m.chat, {
            image: { url: `https://quickchart.io/qr?text=${encodeURIComponent(text)}` },
            caption: '¯\\_(ツ)_/¯'
        }, { quoted: m })
    } catch (e) {
        reply('Gagal membuat QR code.')
    }
}

handler.command = ['qrcode']
handler.help = ['qrcode']
handler.tags = ['tools']

export default handler
