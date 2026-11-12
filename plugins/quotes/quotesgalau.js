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

const URL = 'https://devcukurukuk.biz.id'
const THUMB_URL = global.thumb?.utama || 'https://cdn.zass.in/tlQJc8Qp8I.jpg'

let handler = async (m, { conn, sock }) => {
    const list = [
    "Gak salah kalo aku lebih berharap sama orang yang lebih pasti tanpa khianati janji-janji.",
    "Kalau aku memang tidak sayang sama kamu ngapain aku mikirin kamu. Tapi semuanya kamu yang ngganggap aku gak sayang sama kamu.",
    "Mungkin kamu tak pernah sadar, betapa seringnya aku menatap layar hanya untuk menunggu satu pesan darimu.",
    "Hal paling menyakitkan adalah berpura-pura bahagia ketika hati sedang hancur lebur.",
    "Aku lelah mengejar seseorang yang langkahnya selalu menjauh dari arahku.",
    "Terkadang, melepaskan bukan berarti berhenti mencintai, melainkan menyadari bahwa dia lebih bahagia tanpamu.",
    "Kita pernah sedekat nadi, sebelum akhirnya menjadi sejauh matahari.",
    "Bagian terberat dari perpisahan bukanlah kepergiannya, tapi kenangan yang tertinggal di setiap sudut ingatan.",
    "Aku rindu kita yang dulu, sebelum rasa ego dan keheningan menghancurkan segalanya.",
    "Tersenyum di depan semua orang itu mudah, yang sulit adalah menahan air mata saat sendirian di kamar.",
    "Mungkin aku yang terlalu berharap pada seseorang yang hanya menganggapku persinggahan sementara.",
    "Sudah terbiasa diabaikan, sampai-sampai perhatian kecil terasa seperti keajaiban.",
    "Bukan jarak yang memisahkan kita, melainkan rasa yang perlahan memudar tanpa kita sadari.",
    "Menunggu kabar darimu seperti menunggu hujan di tengah teriknya gurun pasir.",
    "Ternyata, rasa sakit terdalam berasal dari orang yang pernah berjanji tidak akan pernah melukai kita.",
    "Aku tetap bertahan bukan karena bodoh, tapi karena hatiku belum siap menerima kenyataan bahwa kamu sudah pergi.",
    "Kehilangan seseorang yang kita cintai itu berat, tapi kehilangan diri sendiri demi mempertahankan seseorang jauh lebih menyakitkan.",
    "Hati ini seperti cangkir retak; tetap bisa menampung air, tapi perlahan-lahan menetes habis.",
    "Selamat malam untuk kamu yang tak lagi bisa kusapa, semoga mimpimu selalu indah meski tanpaku.",
    "Terima kasih telah mengajarkanku bahwa tidak semua ketulusan akan berbuah kebersamaan.",
    "Rasanya aneh ketika seseorang yang dulu tahu segalanya tentangmu kini bertingkah seperti orang asing.",
    "Luka ini tak berdarah, tapi rasa perihnya menembus hingga ke dasar jiwa.",
    "Aku berhenti mencarimu, bukan karena tak peduli, tapi karena sadar kehadiranku tak lagi dinanti.",
    "Mencintai dalam diam itu menyakitkan, tapi melihatnya mencintai orang lain di depan mata jauh lebih menghancurkan.",
    "Waktu memang menyembuhkan, tapi bekas lukanya tetap mengingatkan pada rasa sakit yang pernah ada."
]

    const quote = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *Q U O T E S  G A L A U*\n\n"${quote}"`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐆𝐀𝐋𝐀𝐔 」",
                description: "Ungkapan Hati & Rasa Kecewa",
                previewType: 0,
                jpegThumbnail: thumb,
                highQualityThumbnail,
                thumbnailUrl: THUMB_URL,
                linkPreviewMetadata: {
                    linkMediaDuration: 0,
                    socialMediaPostType: 4
                }
            },
            favicon: {
                url: THUMB_URL
            }
        },
        { quoted: global.fmeta || m }
    )
}

handler.help = ["quotesgalau"]
handler.tags = ["quotes"]
handler.command = ['quotesgalau', 'galau']
handler.register = true
handler.limit = true

export default handler
