// .upsw <teks>  → upload status WhatsApp bot
//   • reply / kirim foto, video, atau audio (caption = teks status) → status media
//   • tanpa media: teks biasa jadi status teks berlatar warna
// Penonton status: di grup = anggota grup itu; di chat pribadi = anggota semua grup yang diikuti bot.

import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { pickMedia } from '../../lib/core/file.js'

const react = (sock, m, text) => sock.sendMessage(m.chat, { react: { text, key: m.key } }).catch(() => null)
const isJid = j => typeof j === 'string' && /@(s\.whatsapp\.net|lid)$/.test(j)
const COLORS = ['#128C7E', '#1E88E5', '#8E24AA', '#E53935', '#FF9800', '#25D366', '#00BCD4', '#6D4C41']

// nomor biasa (PN) diutamakan; LID hanya kalau nomornya tidak ada
const addMembers = (set, participants = []) => {
    for (const p of participants) {
        const jid = [p.phoneNumber, p.jid, p.id, p.lid].find(isJid)
        if (jid) set.add(jidNormalizedUser(jid))
    }
}

let handler = async (m, { sock, text, reply, prefix, command }) => {
    if (sock.platform === 'telegram') return reply('❌ Fitur ini hanya untuk WhatsApp.')

    const media = pickMedia(m)
    const mime = media?.mime || ''
    const kind = /image/.test(mime) ? 'image' : /video/.test(mime) ? 'video' : /audio/.test(mime) ? 'audio' : null
    const caption = String(text || media?.node?.caption || '').trim()

    if (!kind && !caption) {
        const p = prefix || '.'
        return reply(`*UPLOAD STATUS BOT*\n\n• ${p}${command} <teks> — status teks\n• Reply/kirim foto atau video dengan caption ${p}${command} <teks> — status media\n• Reply audio/VN dengan ${p}${command} — status suara`)
    }

    await react(sock, m, '⏳')
    try {
        // penonton status
        const audience = new Set()
        if (sock.user?.id) audience.add(jidNormalizedUser(sock.user.id))
        if (m.isGroup) {
            addMembers(audience, (await sock.groupMetadata(m.chat)).participants)
        } else {
            const all = await sock.groupFetchAllParticipating()
            for (const g of Object.values(all)) addMembers(audience, g.participants)
        }
        const statusJidList = [...audience]

        let content
        if (kind === 'audio') {
            content = { audio: await media.download(), mimetype: 'audio/ogg; codecs=opus', ptt: true }
        } else if (kind) {
            const buffer = await media.download()
            if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Gagal mengunduh media')
            content = { [kind]: buffer, ...(caption ? { caption } : {}) }
        } else {
            content = {
                text: caption,
                backgroundColor: COLORS[Math.floor(Math.random() * COLORS.length)],
                font: Math.floor(Math.random() * 5)
            }
        }

        await sock.sendMessage('status@broadcast', content, { statusJidList, broadcast: true })
        await react(sock, m, '✅')
        reply(`✅ Status terkirim ke ${statusJidList.length} kontak.`)
    } catch (e) {
        console.error('[UPSW ERROR]', e)
        await react(sock, m, '❌')
        reply(`❌ Gagal upload status: ${e?.message || e}`)
    }
}

handler.command = ['upsw']
handler.help = ['upsw <teks / reply foto, video, audio>']
handler.tags = ['owner']
handler.owner = true

export default handler
