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
import { resolveIds, findPremium, formatRemaining, formatDate } from '../../lib/core/data.js'

let handler = async (m, { sock, jid, sender, isOwner, reply }) => {
    if (isOwner) return reply('Kamu owner, otomatis punya akses premium tanpa batas waktu.')

    const meta = m.isGroup ? await getMeta(sock, jid).catch(() => null) : null
    const ids = await resolveIds(sock, [sender, m.key.participantAlt, m.key.participantPn], meta)
    const hit = findPremium(ids)
    if (!hit) return reply('Kamu belum premium.')

    const { until } = hit[1]
    return reply(until === null ? '✅ Kamu premium permanen.' : `✅ Kamu premium.\nSisa: ${formatRemaining(until)}\nSampai: ${formatDate(until)}`)
}

handler.command = ['cekprem']
handler.tags = ['main']

export default handler
