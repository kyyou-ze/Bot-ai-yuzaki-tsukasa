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
const THUMB_URL = global.thumb?.utama || 'https://raw.githubusercontent.com/kyyou-ze/tsukasa-img/refs/heads/main/Profil%20Anime%20Pastel%20Ungu%20Yuzaki%20Tsukasa.png'

let handler = async (m, { conn, sock }) => {
    const list = [
    "Aku memilih untuk sendiri, bukan karena menunggu yang sempurna, tetapi butuh yang tak pernah menyerah.",
    "Seorang yang single diciptakan bersama pasangan yang belum ditemukannya.",
    "Jomblo. Mungkin itu cara Tuhan untuk menyelamatkanmu dari orang yang salah.",
    "Kasih sayang yang tulus tidak akan pernah pudar meski waktu terus berganti.",
    "Cinta itu bukan tentang seberapa lama kamu mengenal seseorang, tapi tentang seberapa tulus kamu mencintainya.",
    "Aku tidak butuh orang yang sempurna, aku hanya butuh seseorang yang bisa membuatku merasa cukup.",
    "Jika mencintaimu adalah kesalahan, maka aku tidak pernah ingin menjadi benar.",
    "Bersamamu, bahkan diam pun terasa begitu nyaman dan menenangkan.",
    "Bukan karena kamu yang terbaik, tapi karena kamu yang membuat hatiku berhenti mencari.",
    "Rindu ini seperti ombak di lautan, tak pernah berhenti mendekat ke tepian hatimu.",
    "Aku ingin menjadi alasan di balik senyum pertamamu setiap pagi.",
    "Cinta sejati tidak butuh alasan, karena cinta adalah alasan itu sendiri.",
    "Mungkin aku bukan yang pertama di hatimu, tapi biarkan aku menjadi yang terakhir.",
    "Setiap detak jantungku selalu berbisik namamu pelan-pelan.",
    "Hujan di luar mungkin dingin, tapi mengingat senyummu selalu menghangatkan jiwaku.",
    "Dunia ini terlalu luas untuk dijelajahi sendiri, maukah kamu menemaniku sampai akhir?",
    "Jika satu detik bersamamu adalah keabadian, maka aku ingin hidup di detik itu selamanya.",
    "Aku tidak pernah takut jatuh cinta, asalkan yang menyambut jatuhku adalah kamu.",
    "Kamu adalah bait puisi terindah yang pernah dituliskan takdir dalam hidupku.",
    "Terkadang aku cemburu pada bayanganmu, karena dia selalu mengikutimu kemanapun kamu melangkah.",
    "Jarak itu hanya angka, selama namamu masih tersimpan rapi di dalam doa-doaku.",
    "Cintaku padamu bagaikan lingkaran, tidak memiliki titik awal dan tidak akan pernah berujung.",
    "Melihatmu bahagia sudah cukup, tapi menjadi alasan di balik bahagiamu adalah impian terbesarku.",
    "Aku mencintaimu bukan karena siapa dirimu, melainkan siapa diriku saat bersamamu.",
    "Senyummu adalah pemandangan favoritku, dan tawamu adalah melodi paling merdu yang pernah kudengar.",
    "Di antara miliaran manusia di bumi, hatiku hanya memilihmu untuk menetap.",
    "Cinta bukan tentang mencari seseorang yang bisa hidup bersamamu, tapi tentang menemukan seseorang yang tanpanya kamu tak bisa hidup.",
    "Terima kasih sudah hadir dan mengubah hal-hal biasa menjadi luar biasa indah.",
    "Kalau cinta itu luka, biarkan aku terluka asalkan itu karenamu.",
    "Tak peduli seberapa lelah hariku, mendengar suaramu selalu mampu mengembalikan energiku."
]

    const quote = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *Q U O T E S  B U C I N*\n\n"${quote}"`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐁𝐔𝐂𝐈𝐍 」",
                description: "Kata-kata romantis buat si dia",
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

handler.help = ["quotesbucin"]
handler.tags = ["quotes"]
handler.command = ['quotesbucin', 'bucin']
handler.register = true
handler.limit = true

export default handler
