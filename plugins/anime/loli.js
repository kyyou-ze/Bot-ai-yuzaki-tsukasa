import axios from 'axios'

let handler = async (m, { sock, reply }) => {
    try {
        const { data } = await axios.get('https://raw.githubusercontent.com/ShirokamiRyzen/WAbot-DB/main/fitur_db/anime_loli.json', { timeout: 20000 })
        if (!Array.isArray(data) || !data.length) return reply('❌ Data gambar kosong.')
        const url = data[Math.floor(Math.random() * data.length)]
        return await sock.sendMessage(m.chat, { image: { url }, caption: 'Nih Kak' }, { quoted: m })
    } catch (e) {
        return reply(`❌ Gagal mengambil gambar: ${e.response?.status || e.message}`)
    }
}

handler.command = ['loli']
handler.help = ['loli']
handler.tags = ['anime']
handler.limit = true

export default handler
