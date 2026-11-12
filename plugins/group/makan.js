// Notif makan grup: bot mengingatkan jam sarapan, makan siang, dan makan malam (WIB) di grup ini.
// Data per grup: global.db.groups[jid].notifmakan (database/bot.json). Switch on/off juga ada di .enable notifmakan / .disable notifmakan (plugins/group/guard.js).
// .makan (status) • .makan on/off • .makan set <sarapan|siang|malam> <jam> • .makan hapus <waktu> • .makan tes
import { B, MEAL_DEFAULT, MEAL_LABEL, mealText } from '../../lib/core/data.js'
import { saveDB } from '../../lib/core/system.js'

const KINDS = { sarapan: 'sarapan', pagi: 'sarapan', siang: 'siang', malam: 'malam' }
const parseJam = (s) => {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s || '').trim())
    if (!m || +m[1] > 23 || +m[2] > 59) return null
    return `${m[1].padStart(2, '0')}:${m[2]}`
}

let handler = async (m, { text, prefix, jid, reply, isAdmin, isOwner }) => {
    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    const sub = (args[0] || 'status').toLowerCase()
    const group = ((global.db.groups ||= {})[jid] ||= {})
    const cfg = (group.notifmakan ||= { on: false })
    const times = () => (cfg.times ||= { ...MEAL_DEFAULT })
    const save = () => saveDB(global.db)
    const jadwal = () => Object.keys(MEAL_DEFAULT).map(k => `${(cfg.times || MEAL_DEFAULT)[k] ? '◆' : '◇'} ${MEAL_LABEL[k]} : ${(cfg.times || MEAL_DEFAULT)[k] ? (cfg.times || MEAL_DEFAULT)[k] + ' WIB' : 'mati'}`).join('\n')

    if (['status', 'cek', 'info'].includes(sub)) {
        return reply(`☾ ${B('NOTIF MAKAN GRUP')}\nStatus: *${cfg.on ? 'AKTIF' : 'MATI'}*\n\n${jadwal()}\n\n_${prefix}makan tes • Admin: ${prefix}makan on/off • ${prefix}makan set <waktu> <jam> • ${prefix}makan hapus <waktu>_`)
    }
    if (['tes', 'test', 'coba'].includes(sub)) {
        return reply(mealText(KINDS[(args[1] || 'siang').toLowerCase()] || 'siang'))
    }

    // sisanya mengubah pengaturan grup: khusus admin
    if (!isAdmin && !isOwner) return reply(global.mess.admin)

    if (['on', 'aktif', 'nyala'].includes(sub)) {
        cfg.on = true; times(); save()
        return reply(`✓ Notif makan ${B('AKTIF')} di grup ini.\n\n${jadwal()}\n\n_Ubah jam: ${prefix}makan set siang 12:30_`)
    }
    if (['off', 'mati', 'nonaktif'].includes(sub)) {
        cfg.on = false; save()
        return reply('Notif makan grup dimatikan. Aktifkan lagi dengan .makan on')
    }
    if (sub === 'set') {
        const kind = KINDS[(args[1] || '').toLowerCase()], jam = parseJam(args[2])
        if (!kind || !jam) return reply(`✕ Format salah.\nContoh: ${prefix}makan set siang 12:30\nWaktu: sarapan, siang, malam`)
        times()[kind] = jam
        cfg.sent = { ...cfg.sent, [kind]: '' }
        save()
        return reply(`✓ ${MEAL_LABEL[kind]} diatur jam *${jam} WIB*.${cfg.on ? '' : `\n_Notif masih mati, nyalakan: ${prefix}makan on_`}`)
    }
    if (['hapus', 'del', 'skip'].includes(sub)) {
        const kind = KINDS[(args[1] || '').toLowerCase()]
        if (!kind) return reply(`✕ Pilih waktu: sarapan, siang, atau malam.\nContoh: ${prefix}makan hapus sarapan`)
        delete times()[kind]; save()
        return reply(`✓ Notif ${MEAL_LABEL[kind]} dihapus. Kembalikan: ${prefix}makan set ${kind} ${MEAL_DEFAULT[kind]}`)
    }
    return reply(`✕ Perintah tidak dikenal. Ketik ${prefix}makan untuk melihat status.`)
}

handler.command = ['makan', 'jadwalmakan']
handler.help = ['makan']
handler.tags = ['group']
handler.group = true

export default handler
