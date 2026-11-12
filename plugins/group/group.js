import { getMeta, resolveTargets, botMember, botIsAdmin, memberId, waError } from '../../lib/platform/wa.js'
import { formatWib } from '../../lib/core/system.js'
import { matchPlugin, routeSub } from '../../lib/engine/plugins.js'

// .group <sub>  ->  menu manajemen grup dalam satu command
// info | open | close | lock | unlock | name | desc | link | revoke | add | kick | promote | demote
// Semua fitur plugin lain di folder plugins/group/ ikut jadi sub-command otomatis:
//   .group welcome on   .group warn @user   .group mute   .group tagall   .group enable antilink  dst.
// Plugin grup baru yang ditambah nanti langsung muncul di menu tanpa edit file ini.
// Tanpa sub-command (atau sub-command salah) tampil daftar menu.
// Command lama (.kick, .welcome, .warn, dst.) tetap jalan seperti biasa.

const ACTION = { kick: 'remove', promote: 'promote', demote: 'demote' }
const DONE = { remove: 'dikeluarkan dari grup', promote: 'dijadikan admin', demote: 'diturunkan dari admin' }
const ADD_STATUS = {
    200: '✅ berhasil ditambahkan',
    408: '⏳ baru saja keluar, belum bisa ditambahkan',
    409: 'ℹ️ sudah ada di grup',
    401: '⛔ memblokir nomor ini',
    403: '🔒 privasi dibatasi, undangan dikirim lewat chat pribadi',
    500: '⚠️ gagal ditambahkan'
}

const SELF = /(^|\/)group\/group\.js$/
const BUILTIN = ['info', 'open', 'close', 'lock', 'unlock', 'name', 'desc', 'link', 'revoke', 'add', 'kick', 'promote', 'demote']

