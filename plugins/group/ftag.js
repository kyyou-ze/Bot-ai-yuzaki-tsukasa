// .ftag @nanazx ganteng
// Fake tag: seperti tagall, tapi nama grup yang tampil bisa dicustom (dari kata setelah @).
import { generateMessageIDV2 } from '@whiskeysockets/baileys'
import { getMeta } from '../../lib/platform/wa.js'

let handler = async (m, { sock, jid, text, prefix, command, reply }) => {
    const input = String(text || '').trim()
    const match = input.match(/@(\S+)/)
    if (!match) return reply(`❌ Contoh: *${prefix || '.'}${command} @nanazx ganteng*`)

    const tag = match[1]
    const body = input.replace(match[0], `@${jid}`)

    const { participants } = await getMeta(sock, jid, true)

    await sock.relayMessage(
        jid,
        {
            extendedTextMessage: {
                text: body,
                contextInfo: {
                    mentionedJid: participants.map(p => p.id),
                    groupMentions: [{ groupJid: jid, groupSubject: tag }]
                }
            }
        },
        { messageId: generateMessageIDV2(sock.user.id) }
    )
}

handler.command = ['ftag']
handler.help = ['ftag @nama teks']
handler.tags = ['group']
handler.admin = true
handler.group = true
handler.owner = true

export default handler
