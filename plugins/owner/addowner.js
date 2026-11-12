import { getMeta } from '../../lib/platform/wa.js'
import { getOwners } from '../../lib/core/system.js'
import { resolveIds, phoneOf, pickTargetJid, digits, userOf, addDbOwner, delDbOwner, dbOwners } from '../../lib/core/data.js'

// .addowner @user | .addowner 628xxx | (reply) .addowner
// .delowner ...   | .listowner
// Owner tambahan disimpan di database (bukan config.js). Owner di config.js hanya bisa
// dihapus lewat config.js. addowner / delowner hanya boleh dipakai owner utama (config.js)
// atau akun bot sendiri, supaya owner tambahan tidak bisa mengangkat owner lain.

const configOwners = () => [...(Array.isArray(global.owners) ? global.owners : []), global.nomorbot].map(digits).filter(Boolean)

async function isRoot(sock, m, sender, meta) {
    if (m.fromMe && !sock.isJadiBot) return true // akun bot utama; pemilik nomor jadibot tidak dihitung
    const ids = await resolveIds(sock, [sender, m.key.participantAlt, m.key.participantPn], meta)
    return ids.some(i => configOwners().includes(i))
}

let handler = async (m, ctx) => {
    const { sock, text = '', command, jid, sender, reply, example } = ctx

    if (command === 'listowner') {
        const main = [...new Set(configOwners())]
        const extra = dbOwners()
        return reply(
            `*▢ OWNER*\n\n*Utama (config.js)*\n${main.map(n => `-▢ +${n}`).join('\n') || '-'}\n\n` +
            `*Tambahan (.addowner)*\n${extra.map(n => `-▢ +${n}`).join('\n') || '-'}`
        )
    }

    const meta = m.isGroup ? await getMeta(sock, jid).catch(() => null) : null
    if (!(await isRoot(sock, m, sender, meta))) return reply('Hanya owner utama (config.js) yang boleh mengatur owner.')

    const target = pickTargetJid(m, text)
    if (!target) return example('@user  (atau reply pesannya, atau 628xxx)')

    const phone = await phoneOf(sock, target, meta)
    if (!phone) return reply('Nomor orang ini tidak bisa dibaca dari mention. Ketik nomornya langsung, contoh: 628123456789')

    const mention = { mentions: [target] }

    if (command === 'addowner') {
        if (getOwners().map(digits).includes(phone)) return reply(`+${phone} sudah menjadi owner.`)
        addDbOwner(phone)
        return reply(`✅ +${phone} sekarang owner.\nAktif tanpa restart dan tersimpan di database.`, mention)
    }

    // delowner
    if (configOwners().includes(phone)) return reply(`+${phone} owner utama dari config.js. Hapus lewat config.js, bukan lewat command.`)
    if (!delDbOwner(phone)) return reply(`+${phone} bukan owner tambahan.`)

    // cabut juga LID yang sudah tersimpan, kalau tidak dia tetap dikenali sebagai owner sampai restart
    const lids = new Set([target.endsWith('@lid') ? userOf(target) : null])
    try {
        const lid = await sock.signalRepository?.lidMapping?.getLIDForPN?.(`${phone}@s.whatsapp.net`)
        if (lid) lids.add(userOf(lid))
    } catch {}
    global.lidowners = (global.lidowners || []).filter(l => !lids.has(l))

    return reply(`✅ +${phone} bukan owner lagi.`, mention)
}

handler.command = ['addowner', 'delowner', 'listowner']
handler.tags = ['owner']
handler.owner = true

export default handler
