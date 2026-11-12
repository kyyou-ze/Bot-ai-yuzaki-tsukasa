/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Name         : Force Delete Message (.dmsg)
 *
 * Author       : Nixel | Ported by Mina
 * Note         : Bug dmsg without admin
 *
 * Penyesuaian  : SeaPRST
 * Taruh di     : plugins/owner/dmsg.js
 */

const handler = async (m, { sock, jid, isOwner }) => {
    // Cek owner
    if (!isOwner) return

    // Fungsi bantu react
    const react = async (emoji) => {
        try {
            await sock.sendMessage(jid, { react: { text: emoji, key: m.key } })
        } catch (e) {}
    }

    // Ambil pesan yang di-reply
    const q = m.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage || m.msg?.contextInfo?.quotedMessage

    if (!q) {
        return m.reply("Reply pesan nya sayang~ 📥")
    }

    // Ambil ID pesan target
    const stanzaId = q.id || q.key?.id || q.raw?.key?.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId || m.msg?.contextInfo?.stanzaId

    if (!stanzaId) {
        return m.reply("Gagal mengambil ID pesan yang direply.")
    }

    try {
        // 1. Kirim pesan kosong sementara (buka celah edit)
        const tempId = await sock.relayMessage(
            jid,
            {
                groupStatusMessageV2: {
                    message: {
                        extendedTextMessage: {
                            text: '',
                            contextInfo: {
                                isGroupStatus: true,
                            },
                        },
                    },
                },
            },
            {}
        )

        // 2. Kirim protocolMessage (edit) menimpa pesan target via stanzaId
        // Menggunakan karakter null (\0) untuk menghapus isi pesan
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
                            text: '\0',
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
        await react("✅")

    } catch (e) {
        console.error('[dmsg error]', e)
        await react("❌")
        await m.reply('❌ Error: ' + (e?.message || e))
    }
}

// ================= PLUGIN INFO =================
handler.help = ['dmsg']
handler.tags = ['owner']
handler.command = ['dmsg', 'del']
handler.owner = true

export default handler