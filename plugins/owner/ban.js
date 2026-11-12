/**

* Kaguya Multi Device — WhatsApp & Tele Bot
*
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
*
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

import { getMeta } from '../../lib/platform/wa.js'
import {
    resolveIds,
    phoneOf,
    userOf,
    pickTargetJid,
    formatDate,
    isChatBanned,
    setChatBanned,
    addBannedUser,
    delBannedUser,
    listBannedUsers,
    listBannedChats
} from '../../lib/core/data.js'
import { isOwnerNumber } from '../../lib/core/system.js'

const GROUP_LINK = /chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
const GROUP_JID = /^[\d-]+@g\.us$/
const isGroupToken = (t) => GROUP_JID.test(t) || GROUP_LINK.test(t)

// link / id grup -> { jid, name }
async function resolveGroup(sock, tok) {
    if (GROUP_JID.test(tok)) {
        const meta = await getMeta(sock, tok).catch(() => null)
        return { jid: tok, name: meta?.subject || '' }
    }
    const info = await sock.groupGetInviteInfo(tok.match(GROUP_LINK)[1])
    return { jid: info.id, name: info.subject || '' }
}

async function banGroup(sock, reply, jid, name) {
    if (isChatBanned(jid)) return reply(`Grup ${name ? `*${name}* ` : ''}sudah di-ban.\n${jid}`)
    setChatBanned(jid, true, name)
    return reply(`🚫 Grup${name ? ` *${name}*` : ''} di-ban.\n${jid}\n\nBot mengabaikan semua orang di grup itu kecuali owner. Cabut dengan .delban`)
}

async function banUser(m, ctx, text) {
    const { sock, jid, reply, example } = ctx
    const target = pickTargetJid(m, text)
    if (!target) return example('@user alasan  (atau reply pesannya, atau 628xxx alasan)')

    const meta = m.isGroup ? await getMeta(sock, jid).catch(() => null) : null
    const ids = await resolveIds(sock, target, meta)
    const label = (await phoneOf(sock, target, meta)) || userOf(target)

    const me = userOf(sock.decodeJid ? sock.decodeJid(sock.user?.id) : sock.user?.id)
    if (ids.includes(me)) return reply('Tidak bisa mem-ban akun bot sendiri.')
    for (const id of [...ids, label]) if (await isOwnerNumber(sock, id)) return reply('Owner tidak bisa di-ban.')

    // alasan = sisa teks tanpa tag / nomor
    const reason = text.split(/\s+/).filter(t => t && !t.startsWith('@') && !/^\+?\d{8,15}$/.test(t)).join(' ')
    const { already } = addBannedUser(ids, label, reason, target)
    return reply(
        already
            ? `@${userOf(target)} sudah di-ban${reason ? ` (alasan diperbarui: ${reason})` : ''}.`
            : `🚫 @${userOf(target)} di-ban.${reason ? `\nAlasan: ${reason}` : ''}\n\nBot tidak akan merespon user ini. Cabut dengan .delban`,
        { mentions: [target] }
    )
}

async function showList(sock, reply, prefix) {
    const users = listBannedUsers()
    const groups = listBannedChats()
    if (!users.length && !groups.length) return reply('Tidak ada user atau grup yang di-ban.')

    for (const g of groups) {
        if (!g.name) g.name = (await getMeta(sock, g.jid).catch(() => null))?.subject || ''
    }

    let i = 0
    let out = `*▢ DAFTAR BAN*\n`
    out += `\n*User* (${users.length})\n`
    out += users.length
        ? users.map(u => `${++i}. +${u.label}${u.reason ? `\n   alasan: ${u.reason}` : ''}\n   sejak ${formatDate(u.at)}`).join('\n')
        : '-'
    out += `\n\n*Grup* (${groups.length})\n`
    out += groups.length ? groups.map(g => `${++i}. ${g.name || '(nama tidak diketahui)'}\n   ${g.jid}`).join('\n') : '-'
    out += `\n\nCabut ban: ${prefix}delban <nomor urut | nomor user | id grup>\nSemua: ${prefix}delban all ya`
    return reply(out)
}

async function removeBans(m, ctx, text) {
    const { sock, jid, reply, prefix, command } = ctx
    const tokens = text.split(/\s+/).filter(Boolean)

    if (tokens.some(t => /^(all|semua)$/i.test(t))) {
        if (!tokens.some(t => /^(ya|yes|y)$/i.test(t))) {
            return reply(`⚠️ Ini akan mencabut *semua* ban (user dan grup).\nKetik: *${prefix}${command} all ya*`)
        }
        const users = listBannedUsers()
        const groups = listBannedChats()
        for (const u of users) delBannedUser(u.ids)
        for (const g of groups) setChatBanned(g.jid, false)
        return reply(`✅ Semua ban dicabut (${users.length} user, ${groups.length} grup).`)
    }

    // daftar bernomor, urutannya sama dengan .listban (diambil sebelum ada yang dihapus)
    const users = listBannedUsers()
    const groups = listBannedChats()
    const done = []
    const miss = []

    const unbanUser = (u) => { delBannedUser(u.ids); done.push(`user +${u.label}`) }
    const unbanGroup = (g) => { setChatBanned(g.jid, false); done.push(`grup ${g.name || g.jid}`) }

    const mention = m.mentionedJid?.[0] || m.quoted?.sender
    if (mention && !tokens.some(t => /^\d{1,3}$/.test(t) || isGroupToken(t))) {
        const meta = m.isGroup ? await getMeta(sock, jid).catch(() => null) : null
        const ids = await resolveIds(sock, mention, meta)
        const hit = users.find(u => u.ids?.some(i => ids.includes(i)))
        hit ? unbanUser(hit) : miss.push(`@${userOf(mention)}`)
    } else {
        for (const tok of tokens) {
            if (/^\d{1,3}$/.test(tok)) {
                const n = Number(tok)
                const item = n >= 1 && n <= users.length ? { u: users[n - 1] } : n > users.length && n <= users.length + groups.length ? { g: groups[n - users.length - 1] } : null
                if (!item) miss.push(`no. ${tok}`)
                else if (item.u) unbanUser(item.u)
                else unbanGroup(item.g)
            } else if (isGroupToken(tok)) {
                try {
                    const { jid: gjid } = await resolveGroup(sock, tok)
                    const g = groups.find(x => x.jid === gjid)
                    g ? unbanGroup(g) : miss.push(`grup ${tok}`)
                } catch {
                    miss.push(`grup ${tok}`)
                }
            } else if (/^\+?\d{8,15}$/.test(tok)) {
                const num = tok.replace(/\D/g, '').replace(/^0/, '62')
                const hit = users.find(u => u.ids?.includes(num) || u.label === num)
                hit ? unbanUser(hit) : miss.push(`+${num}`)
            }
        }
    }

    if (!done.length && !miss.length) {
        return reply(`Contoh:\n${prefix}${command} 1  (nomor dari ${prefix}listban)\n${prefix}${command} 628xxx\n${prefix}${command} @user\n${prefix}${command} <link / id grup>\n${prefix}${command} all ya`)
    }
    return reply(
        (done.length ? `✅ Ban dicabut:\n${done.map(d => `• ${d}`).join('\n')}` : '') +
        (miss.length ? `${done.length ? '\n\n' : ''}⚠️ Tidak ditemukan di daftar ban:\n${miss.map(d => `• ${d}`).join('\n')}` : '')
    )
}

let handler = async (m, ctx) => {
    const { sock, command, jid, reply, prefix } = ctx
    const text = String(ctx.text || '').trim()

    if (command === 'listban') return showList(sock, reply, prefix)
    if (command === 'delban' || command === 'unban') return removeBans(m, ctx, text)

    // ban grup: .bangc, atau .ban dengan link / id grup
    const gTok = text.split(/\s+/).find(isGroupToken)
    if (command === 'bangc' || gTok) {
        try {
            if (gTok) {
                const g = await resolveGroup(sock, gTok)
                return banGroup(sock, reply, g.jid, g.name)
            }
            if (!m.isGroup) return reply(`Pakai di dalam grup, atau sertakan link / id grup.\nContoh: ${prefix}${command} https://chat.whatsapp.com/xxxx`)
            const meta = await getMeta(sock, jid).catch(() => null)
            return banGroup(sock, reply, jid, meta?.subject || '')
        } catch {
            return reply('Link grup tidak valid atau bot belum join.')
        }
    }

    return banUser(m, ctx, text)
}

handler.command = ['ban', 'bangc', 'banuser', 'delban', 'listban', 'unban']
handler.help = ['ban <user|link grup>', 'ban bangc', 'ban listban', 'ban delban <no|user|grup>']
handler.tags = ['owner']
handler.owner = true

export default handler
