let handler = async (m, { sock }) => {
    await sock.sendMessage(m.chat, { text: m.chat }, { quoted: m })
}
handler.command = ['idgrup']
handler.tags = ['group']
handler.owner = true
export default handler
