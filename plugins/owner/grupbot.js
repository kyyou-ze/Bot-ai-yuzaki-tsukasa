/**
 * Kaguya Multi Device — Owner
 * .grupbot — whitelist grup: hanya grup di daftar yang bisa memakai bot, walau mode self
 *
 *   .grupbot                   status + daftar perintah
 *   .grupbot on | off          aktif / nonaktifkan fitur
 *   .grupbot add [id|link]     masukkan grup ke daftar (tanpa argumen = grup ini)
 *   .grupbot del [id|link|no]  keluarkan dari daftar (tanpa argumen = grup ini)
 *   .grupbot list              lihat daftar grup
 */

import { getMeta } from '../../lib/platform/wa.js'
import { updateConfigValue } from '../../lib/core/file.js'
import { isGroupbotOn, isGroupAllowed, setGroupAllowed, listAllowedGroups } from '../../lib/core/data.js'

const GROUP_LINK = /chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
const GROUP_JID = /^[\d-]+@g\.us$/

// id / link grup -> { jid, name }
async function resolveGroup(sock, tok) {
    if (GROUP_JID.test(tok)) {
        const meta = await getMeta(sock, tok).catch(() => null)
        return { jid: tok, name: meta?.subject || '' }
    }
    const info = await sock.groupGetInviteInfo(tok.match(GROUP_LINK)[1])
    return { jid: info.id, name: info.subject || '' }
}

let handler = async (m, { sock, text, prefix, jid, reply }) => {
    const p = prefix || '.'
    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    const sub = (args[0] || '').toLowerCase()
    const rest = args.slice(1)
    const list = listAllowedGroups().sort((a, b) => a.at - b.at)

    const status = () => `Status: ${isGroupbotOn() ? '✅ ON' : '❌ OFF'}\nGrup terdaftar: *${list.length}*`

    try {
        if (!sub) {
            return reply(
                `*▢ GRUPBOT (WHITELIST GRUP)*\n${status()}\n\n` +
                `${p}grupbot on / off\n` +
                `${p}grupbot add [id|link]  (kosong = grup ini)\n` +
                `${p}grupbot del [id|link|no]\n` +
                `${p}grupbot list\n\n` +
                `Kalau ON: hanya grup di daftar yang dilayani, dan semua member grup itu boleh pakai bot walau mode self. Grup lain diabaikan (owner tetap bisa).`
            )
        }

        if (/^(on|aktif|1|true|off|mati|nonaktif|0|false)$/.test(sub)) {
            const on = /^(on|aktif|1|true)$/.test(sub)
            if (isGroupbotOn() === on) return reply(`･ﾟ✦ grupbot sudah ${on ? 'aktif' : 'nonaktif'}.`)
            global.grupbot = on
            const saved = updateConfigValue('grupbot', on)
            return reply(
                `･ﾟ✦ grupbot ${on ? 'diaktifkan' : 'dimatikan'}.` +
                (on
                    ? `\n⚠️ Sekarang bot hanya melayani grup di daftar (${list.length} grup). Tambah grup dengan ${p}grupbot add di grup tujuan.`
                    : '\nBot kembali mengikuti mode self / public biasa.') +
                (saved ? '' : '\n\n_Gagal menyimpan ke config.js, pengaturan kembali seperti semula setelah restart._')
            )
        }

        if (sub === 'list' || sub === 'daftar') {
            if (!list.length) return reply(`･ﾟ✦ Belum ada grup di daftar.\n${status()}\n\nTambah dengan ${p}grupbot add di grup tujuan.`)
            return reply(
                `*▢ DAFTAR GRUPBOT*\n${status()}\n\n` +
                list.map((g, i) => `${i + 1}. *${g.name || '(tanpa nama)'}*\n   ${g.jid}`).join('\n') +
                `\n\nHapus: ${p}grupbot del <no>`
            )
        }

        if (sub === 'add' || sub === 'tambah') {
            let target = { jid, name: '' }
            if (rest[0]) target = await resolveGroup(sock, rest[0]).catch(() => null)
            else if (!m.isGroup) return reply(`Pakai di dalam grup, atau sertakan id / link grup.\nContoh: ${p}grupbot add https://chat.whatsapp.com/xxxx`)
            if (!target || !GROUP_JID.test(target.jid)) return reply('Grup tidak ditemukan. Pastikan id (xxx@g.us) atau link grup benar.')
            if (!target.name && m.isGroup && target.jid === jid) target.name = (await getMeta(sock, jid).catch(() => null))?.subject || ''
            if (isGroupAllowed(target.jid)) return reply(`Grup${target.name ? ` *${target.name}*` : ''} sudah ada di daftar.\n${target.jid}`)
            setGroupAllowed(target.jid, true, target.name, m.sender)
            return reply(
                `✅ Grup${target.name ? ` *${target.name}*` : ''} ditambahkan ke daftar.\n${target.jid}\n\n` +
                (isGroupbotOn() ? 'Semua member grup ini sekarang bisa memakai bot.' : `Fitur masih OFF. Aktifkan dengan ${p}grupbot on`)
            )
        }

        if (sub === 'del' || sub === 'delete' || sub === 'hapus' || sub === 'remove') {
            let jidTarget = null
            if (rest[0]) {
                if (/^\d{1,3}$/.test(rest[0])) jidTarget = list[Number(rest[0]) - 1]?.jid
                else jidTarget = (await resolveGroup(sock, rest[0]).catch(() => null))?.jid
                if (!jidTarget) return reply(`Grup tidak ditemukan. Lihat nomor dengan ${p}grupbot list`)
            } else if (m.isGroup) jidTarget = jid
            else return reply(`Pakai di dalam grup, atau sertakan nomor / id / link grup.\nContoh: ${p}grupbot del 1`)
            if (!isGroupAllowed(jidTarget)) return reply('Grup itu tidak ada di daftar.')
            setGroupAllowed(jidTarget, false)
            return reply(`🗑 Grup dikeluarkan dari daftar.\n${jidTarget}`)
        }

        return reply(`Perintah tidak dikenal. Ketik ${p}grupbot untuk bantuan.`)
    } catch (e) {
        return reply(`[ ! ] ${e?.message || e}`)
    }
}

handler.command = ['grupbot']
handler.tags = ['owner']
handler.help = ['grupbot on|off', 'grupbot add [id|link]', 'grupbot del [id|link|no]', 'grupbot list']
handler.owner = true

export default handler
