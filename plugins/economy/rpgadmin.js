// Kelola limit & money RPG (khusus owner).
//   .addlimit @user 10     tambah        .addmoney @user 5k
//   .dellimit @user 5      kurangi       .delmoney @user 1m
//   .setlimit @user 50     set langsung  .setmoney @user 100000
//   .resetlimit @user      limit -> 20   .resetmoney @user     money -> 0
// Target: tag, reply pesan, atau nomor (628xxx). Tanpa target = diri sendiri (add/del/set).
// Jumlah boleh pakai singkatan: 5k = 5.000, 2m = 2.000.000, 1b = 1.000.000.000, 1t = 1 triliun.
// Reset semua user: .resetlimit all ya   |   .resetmoney all ya
import { saveDB, isLidJid } from '../../lib/core/system.js'
import { digits, userOf } from '../../lib/core/data.js'
import { rpgStore, toPN, makeDefaultUser } from '../../lib/engine/plugins.js'

const MAX = 1e15
const FIELDS = {
    limit: { label: 'Limit', icon: '🎫', reset: 20 },
    money: { label: 'Money', icon: '💹', reset: 0 }
}
const VERB = { add: 'ditambah', del: 'dikurangi', set: 'diatur', reset: 'direset' }
const SUFFIX = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }
const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('id-ID')

function parseAmount(tok) {
    const s = String(tok || '').trim().toLowerCase().replace(/^\+/, '')
    const mm = s.match(/^(\d+(?:[.,]\d+)*)([kmbt])?$/)
    if (!mm) return null
    const value = mm[2]
        ? parseFloat(mm[1].replace(',', '.')) * SUFFIX[mm[2]] // 1,5m / 1.5m
        : Number(mm[1].replace(/[.,]/g, ''))                  // 1.000 / 1,000 = seribu
    if (!Number.isFinite(value) || value < 0 || value > MAX) return null
    return Math.floor(value)
}

let handler = async (m, { sock, text, command, prefix, reply }) => {
    const [, op, field] = command.match(/^(add|del|set|reset)(limit|money)$/) || []
    if (!op) return
    const f = FIELDS[field]

    const tokens = String(text || '').split(/\s+/).filter(Boolean)
    const rest = tokens.filter(t => !t.startsWith('@'))
    let mentionJid = m.mentionedJid?.[0] || m.quoted?.sender || null
    let phoneJid = null
    let all = false

    if (!mentionJid && rest.length) {
        const first = rest[0]
        if (op === 'reset' && /^(all|semua)$/i.test(first)) {
            all = true
            rest.shift()
        } else if (/^\+?\d{9,15}$/.test(first) && (op === 'reset' || rest.length >= 2)) {
            // nomor telepon hanya dikenali kalau ada jumlah sesudahnya, supaya "1000000000" tidak dikira nomor
            phoneJid = `${digits(first).replace(/^0/, '62')}@s.whatsapp.net`
            rest.shift()
        }
    }

    // ─── reset semua user ───
    if (all) {
        if (!rest.some(t => /^(ya|yes|y)$/i.test(t))) {
            return reply(`⚠️ Ini akan me-reset ${f.label.toLowerCase()} *semua* user RPG menjadi ${fmt(f.reset)}.\nKetik: *${prefix}${command} all ya*`)
        }
        const users = Object.values(rpgStore().users)
        for (const u of users) u[field] = f.reset
        saveDB(global.db)
        return reply(`${f.icon} *${f.label} direset*\n\n${fmt(users.length)} user dikembalikan ke ${fmt(f.reset)}.`)
    }

    // ─── target & jumlah ───
    const target = mentionJid || phoneJid || (op === 'reset' ? null : m.sender)
    if (!target) {
        return reply(`Contoh:\n${prefix}${command} @user\n${prefix}${command} 628xxx\n${prefix}${command} all ya  (semua user)`)
    }

    let amount = 0
    if (op !== 'reset') {
        amount = rest.map(parseAmount).reverse().find(v => v !== null) // ambil angka TERAKHIR (nama tag boleh mengandung angka)
        if (amount === undefined || (amount === 0 && op !== 'set')) {
            return reply(`Jumlah ${f.label.toLowerCase()} tidak valid.\n\nContoh:\n${prefix}${command} @user 100\n${prefix}${command} 628xxx 5k\n${prefix}${command} 1000  (diri sendiri)\n\nSingkatan: k = ribu, m = juta, b = miliar, t = triliun`)
        }
    }

    const pn = await toPN(sock, target)
    if (isLidJid(pn)) return reply('Nomor user tidak bisa dikenali (ID tersembunyi). Pakai nomor teleponnya: .' + command + ' 628xxx jumlah')

    const users = rpgStore().users
    const user = users[pn] ||= makeDefaultUser(userOf(pn))
    if (!Number.isFinite(Number(user[field]))) user[field] = f.reset

    const before = Number(user[field])
    let after
    if (op === 'add') after = Math.min(MAX, before + amount)
    else if (op === 'del') after = Math.max(0, before - amount)
    else if (op === 'set') after = amount
    else after = f.reset
    user[field] = after
    saveDB(global.db)

    const mention = mentionJid || pn
    const diff = op === 'add' || op === 'del' ? `\nJumlah   : ${fmt(amount)}` : ''
    return reply(
        `${f.icon} *${f.label} ${VERB[op]}*\n\n` +
        `User     : @${userOf(mention)}${diff}\n` +
        `Sebelum  : ${fmt(before)}\n` +
        `Sesudah  : ${fmt(after)}`,
        { mentions: [mention] }
    )
}

handler.command = [
  'rpgadmin', 'addlimit', 'addmoney', 'dellimit', 'delmoney', 'resetlimit', 'resetmoney', 'setlimit',
  'setmoney'
]
handler.as = 'addlimit'
handler.help = ['rpgadmin addlimit <user> <jumlah>', 'rpgadmin dellimit <user> <jumlah>', 'rpgadmin setlimit <user> <jumlah>', 'rpgadmin resetlimit <user|all>', 'rpgadmin addmoney <user> <jumlah>', 'rpgadmin delmoney <user> <jumlah>', 'rpgadmin setmoney <user> <jumlah>', 'rpgadmin resetmoney <user|all>']
handler.tags = ['economy']
handler.owner = true

export default handler
