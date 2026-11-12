let handler = async (m, { reply }) => {
    if (!global.__jpmBasicRunning) return reply('❌ Tidak ada JPM Basic yang sedang berjalan.')
    global.__jpmBasicStop = true
    return reply('*▢ STOP JPM BASIC*\n• Status : Menghentikan JPM Basic...')
}

handler.command = ['stopjpmbasic', 'stopjpmb']
handler.tags = ['jpm']
handler.owner = true

export default handler
