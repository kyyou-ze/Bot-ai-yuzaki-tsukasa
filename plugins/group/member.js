import { getMeta, resolveTargets, botMember, memberId, waError } from '../../lib/platform/wa.js'

const ACTION = { kick: 'remove', promote: 'promote', demote: 'demote' }
const DONE = { remove: 'dikeluarkan dari grup', promote: 'dijadikan admin', demote: 'diturunkan dari admin' }

const STATUS = {
    200: '✅ berhasil ditambahkan',
    408: '⏳ baru saja keluar, belum bisa ditambahkan',
    409: 'ℹ️ sudah ada di grup',
    401: '⛔ memblokir nomor ini',
    403: '🔒 privasi dibatasi, undangan dikirim lewat chat pribadi',
    500: '⚠️ gagal ditambahkan'
}

async function addMember(m, { sock, text, jid, reply, example }) {
    const numbers = [...new Set((String(text).match(/\d{8,15}/g) || []).map(n => n.replace(/^0/, '62')))]
    if (!numbers.length) return example('628123456789 628987654321')

    const res = await sock.groupParticipantsUpdate(jid, numbers.map(n => `${n}@s.whatsapp.net`), 'add')
    const meta = await getMeta(sock, jid, true).catch(() => null)
    const lines = []

    for (const r of res || []) {
        const status = Number(r.status)
        lines.push(`-▢ @${memberId(r.jid)} ${STATUS[status] || `kode ${status}`}`)
        if (status === 403) {
            try {
                const code = await sock.groupInviteCode(jid)
                await sock.sendMessage(r.jid, { text: `Kamu diundang ke grup *${meta?.subject || 'grup'}*:\nhttps://chat.whatsapp.com/${code}` })
            } catch {}
        }
    }

    return reply(`*▢ TAMBAH MEMBER*\n${lines.join('\n')}`, { mentions: (res || []).map(r => r.jid) })
}

let handler = async (m, ctx) => {
    const { sock, text, command, jid, reply, example } = ctx

    try {
        if (command === 'addmember') return await addMember(m, ctx)

        const action = ACTION[command]
        const meta = await getMeta(sock, jid, true)
        const me = botMember(sock, meta)

        const targets = resolveTargets(m, text, meta).filter(p => p.id !== me?.id && !(action === 'remove' && p.admin === 'superadmin'))
        if (!targets.length) return example('@user  (atau reply pesannya)')

        await sock.groupParticipantsUpdate(jid, targets.map(p => p.id), action)
        return reply(
            targets.map(p => `-▢ @${memberId(p.id)} ${DONE[action]}`).join('\n'),
            { mentions: targets.map(p => p.id) }
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['member', 'kick', 'addmember', 'demote', 'promote']
handler.as = 'kick'
handler.tags = ['group']
handler.group = true

export default handler
