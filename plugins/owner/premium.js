import { getMeta } from '../../lib/platform/wa.js'
import {
    resolveIds,
    phoneOf,
    pickTargetJid,
    parseDuration,
    formatRemaining,
    formatDate,
    addPremium,
    delPremium,
    listPremium,
    userOf
} from '../../lib/core/data.js'

// .addprem @user 30d   | .addprem 628xxx perm | (reply pesan) .addprem 7d
// .delprem @user       | .listprem
// Durasi: 12h (jam), 30d (hari), 2w (minggu), 1mo (bulan), 1y (tahun), perm (permanen).
// Menambah premium ke yang sudah premium = memperpanjang masa aktifnya.
// User premium dapat pengingat otomatis lewat chat pribadi saat sisa 3 hari dan 1 hari.

let handler = async (m, ctx) => {
    const { sock, text = '', command, jid, reply, example } = ctx

    if (command === 'listprem') {
        const rows = listPremium()
        if (!rows.length) return reply('Belum ada user premium.')
        const lines = rows.map((e, i) => `${i + 1}. +${e.label}\n   ${e.until === null ? 'permanen' : `${formatRemaining(e.until)} (sampai ${formatDate(e.until)})`}`)
        return reply(`*▢ USER PREMIUM* (${rows.length})\n\n${lines.join('\n')}`)
    }

    const meta = m.isGroup ? await getMeta(sock, jid).catch(() => null) : null
    const target = pickTargetJid(m, text)
    if (!target) return example(command === 'addprem' ? '@user 30d  (atau reply pesannya, atau 628xxx 30d)' : '@user  (atau reply pesannya, atau 628xxx)')

    const ids = await resolveIds(sock, target, meta)
    const label = (await phoneOf(sock, target, meta)) || userOf(target)
    const mention = { mentions: [target] }

    if (command === 'delprem') {
        return delPremium(ids)
            ? reply(`@${userOf(target)} bukan premium lagi.`, mention)
            : reply(`@${userOf(target)} memang tidak terdaftar premium.`, mention)
    }

    const dur = text.split(/\s+/).map(a => parseDuration(a)).find(Boolean)
    if (!dur) return reply('Durasi wajib diisi.\nContoh: 12h, 30d, 2w, 1mo, 1y, atau perm (permanen).\n\n' + `.addprem @user 30d`)

    const { entry, extended } = addPremium(ids, label, dur.ms, target)
    const until = entry.until === null ? 'permanen' : `${formatRemaining(entry.until)} (sampai ${formatDate(entry.until)})`
    return reply(`✅ @${userOf(target)} ${extended ? 'diperpanjang' : 'sekarang premium'}.\nMasa aktif: ${until}`, mention)
}

handler.command = ['premium', 'addprem', 'delprem', 'listprem']
handler.as = 'addprem'
handler.tags = ['owner']
handler.owner = true

export default handler
