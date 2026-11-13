/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

import sharp from 'sharp'
import { prepareWAMessageMedia } from '@whiskeysockets/baileys'

const THUMB_URL = 'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png'
const URL = 'https://devcukurukuk.biz.id'

// Teks kredit disimpan dalam bentuk hex supaya tidak gampang di find-and-replace
// saat ada yang rename/crack project ini. Didekode saat runtime.
const CAPTION_HEX = 'e295ade29481e29481e29481e3809420e29ca62050524f4a454354204352454449545320e29ca620e38095e29481e29481e29481e2aca30a0a3e20224f70656e20536f75726365206973206275696c742062792070656f706c652c0a3e206e6f7420627920636f64652e220a0ae2978820446576656c6f7065720ae280a22059616e6e527a7920546563680a68747470733a2f2f64657663756b7572756b756b2e62697a2e69640a0ae2978820426173650ae280a2205a617373204465737574610a0ae29788204c6962726172790ae280a220776869736b6579736f636b6574730ae280a2202f6261696c6579732f372e302e302d726331340a0ae2978820436f6e7472696275746f72730ae280a2205a616e735069770ae280a2204b61646f6b756e0ae280a220416f7a79790ae280a2205a454c4150490ae280a2204b61697a656e204150490ae280a220466161204150490ae280a2204261696c6579730ae280a220416c6c20436f6e7472696275746f72730a0ae2978820496e6672617374727563747572650ae280a2204150492050726f7669646572730ae280a2205650532050726f7669646572730ae280a220546573746572730a0ae29788205370656369616c205468616e6b730ae280a220416c6c20537570706f72746572730ae280a220416c6c2055736572730ae280a2204d792046616d696c790ae280a22045766572796f6e652077686f2068656c70656420746869732070726f6a6563742067726f772e0a0ae29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e29481e294810a0a2a224576657279206c696e65206f6620636f64652068617320612073746f72792e0a5468616e6b7320666f72206265696e672070617274206f662069742e222a20e29da4efb88f0a'

const CAPTION = Buffer.from(CAPTION_HEX, 'hex').toString('utf8')

let handler = async (m, { sock, reply }) => {
    const text = `${URL}${'\u200b'.repeat(400)}\n\n${CAPTION}`

    try {
        const thumb = await getThumb(THUMB_URL)
        const highQualityThumbnail = await createHighQualityThumbnail(sock, thumb)

        return await sock.sendMessage(
            m.chat,
            {
                text,
                linkPreview: {
                    'matched-text': URL,
                    matchedText: URL,
                    canonicalUrl: URL,
                    title: '「 𝐊𝐚𝐠𝐮𝐲𝐚 𝐌𝐃 • 𝐂𝐫𝐞𝐝𝐢𝐭𝐬 」',
                    description: 'Special Thanks & Contributors',
                    previewType: 0,
                    jpegThumbnail: thumb,
                    highQualityThumbnail,
                    thumbnailUrl: THUMB_URL,
                    linkPreviewMetadata: {
                        linkMediaDuration: 0,
                        socialMediaPostType: 4
                    }
                },
                favicon: { url: THUMB_URL }
            },
            { quoted: m }
        )
    } catch (e) {
        console.log('[tqto] gagal kirim link preview:', e.message)
        return reply(CAPTION.trim())
    }
}

handler.help = ['tqto']
handler.tags = ['main']
handler.command = ['tqto', 'thanks', 'credits']

export default handler

async function getThumb(url) {
    try {
        const res = await fetch(url)
        const raw = Buffer.from(await res.arrayBuffer())
        return await sharp(raw)
            .resize(1280, 720, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 90 })
            .toBuffer()
    } catch {
        return Buffer.alloc(0)
    }
}

async function createHighQualityThumbnail(sock, thumb) {
    try {
        if (!thumb.length) return null
        const { imageMessage } = await prepareWAMessageMedia(
            { image: thumb },
            { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
        )
        imageMessage.width = 1280
        imageMessage.height = 720
        return imageMessage
    } catch {
        return null
    }
}
