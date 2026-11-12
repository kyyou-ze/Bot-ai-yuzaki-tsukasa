/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Name         : Fake Message Edit (.fmsg)
 *
 * Author       : Nixel | Ported by Mina
 * Note         : Bug edit other's message
 *
 * Penyesuaian  : SeaPRST
 * Taruh di     : plugins/owner/fmsg.js
 */

const handler = async (m, { sock, jid, isOwner }) => {
    // Cek owner
    if (!isOwner) return

    // Fungsi bantu buat react (antisipasi m.react gak ada)
    const react = async (emoji) => {
        try {
            await sock.sendMessage(jid, { react: { text: emoji, key: m.key } })
        } catch (e) {}
    }

    // Ambil pesan yang di-reply
    const q = m.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage || m.msg?.contextInfo?.quotedMessage

    if (!q) {
        return m.reply("Reply pesan nya, dan masukan text nya")
    }

    // Ambil teks pengganti
    // Bersihin prefix command dari teks
    let rawText = m.text || m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || ''
    let text = rawText.replace(/^[^\w\s]*(fmsg|fakemsg)\s*/i, '').trim()

    if (!text) {
        return m.reply("Mana text ganti nya? Contoh: .fmsg hai")
    }

    // Ambil ID pesan target
    const stanzaId = q.id || q.key?.id || q.raw?.key?.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId || m.msg?.contextInfo?.stanzaId

    if (!stanzaId) {
        return m.reply("Gagal mengambil ID pesan yang direply.")
    }

    try {
        // 1. Kirim pesan kosong sementara
        const tempId = await sock.relayMessage(
            jid,
            {
                extendedTextMessage: {
                    text: '',
                    contextInfo: {
                        isGroupStatus: true,
                    },
                },
            },
            {}
        )

        // 2. Kirim protocolMessage (edit) buat nimpa pesan target
        const tempId2 = await sock.relayMessage(
            jid,
            {
                protocolMessage: {
                    key: {
                        jid: jid,
                        fromMe: true,
                        id: tempId,
                    },
                    type: 14, // 14 = MESSAGE_EDIT
                    editedMessage: {
                        extendedTextMessage: {
                            text: text,
                            contextInfo: {
                                isGroupStatus: false,
                            },
                        },
                    },
                },
            },
            {
                messageId: stanzaId,
            }
        )

        // 3. Bersihkan pesan sementara
        await Promise.allSettled([
            sock.sendMessage(jid, {
                delete: {
                    remoteJid: jid,
                    id: tempId,
                    fromMe: true,
                },
            }),
            sock.sendMessage(jid, {
                delete: {
                    remoteJid: jid,
                    id: tempId2,
                    fromMe: true,
                },
            }),
        ])

        // Kasih reaction sukses
        await react("")

    } catch (e) {
        console.error('[fmsg error]', e)
        await react("")
        await m.reply(' Error: ' + (e?.message || e))
    }
}

// ================= PLUGIN INFO =================
handler.help = ['fmsg <text>']
handler.tags = ['owner']
handler.command = ['fmsg', 'fakemsg']
handler.owner = true // Hanya owner yang bisa pake

export default handler