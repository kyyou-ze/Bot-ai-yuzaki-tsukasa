import { jpmBlacklist, jpmSetBlacklist } from '../../lib/group/sosial.js'

// .blacklistjpm list | add [jid,jid] | del [jid,jid]   (tanpa jid = grup tempat perintah dipakai)
let handler = async (m, { sock, text, prefix, command, reply }) => {
    const [act = '', ...rest] = String(text || '').trim().split(/\s+/)
    const action = act.toLowerCase()
    let list = jpmBlacklist(false)
    const jids = rest.join('').split(',').map(v => v.trim()).filter(v => v.endsWith('@g.us'))
    const targets = jids.length ? jids : (m.isGroup ? [m.chat] : [])

    if (action === 'add') {
        if (!targets.length) return reply('❌ Tulis JID grup (berakhiran @g.us), atau pakai perintah ini di dalam grup.')
        const baru = targets.filter(j => !list.includes(j))
        jpmSetBlacklist(false, [...list, ...baru])
        return reply(`*▢ BLACKLIST JPM*\n• Ditambah : ${baru.length} grup\n• Sudah ada : ${targets.length - baru.length} grup\n• Total : ${list.length + baru.length} grup`)
    }
    if (['del', 'remove', 'hapus'].includes(action)) {
        if (!targets.length) return reply('❌ Tulis JID grup (berakhiran @g.us), atau pakai perintah ini di dalam grup.')
        const sisa = list.filter(j => !targets.includes(j))
        jpmSetBlacklist(false, sisa)
        return reply(`*▢ BLACKLIST JPM*\n• Dihapus : ${list.length - sisa.length} grup\n• Sisa : ${sisa.length} grup`)
    }
    if (action === 'list' || command.includes('list')) {
        if (!list.length) return reply('*▢ BLACKLIST JPM*\n• Belum ada grup di blacklist')
        const rows = []
        for (const [i, id] of list.entries()) {
            const meta = await sock.groupMetadata(id).catch(() => null)
            rows.push(`${i + 1}. ${meta?.subject || 'Grup tidak dikenal'}\n   ${id}`)
        }
        return reply(`*▢ BLACKLIST JPM*\n• Total : ${list.length} grup\n\n${rows.join('\n')}`)
    }
    return reply(`*▢ BLACKLIST JPM*\n\nGrup di blacklist tidak menerima JPM.\n\n• ${prefix}${command} list\n• ${prefix}${command} add <jid1>,<jid2>\n• ${prefix}${command} del <jid1>,<jid2>\n\nTanpa jid, perintah berlaku untuk grup tempat dipakai.\n• Total saat ini : ${list.length} grup`)
}

handler.command = ['blacklistjpm', 'bljpm', 'jpmbl', 'jpmblacklist', 'listblacklistjpm']
handler.tags = ['jpm']
handler.owner = true

export default handler
