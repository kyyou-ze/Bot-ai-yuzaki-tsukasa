import { getGroupSetting, updateGroupSetting, isGroupAdmin, formatGroupText } from '../../lib/platform/wa.js'

const LABEL = { welcome: 'Welcome', goodbye: 'Goodbye' }

let handler = async (m, { sock, text, command, prefix, jid, sender, isOwner, isAdmin, reply }) => {
    if (!isOwner && !isAdmin) {
        isAdmin = await isGroupAdmin(sock, jid, sender, m.sender, m.key?.participant, m.key?.participantAlt, m.key?.participantPn)
    }
    if (!isOwner && !isAdmin) return reply(global.mess.admin)

    const raw = (text || '').trim()
    let type, sub, value

    if (command === 'setwelcome' || command === 'setgoodbye') {
        type = command === 'setwelcome' ? 'welcome' : 'goodbye'
        sub = 'set'
        value = raw
    } else {
        type = command
        const first = raw.split(/\s+/)[0] || ''
        sub = first.toLowerCase()
        value = raw.slice(first.length).trim()
    }

    const label = LABEL[type]
    const setting = getGroupSetting(jid)[type]

    if (['on', 'aktif', 'enable'].includes(sub)) {
        updateGroupSetting(jid, type, { on: true })
        return reply(`Fitur *${label}* di grup ini berhasil diaktifkan.`)
    }

    if (['off', 'nonaktif', 'disable', 'mati'].includes(sub)) {
        updateGroupSetting(jid, type, { on: false })
        return reply(`Fitur *${label}* di grup ini berhasil dimatikan.`)
    }

    if (sub === 'set') {
        if (!value) {
            return reply(`Teksnya belum diisi.\n\nContoh:\n${prefix}${type} set Halo @user, selamat datang di @group!\n\nVariabel: @user @group @count @desc`)
        }
        updateGroupSetting(jid, type, { text: value })
        return reply(`Teks *${label}* berhasil diubah.\n\n${value}\n\nKetik ${prefix}${type} test untuk melihat contoh hasilnya.`)
    }

    if (sub === 'reset') {
        updateGroupSetting(jid, type, { text: undefined })
        return reply(`Teks *${label}* dikembalikan ke bawaan.`)
    }

    if (sub === 'test') {
        const preview = formatGroupText(setting.text, {
            user: `@${sender.split('@')[0]}`,
            group: (await sock.groupMetadata(jid).catch(() => null))?.subject || 'grup ini',
            count: '1',
            desc: '-'
        })
        return sock.sendMessage(jid, { text: preview, mentions: [sender] }, { quoted: m })
    }

    return reply(
`╭─▣「 *${label.toUpperCase()} GRUP* 」▣─╮
│ Status : *${setting.on ? 'ON' : 'OFF'}*
│ Teks   : ${setting.custom ? 'custom' : 'bawaan'}
╰─────────────➤

${setting.text}

Perintah:
${prefix}${type} on
${prefix}${type} off
${prefix}${type} set <teks>
${prefix}${type} reset
${prefix}${type} test

Variabel teks: @user @group @count @desc
Khusus owner dan admin grup.`)
}

handler.command = ['welcome', 'goodbye', 'setgoodbye', 'setwelcome']
handler.tags = ['group']
handler.group = true

export default handler
