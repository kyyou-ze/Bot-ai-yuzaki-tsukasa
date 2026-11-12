import { getGroupSetting, updateGroupSetting, isGroupAdmin, formatGroupText } from '../../lib/platform/wa.js'

// Notifikasi promote / demote admin grup
// .notifpromote on|off|set <teks>|reset|test
// .notifdemote  on|off|set <teks>|reset|test
const LABEL = { notifpromote: 'Notif Promote', notifdemote: 'Notif Demote' }
const TYPE = { notifpromote: 'promote', notifdemote: 'demote' }

let handler = async (m, { sock, text, command, prefix, jid, sender, isOwner, isAdmin, reply }) => {
    if (!isOwner && !isAdmin) {
        isAdmin = await isGroupAdmin(sock, jid, sender, m.sender, m.key?.participant, m.key?.participantAlt, m.key?.participantPn)
    }
    if (!isOwner && !isAdmin) return reply(global.mess.admin)

    const type = TYPE[command]
    const label = LABEL[command]
    const raw = (text || '').trim()
    const first = raw.split(/\s+/)[0] || ''
    const sub = first.toLowerCase()
    const value = raw.slice(first.length).trim()
    const setting = getGroupSetting(jid)[type]

    if (['on', 'aktif', 'enable'].includes(sub)) {
        updateGroupSetting(jid, type, { on: true })
        return reply(`*${label}* di grup ini berhasil diaktifkan.`)
    }
    if (['off', 'nonaktif', 'disable', 'mati'].includes(sub)) {
        updateGroupSetting(jid, type, { on: false })
        return reply(`*${label}* di grup ini berhasil dimatikan.`)
    }
    if (sub === 'set') {
        if (!value) return reply(`Teksnya belum diisi.\n\nContoh:\n${prefix}${command} set @user sekarang jadi admin di @group, oleh @author\n\nVariabel: @user @author @group @count @desc`)
        updateGroupSetting(jid, type, { text: value })
        return reply(`Teks *${label}* berhasil diubah.\n\n${value}\n\nKetik ${prefix}${command} test untuk melihat contoh hasilnya.`)
    }
    if (sub === 'reset') {
        updateGroupSetting(jid, type, { text: undefined })
        return reply(`Teks *${label}* dikembalikan ke bawaan.`)
    }
    if (sub === 'test') {
        const meta = await sock.groupMetadata(jid).catch(() => null)
        const preview = formatGroupText(setting.text, {
            user: `@${sender.split('@')[0]}`,
            author: `@${sender.split('@')[0]}`,
            group: meta?.subject || 'grup ini',
            count: meta?.participants?.length || '-',
            desc: meta?.desc
        })
        return sock.sendMessage(jid, { text: preview, mentions: [sender] }, { quoted: m })
    }

    return reply(
`╭─▣「 *${label.toUpperCase()}* 」▣─╮
│ Status : *${setting.on ? 'ON' : 'OFF'}*
│ Teks   : ${setting.custom ? 'custom' : 'bawaan'}
╰─────────────➤

${setting.text}

Perintah:
${prefix}${command} on
${prefix}${command} off
${prefix}${command} set <teks>
${prefix}${command} reset
${prefix}${command} test

Variabel teks: @user @author @group @count @desc
Khusus owner dan admin grup.`)
}

handler.command = ['notifpromote', 'notifdemote']
handler.tags = ['group']
handler.group = true

export default handler