// plugin lain di folder plugins/group/ (selain file ini), dibaca langsung dari plugin yang sedang termuat
const groupPlugins = () => Object.entries(global.plugins || {})
    .filter(([key, pl]) => typeof pl === 'function' && /(^|\/)group\//.test(key) && !SELF.test(key) && !pl.disabled && !(pl.command instanceof RegExp))
    .map(([, pl]) => pl)

const cmdsOf = (pl) => {
    const hidden = Array.isArray(pl.hide) ? pl.hide : []
    return [...new Set([].concat(pl.command || []).map(c => String(c).toLowerCase()))]
        .filter(c => c && c !== 'group' && !BUILTIN.includes(c) && !hidden.includes(c))
}

const menuText = (p) =>
`*GROUP MANAGEMENT*

• ${p}group info
• ${p}group open
• ${p}group close
• ${p}group lock
• ${p}group unlock
• ${p}group name <nama>
• ${p}group desc <deskripsi>
• ${p}group link
• ${p}group revoke
• ${p}group add <nomor/mention>
• ${p}group kick @user
• ${p}group promote @user
• ${p}group demote @user

Target bisa berupa mention, reply pesan, atau nomor dengan kode negara.`

const otherMenu = (p) => {
    const seen = new Set()
    const blocks = []
    for (const pl of groupPlugins()) {
        const cmds = cmdsOf(pl).filter(c => !seen.has(c))
        cmds.forEach(c => seen.add(c))
        if (cmds.length) blocks.push(cmds.map(c => `• ${p}group ${c}`).join('\n'))
    }
    return blocks.length ? `\n\n*FITUR GRUP LAINNYA*\n\n${blocks.join('\n\n')}\n\nContoh: ${p}group welcome on` : ''
}

let handler = async (m, ctx) => {
    const { sock, text, prefix, jid, isAdmin, isOwner, reply } = ctx
    const raw = String(text || '').trim()
    const sub = (raw.split(/\s+/)[0] || '').toLowerCase()
    const arg = raw.slice(sub.length).trim()
    const p = prefix || '.'

    if (!BUILTIN.includes(sub)) {
        // bukan bawaan: cari di plugin grup lain, lalu jalankan seolah dipanggil langsung (.welcome on)
        const target = sub && groupPlugins().find(pl => matchPlugin(pl, sub))
        if (!target) return reply(menuText(p) + otherMenu(p))

        const routed = routeSub(target, sub, arg)
        if (target.owner && !isOwner) return reply(global.mess.owner)
        if (target.premium && !ctx.isPremium) return reply(global.mess.premium)
        if (target.admin && !isAdmin && !isOwner) return reply(global.mess.admin)

        return target(m, {
            ...ctx,
            command: routed.command,
            text: routed.text,
            prefix: `${p}group `, // supaya bantuan plugin tampil sebagai ".group welcome on"
            example: (usage) => reply(`Format: ${p}group ${routed.command} ${usage}`)
        })
    }

    try {
        const meta = await getMeta(sock, jid, true)

        if (sub === 'info') {
            const admins = meta.participants.filter(x => x.admin)
            return reply(
`╭─▣「 *INFO GRUP* 」▣─╮
┃ ✦ Nama      : ${meta.subject}
┃ ✦ ID        : ${meta.id}
┃ ✦ Dibuat    : ${formatWib(meta.creation * 1000)}
┃ ✦ Pembuat   : ${meta.owner ? `@${memberId(meta.owner)}` : '-'}
┃ ✦ Member    : ${meta.participants.length}
┃ ✦ Admin     : ${admins.length}
┃ ✦ Chat      : ${meta.announce ? 'hanya admin' : 'semua member'}
┃ ✦ Edit info : ${meta.restrict ? 'hanya admin' : 'semua member'}
┃ ✦ Pesan sementara : ${meta.ephemeralDuration ? `${meta.ephemeralDuration / 86400} hari` : 'mati'}
╰─────────────➤

*Deskripsi*
${meta.desc || '-'}`,
                { mentions: meta.owner ? [meta.owner] : [] }
            )
        }

        // semua sub-command selain info khusus admin grup / owner
        if (!isAdmin && !isOwner) return reply(global.mess.admin)
        if (!botIsAdmin(sock, meta) && !m.fromMe) return reply('Jadikan bot admin dulu supaya perintah ini bisa dipakai.')

        if (sub === 'open') {
            await sock.groupSettingUpdate(jid, 'not_announcement')
            return reply('🔓 Grup dibuka, semua member bisa chat.')
        }
        if (sub === 'close') {
            await sock.groupSettingUpdate(jid, 'announcement')
            return reply('🔒 Grup ditutup, hanya admin yang bisa chat.')
        }
        if (sub === 'lock') {
            await sock.groupSettingUpdate(jid, 'locked')
            return reply('🔒 Info grup dikunci, hanya admin yang bisa mengubah nama, deskripsi, dan foto.')
        }
        if (sub === 'unlock') {
            await sock.groupSettingUpdate(jid, 'unlocked')
            return reply('🔓 Info grup dibuka, semua member bisa mengubah nama, deskripsi, dan foto.')
        }

        if (sub === 'name') {
            if (!arg) return reply(`Nama grup belum diisi.\n\nContoh: ${p}group name Nama Grup Baru`)
            await sock.groupUpdateSubject(jid, arg.slice(0, 100))
            return reply('Nama grup berhasil diubah.')
        }
        if (sub === 'desc') {
            if (!arg) return reply(`Deskripsi belum diisi.\n\nContoh: ${p}group desc Aturan grup...\n(ketik "hapus" untuk mengosongkan)`)
            await sock.groupUpdateDescription(jid, arg.toLowerCase() === 'hapus' ? '' : arg)
            return reply('Deskripsi grup berhasil diubah.')
        }

        if (sub === 'link') {
            const code = await sock.groupInviteCode(jid)
            return reply(`https://chat.whatsapp.com/${code}`)
        }
        if (sub === 'revoke') {
            const code = await sock.groupRevokeInvite(jid)
            return reply(`Link grup berhasil direset.\n\nhttps://chat.whatsapp.com/${code}`)
        }

        if (sub === 'add') {
            let numbers = [...new Set((arg.match(/\d{8,15}/g) || []).map(n => n.replace(/^0/, '62')))]
            if (!numbers.length && m.quoted?.sender) numbers = [memberId(m.quoted.sender)]
            if (!numbers.length) return reply(`Nomornya belum diisi.\n\nContoh: ${p}group add 628123456789`)

            const res = await sock.groupParticipantsUpdate(jid, numbers.map(n => `${n}@s.whatsapp.net`), 'add')
            const lines = []
            for (const r of res || []) {
                const status = Number(r.status)
                lines.push(`-▢ @${memberId(r.jid)} ${ADD_STATUS[status] || `kode ${status}`}`)
                if (status === 403) {
                    try {
                        const code = await sock.groupInviteCode(jid)
                        await sock.sendMessage(r.jid, { text: `Kamu diundang ke grup *${meta.subject || 'grup'}*:\nhttps://chat.whatsapp.com/${code}` })
                    } catch {}
                }
            }
            return reply(`*▢ TAMBAH MEMBER*\n${lines.join('\n')}`, { mentions: (res || []).map(r => r.jid) })
        }

        // kick / promote / demote
        const action = ACTION[sub]
        const me = botMember(sock, meta)
        const targets = resolveTargets(m, arg, meta)
            .filter(x => x.id !== me?.id && !(action === 'remove' && x.admin === 'superadmin'))
        if (!targets.length) return reply(`Targetnya belum ada.\n\nContoh: ${p}group ${sub} @user (atau reply pesannya)`)

        await sock.groupParticipantsUpdate(jid, targets.map(x => x.id), action)
        return reply(
            targets.map(x => `-▢ @${memberId(x.id)} ${DONE[action]}`).join('\n'),
            { mentions: targets.map(x => x.id) }
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['group']
handler.tags = ['group']
handler.group = true

export default handler
