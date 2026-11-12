/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Command      : .infosc  — info script + tombol link Channel WhatsApp & Thanks To (gambar HD di header)
 *
 */

import sharp from 'sharp'
import { buttonsToText } from '../../lib/platform/wa.js'

const THUMB_URL = 'https://cdn.zass.in/NREOIOnmis.jpg'
const CHANNEL_URL = 'https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n'

// Teks ditaruh dalam bentuk hex supaya tidak gampang di find-and-replace
// saat ada yang rename/crack project ini. Didekode saat runtime.
const d = (hex) => Buffer.from(hex, 'hex').toString('utf8')

const TITLE_HEX = 'e3808c20f09d908af09d909af09d90a0f09d90aef09d90b2f09d909a20f09d908cf09d908320e280a220f09d9092f09d909cf09d90abf09d90a2f09d90a9f09d90ad20e3808d0a'
const FOOTER_HEX = 'f09fa9b72059616e6e527a79205465636820e280a2204b6167757961204d44'
const BUTTON_TEXT_HEX = 'f09f8cb8204368616e6e656c205768617473417070'
const BUTTON_TQTO_TEXT_HEX = 'f09f929d205468616e6b7320546f'
const BUTTON_TQTO_ID_HEX = '2e7471746f'
const TEXT_HEX = 'f09f8cb8202a494e464f20534352495054204b4147555941204d442a0a0a4861692c206861697e2120f09f9180e29ca80a0ae29d8f204c61676920636172692073637269707420626f742057686174734170702079616e67206b6572656e3f0a0ae29d8f20536372697074202a4b6167757961204d442a2074657273656469612064616e2073656c616c75206d656e64617061746b616e207570646174652074657262617275206d656c616c7569204368616e6e656c2057686174734170702e0a0ae29d8f204469206368616e6e656c2074657273656469613a0ae280a220557064617465206669747572207465726261727520f09f9a800ae280a220496e666f726d6173692073637269707420f09f939c0ae280a2205065726261696b616e2062756720f09f94a70ae280a22050656e67756d756d616e2070656e74696e6720f09f93a20a0ae29d8f2054656b616e20746f6d626f6c20646920626177616820756e74756b206d656c6968617420696e666f726d617369206c65626968206c616e6a7574207961617e20f09f8cb80a0ae29ca8204172696761746f75207375646168206d616d7069722120'

const TITLE = d(TITLE_HEX)
const FOOTER = d(FOOTER_HEX)
const BUTTON_TEXT = d(BUTTON_TEXT_HEX)
const BUTTON_TQTO_TEXT = d(BUTTON_TQTO_TEXT_HEX)
const BUTTON_TQTO_ID = d(BUTTON_TQTO_ID_HEX)
const TEXT = d(TEXT_HEX)

const BUTTON_TQTO_ID_RAW = BUTTON_TQTO_ID

async function getThumb(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) return null
        const raw = Buffer.from(await res.arrayBuffer())
        return await sharp(raw)
            .resize(1280, 720, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 90 })
            .toBuffer()
    } catch {
        return null
    }
}

let handler = async (m, { sock }) => {
    const buttons = [
        { type: 'url', text: BUTTON_TEXT, url: CHANNEL_URL },
        { type: 'reply', text: BUTTON_TQTO_TEXT, id: BUTTON_TQTO_ID_RAW }
    ]
    const image = await getThumb(THUMB_URL)

    try {
        return await sock.sendButtons(m.chat, {
            title: TITLE,
            text: TEXT,
            footer: FOOTER,
            buttons,
            ...(image ? { image } : {})
        }, { quoted: m })
    } catch (e) {
        console.error('[ScriptError]', e?.message || e)
        // tombol gagal terkirim (mis. Telegram) → teks biasa + link
        const text = `${TEXT}\n\n${buttonsToText(buttons)}`.trim()
        return sock.sendMessage(m.chat, image ? { image, caption: text } : { text }, { quoted: m })
            .catch((err) => console.error('[INFOSC]', err?.message || err))
    }
}

handler.command = ['infosc', 'script', 'sc', 'getsc']
handler.tags = ['main']
handler.help = ['infosc']

export default handler
