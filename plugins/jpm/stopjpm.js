let handler = async (m, { reply }) => {
    if (!global.__jpmRunning) return reply('❌ Tidak ada JPM yang sedang berjalan.')
    global.__jpmStop = true
    return reply('*▢ STOP JPM*\n• Status : Menghentikan proses JPM...')
}

handler.command = ['stopjpm', 'stopjasher', 'stopjaser']
handler.tags = ['jpm']
handler.owner = true

export default handler
