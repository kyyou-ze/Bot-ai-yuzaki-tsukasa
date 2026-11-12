/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Name         : Stealth Personal Reply (.spr)
 *
 * Penyesuaian  : SeaPRST
 * Taruh di     : plugins/group/spr.js
 */

import {
    encodeWAMessage,
    encodeSignedDeviceIdentity,
    jidDecode
} from '@whiskeysockets/baileys'

const MAKS_TARGET = 100
const TEKS_DEFAULT = 'Halo @user, ada pesan untukmu.'

const num = jid => {
    try {
        return jidDecode(jid)?.user || String(jid).split('@')[0].split(':')[0]
    } catch {
        return String(jid).split('@')[0].split(':')[0]
    }
}

const norm = jid => {
    const n = num(jid)
    return n ? `${n}${String(jid).includes('@lid') ? '@lid' : '@s.whatsapp.net'}` : ''
}

async function denganBatas(promise, ms, nilai) {
    let timer
    const batas = new Promise(resolve => {
        timer = setTimeout(() => resolve(nilai), ms)
        timer.unref?.()
    })

    try {
        return await Promise.race([promise, batas])
    } finally {
        clearTimeout(timer)
    }
}

async function anggota(conn, groupJid) {
    const meta = await conn.groupMetadata(groupJid)

    const me = new Set([
        conn.user?.id,
        conn.user?.lid,
        conn.authState?.creds?.me?.id,
        conn.authState?.creds?.me?.lid
    ].filter(Boolean).map(num))

    const semua = (meta.participants || []).filter(
        p => p?.id && !me.has(num(p.id))
    )

    const rank = p =>
        p.admin === 'superadmin' ? 0 :
        p.admin === 'admin' ? 1 : 2

    const target = [...semua]
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, MAKS_TARGET)

    return { meta, target }
}

async function devicesFor(conn, jids) {
    let devices = []

    try {
        if (conn.getUSyncDevices) {
            devices = await conn.getUSyncDevices(jids, true, false) || []
        }
    } catch {}

    if (!devices.length) {
        devices = jids.map(jid => ({ jid }))
    }

    return devices.filter(d =>
        d?.jid &&
        !d.jid.endsWith('@hosted.lid') &&
        jidDecode(d.jid)?.device !== 99
    )
}

async function devicesAman(conn, jids) {
    const fallback = jids.map(jid => ({ jid }))

    try {
        const hasil = await denganBatas(
            devicesFor(conn, jids),
            9000,
            null
        )

        return hasil?.length ? hasil : fallback

    } catch {
        return fallback
    }
}

function pesanPersonal(text, mentions = []) {
    return {
        extendedTextMessage: {
            text,
            contextInfo: {
                ...(mentions.length ? { mentionedJid: mentions } : {})
            }
        }
    }
}

async function kirimStanza(conn, groupJid, meta, { publicText, perDevice }) {
    const meId = conn.authState?.creds?.me?.lid || conn.user?.id
    const isLid = meta?.addressingMode === 'lid'
    let withDeviceIdentity = false

    const nodes = (
        await Promise.all(
            perDevice.map(async ({ jid, message }) => {
                try {
                    const bytes = encodeWAMessage(message)
                    const { type, ciphertext } = await conn.signalRepository.encryptMessage({
                        jid,
                        data: bytes
                    })

                    if (type === 'pkmsg') {
                        withDeviceIdentity = true
                    }

                    return {
                        tag: 'to',
                        attrs: { jid },
                        content: [{
                            tag: 'enc',
                            attrs: { v: '2', type },
                            content: ciphertext
                        }]
                    }
                } catch {
                    return null
                }
            })
        )
    ).filter(Boolean)

    if (!nodes.length) {
        return {
            ok: false,
            error: 'Enkripsi per penerima gagal semua. Coba lagi.'
        }
    }

    let groupCiphertext = null

    if (publicText != null) {
        const bytes = encodeWAMessage({
            extendedTextMessage: {
                text: publicText,
                contextInfo: { mentionedJid: [] }
            }
        })

        const enc = await conn.signalRepository.encryptGroupMessage({
            group: groupJid,
            meId,
            data: bytes
        })

        groupCiphertext = enc?.ciphertext || null
    }

    const content = []

    if (groupCiphertext) {
        content.push({
            tag: 'enc',
            attrs: { v: '2', type: 'skmsg' },
            content: groupCiphertext
        })
    }

    content.push({
        tag: 'participants',
        attrs: {},
        content: nodes
    })

    if (withDeviceIdentity && conn.authState?.creds?.account) {
        content.push({
            tag: 'device-identity',
            attrs: {},
            content: encodeSignedDeviceIdentity(conn.authState.creds.account, true)
        })
    }

    await conn.query({
        tag: 'message',
        attrs: {
            to: groupJid,
            type: 'text',
            ...(isLid ? { addressing_mode: 'lid' } : {})
        },
        content
    })

    return {
        ok: true,
        count: nodes.length
    }
}

// ================= HANDLER =================
const handler = async (m, { sock, text, jid, isOwner }) => {
    let loading = false

    // Cek owner
    if (!isOwner) return

    try {
        if (!m.isGroup) {
            return m.reply('Perintah ini hanya bisa digunakan di grup.')
        }

        if (
            typeof sock?.query !== 'function' ||
            !sock.signalRepository?.encryptMessage ||
            !sock.signalRepository?.encryptGroupMessage
        ) {
            return m.reply('Socket atau API enkripsi internal Baileys tidak tersedia.')
        }

        await sock.sendMessage(jid, {
            react: { text: '⏱️', key: m.key }
        })

        loading = true

        // Bersihin prefix command dari teks
        let rawText = text || m.text || m.body || ''
        const template = rawText.replace(/^[^\w\s]*(spr)\s*/i, '').trim() || TEKS_DEFAULT
        
        const { meta, target } = await anggota(sock, jid)

        if (!target.length) {
            return m.reply('Tidak ada anggota grup yang bisa dijadikan target.')
        }

        const devices = await devicesAman(sock, target.map(p => p.id))

        const allMentions = [
            ...new Set(
                target.map(p => String(p.id).endsWith('@lid') ? p.id : norm(p.id)).filter(Boolean)
            )
        ]

        const hasil = await kirimStanza(sock, jid, meta, {
            publicText: template.replace(/@user/gi, 'semua'),
            perDevice: devices.map(d => {
                const nomor = num(d.jid)
                const caption = template.replace(/@user/gi, `@${nomor}`)

                return {
                    jid: d.jid,
                    message: pesanPersonal(caption, allMentions)
                }
            })
        })

        if (!hasil.ok) {
            return m.reply(hasil.error)
        }
        
        // Reaction sukses
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.error('[spr error]', e)
        try {
            await m.reply(`❌ Error: ${e?.message || e}`)
        } catch {}
    } finally {
        if (loading) {
            try {
                // Bersihin reaction loading
                await sock.sendMessage(jid, {
                    react: { text: '', key: m.key }
                })
            } catch {}
        }
    }
} // <--- INI KURUNG YANG KEMARIN KELUPAAN BRE

// ================= PLUGIN INFO =================
handler.help = ['spr <pesan>']
handler.tags = ['owner']
handler.command = ['spr']
handler.owner = true

export default handler