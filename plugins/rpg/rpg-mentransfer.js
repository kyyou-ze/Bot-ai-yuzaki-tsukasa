import { adapt } from '../../lib/engine/plugins.js'

// alias -> { field data user, label }
const ITEMS = {
    money: { field: 'money', label: 'Uang' },
    uang: { field: 'money', label: 'Uang' },
    tabungan: { field: 'atm', label: 'Uang Bank (ATM)' },
    atm: { field: 'atm', label: 'Uang Bank (ATM)' },
    limit: { field: 'limit', label: 'Limit' },
    potion: { field: 'potion', label: 'Potion' },
    sampah: { field: 'trash', label: 'Sampah' },
    trash: { field: 'trash', label: 'Sampah' },
    diamond: { field: 'diamond', label: 'Diamond' },
    common: { field: 'common', label: 'Common Crate' },
    uncommon: { field: 'uncommon', label: 'Uncommon Crate' },
    mythic: { field: 'mythic', label: 'Mythic Crate' },
    legendary: { field: 'legendary', label: 'Legendary Crate' },
    string: { field: 'string', label: 'String' },
    batu: { field: 'rock', label: 'Batu' },
    rock: { field: 'rock', label: 'Batu' },
    kayu: { field: 'wood', label: 'Kayu' },
    wood: { field: 'wood', label: 'Kayu' },
    iron: { field: 'iron', label: 'Iron' }
}

const MAX_COUNT = 9999999

let handler = async (m, { conn, args, usedPrefix }) => {
    const usage = `Contoh: *${usedPrefix}transfer money 100 @tag*\n\n*List Yang Bisa Di Transfer :*\n•》Money\n• Tabungan\n• Limit\n• Potion\n• Sampah\n• Diamond\n• Common\n• Uncommon\n• Mythic\n• Legendary\n• String\n• Kayu\n• Batu\n• Iron`
    if (args.length < 3) return conn.reply(m.chat, usage, m)

    const item = ITEMS[(args[0] || '').toLowerCase()]
    if (!item) return conn.reply(m.chat, usage, m)

    const count = Math.floor(Number(args[1]))
    if (!Number.isFinite(count) || count < 1) return conn.reply(m.chat, 'Jumlah harus berupa angka minimal 1.', m)
    if (count > MAX_COUNT) return conn.reply(m.chat, `Maksimal sekali transfer ${MAX_COUNT.toLocaleString('id-ID')}.`, m)

    const digits = String(args[2] || '').replace(/\D/g, '')
    const who = (m.mentionedJid && m.mentionedJid[0]) || (digits ? digits + '@s.whatsapp.net' : null)
    if (!who) return conn.reply(m.chat, 'Tag salah satu orang, atau ketik nomornya!', m)
    if (who === m.sender) return conn.reply(m.chat, 'Tidak bisa transfer ke diri sendiri.', m)

    const users = global.db.data.users
    const target = users[who]
    if (!target) return conn.reply(m.chat, 'Target belum pernah memakai bot, suruh dia kirim command apa saja dulu.', m)

    const me = users[m.sender]
    if (!(Number(me[item.field]) >= count)) {
        return conn.reply(m.chat, `${item.label} kamu tidak cukup untuk mentransfer ${count.toLocaleString('id-ID')}.`, m)
    }

    me[item.field] = Number(me[item.field]) - count
    target[item.field] = (Number(target[item.field]) || 0) + count

    return conn.reply(m.chat, `Berhasil mentransfer ${count.toLocaleString('id-ID')} ${item.label} ke @${who.split('@')[0]}`, m, { mentions: [who] })
}

handler.help = ['rpg-mentransfer']
handler.tags = ['rpg']
handler.command = ['rpg-mentransfer']
handler.group = true

export default adapt(handler, { category: 'rpg' })
