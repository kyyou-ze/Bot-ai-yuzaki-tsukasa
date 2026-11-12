/**
 * Kaguya Multi Device — Sewa Bot
 * .addsewa — addsewa <durasi> [link/id grup] (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply, sendThumb } from '../../lib/store/merchant.js'
import { parseDuration, formatDate, sewaData, activateRental } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { GROUP_LINK, GROUP_JID, expireOrders, groupName, isMember } from '../../lib/store/sewa.js'

// ===== .addsewa <durasi> [link/id grup] (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const tokens = body.split(/\s+/).filter(Boolean)
        const dur = tokens.map(t => parseDuration(t)).find(Boolean)
        if (!dur) return reply(`Format: ${p}addsewa <durasi> [link / id grup]\nDurasi: 12h, 30d, 2w, 1mo, 1y, atau perm.\nContoh: ${p}addsewa 30d  (di grup ini)\n${p}addsewa perm https://chat.whatsapp.com/xxxx`)

        let target = null
        let name = ''
        const gTok = tokens.find(t => GROUP_LINK.test(t) || GROUP_JID.test(t))
        if (gTok && GROUP_LINK.test(gTok)) {
            const code = gTok.match(GROUP_LINK)[1]
            const info = await sock.groupGetInviteInfo(code).catch(() => null)
            if (!info) return reply('Link grup tidak valid atau sudah kedaluwarsa.')
            target = info.id
            name = info.subject || ''
            if (!(await isMember(sock, target))) {
                await sock.groupAcceptInvite(code).catch(e => { throw new Error(`Gagal bergabung ke grup: ${waError(e)}`) })
            }
        } else if (gTok) {
            target = gTok
            name = await groupName(sock, target)
        } else if (m.isGroup) {
            target = jid
            name = await groupName(sock, jid)
        } else {
            return reply('Pakai di dalam grup, atau sertakan link / id grup.')
        }

        const { rental, extended } = activateRental(target, dur.ms, { name, by: 'owner', plan: 'manual' })
        const until = rental.until === null ? 'permanen' : `sampai ${formatDate(rental.until)}`
        await sendThumb(sock, target, { text: `✅ *SEWA BOT ${extended ? 'DIPERPANJANG' : 'AKTIF'}*\n\n📅 Berlaku ${until}` }).catch(() => null)
        return reply(`✅ Sewa ${name || target} ${extended ? 'diperpanjang' : 'aktif'} (${until}).`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['addsewa']
handler.tags = ['sewa-bot']
handler.help = ['addsewa']
handler.owner = true

export default handler
