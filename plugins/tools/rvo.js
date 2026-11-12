// .rvo — reply foto / video / VN sekali lihat untuk membukanya jadi media biasa.
// Media sekali lihat disimpan bot SAAT MASUK (30 menit, hanya di memori), jadi .rvo tetap bisa
// walau media itu sudah dibuka. Kalau pesannya masuk sebelum bot aktif / sudah lewat 30 menit,
// WhatsApp biasanya sudah menghapus filenya dari server dan tidak bisa diunduh lagi.
import { viewOnceGet, viewOnceStatus } from '../../lib/platform/wa.js'

const SUPPORTED = ['imageMessage', 'videoMessage', 'audioMessage']

let handler = async (m, { sock, jid, prefix, command, reply }) => {
    const q = m.quoted

    if (!q) {
        return reply(`reply pesan sekali lihat dengan *${prefix || '.'}${command}*`)
    }

    // simpanan saat masuk (kalau ada) lebih diutamakan daripada unduh ulang
    const saved = await viewOnceGet(q.id).catch(() => null)
    const mtype = saved?.meta.mtype || q.mtype

    const NOT_SAVED =
        'media sekali lihat itu tidak ada di simpanan bot.\n\n' +
        'Bot hanya menyimpan media sekali lihat yang masuk saat bot online, selama 2 jam, ' +
        'dan WhatsApp menghapus filenya dari server begitu dibuka (status "Dibuka"). ' +
        `Minta pengirim kirim ulang, jangan dibuka dulu, lalu langsung reply dengan *${prefix || '.'}${command}*.`

    if (!saved) {
        const st = viewOnceStatus(q.id)
        const diag = '\n\n_diagnosa: ' + (st ? `bot ${st}` : 'bot tidak pernah menerima pesan sekali lihat dengan id ini (masuk sebelum bot nyala / bukan pesan sekali lihat / tidak sampai ke bot)') + '_'
        console.log(`[RVO] tidak ada simpanan untuk ${q.id} (isMedia=${q.isMedia}, mtype=${q.mtype}, viewOnce=${!!q.viewOnce})`)
        // WhatsApp melucuti isi pesan sekali lihat saat di-reply -> mimetype hilang, kelihatan "bukan media"
        if (!q.isMedia) {
            return reply((q.mtype && SUPPORTED.includes(q.mtype) ? NOT_SAVED : 'yang di-reply bukan media, atau ' + NOT_SAVED) + diag)
        }
        if (!q.viewOnce) return reply('yang di-reply bukan pesan sekali lihat.')
    }

    if (!SUPPORTED.includes(mtype)) {
        return reply('format media tidak didukung.')
    }

    let err = null
    const media = saved?.buf || await q.download().catch(e => { err = e; return null })

    // cadangan terakhir: kalau unduh gagal tapi pesan masih punya url/kunci media, teruskan tanpa flag sekali lihat
    if (!saved && !media?.length && q.raw) {
        try {
            const { normalizeMessageContent } = await import('@whiskeysockets/baileys')
            const norm = normalizeMessageContent(q.raw) || q.raw
            const node = norm?.[mtype]
            if (node && (node.url || node.directPath) && node.mediaKey) {
                const clone = structuredClone(norm)
                delete clone[mtype].viewOnce
                await sock.relayMessage(jid, clone, {})
                return
            }
        } catch (e) {
            console.error('[RVO] relay cadangan gagal:', e?.message || e)
        }
    }

    if (!media?.length) {
        console.error('[RVO] gagal mengunduh:', err?.message || err)
        const why = String(err?.message || '')
        if (/\b(404|410)\b|not found|gone|expired|no valid media url|directpath/i.test(why)) {
            return reply(
                'gagal: media sekali lihat itu sudah dihapus dari server WhatsApp (biasanya karena sudah dibuka) ' +
                'dan bot tidak menyimpannya saat masuk.\n\n' +
                `Bot hanya menyimpan media sekali lihat yang masuk saat bot online, selama 2 jam. ` +
                `Minta pengirim kirim ulang, lalu langsung reply dengan *${prefix || '.'}${command}*.` +
                `\n\n_diagnosa: ${viewOnceStatus(q.id) ? `bot ${viewOnceStatus(q.id)}` : 'bot tidak pernah menerima pesan ini'} | error: ${why.slice(0, 80)}_`
            )
        }
        const st2 = viewOnceStatus(q.id)
        return reply(`gagal mengunduh media, coba lagi.\n\n_diagnosa: ${st2 ? `bot ${st2}` : 'bot tidak pernah menerima pesan ini'}${why ? ` | error: ${why.slice(0, 120)}` : ''}_`)
    }

    const caption = saved?.meta.caption || q.caption || ''
    const mimetype = saved?.meta.mimetype || q.mimetype
    const ptt = saved ? saved.meta.ptt : !!q.ptt

    try {
        if (mtype === 'imageMessage') {
            await sock.sendMessage(
                jid,
                { image: media, caption },
                { quoted: m }
            )
        } else if (mtype === 'videoMessage') {
            await sock.sendMessage(
                jid,
                { video: media, caption, mimetype: mimetype || 'video/mp4' },
                { quoted: m }
            )
        } else {
            await sock.sendMessage(
                jid,
                {
                    audio: media,
                    mimetype: mimetype || 'audio/ogg; codecs=opus',
                    ptt
                },
                { quoted: m }
            )
        }
    } catch (e) {
        console.error('[RVO]', e)
        reply(`gagal mengirim media.\n\n${e.message}`)
    }
}

handler.command = ['rvo', 'dwm']
handler.tags = ['tools']

export default handler
