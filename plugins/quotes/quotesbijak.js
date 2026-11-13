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
    "Keyakinan merupakan suatu pengetahuan di dalam hati, jauh tak terjangkau oleh bukti.",
    "Rasa bahagia dan tak bahagia bukan berasal dari apa yang kamu miliki, tapi berasal dari pikiran kamu.",
    "Sakit dalam perjuangan itu hanya sementara. Namun jika menyerah, rasa sakit itu akan terasa selamanya.",
    "Hanya seseorang yang takut yang bisa bertindak berani. Tanpa rasa takut itu tidak ada keberanian.",
    "Jadilah diri kamu sendiri. Siapa lagi yang bisa melakukannya lebih baik ketimbang diri kamu sendiri?",
    "Kesempatan kamu untuk sukses selalu dapat diukur oleh seberapa besar kepercayaan kamu pada diri sendiri.",
    "Kebanggaan kita yang terbesar adalah bukan tidak pernah gagal, tetapi bangkit kembali setiap kali kita jatuh.",
    "Suatu pekerjaan yang paling tak kunjung bisa diselesaikan adalah pekerjaan yang tak kunjung pernah dimulai.",
    "Pikiran kamu bagaikan api yang perlu dinyalakan, bukan bejana yang menanti untuk diisi.",
    "Kejujuran adalah batu penjuru dari segala kesuksesan. Pengakuan adalah motivasi terkuat.",
    "Segala sesuatu memiliki kesudahan, yang sudah berakhir biarlah berlalu dan yakinlah semua akan baik-baik saja.",
    "Setiap detik sangatlah berharga karena waktu mengetahui banyak hal, termasuk rahasia hati.",
    "Jika kamu tak menemukan buku yang kamu cari di rak, maka tulislah sendiri.",
    "Jika hatimu banyak merasakan sakit, maka belajarlah untuk tidak memberikan rasa sakit pada orang lain.",
    "Hidup tak selamanya tentang pacar.",
    "Rumah bukan hanya sebuah tempat, tetapi itu adalah perasaan.",
    "Pilih mana: Orang yang memimpikan kesuksesan atau orang yang membuatnya menjadi kenyataan?",
    "Bukan bahagia yang menjadikan kita bersyukur, tetapi dengan bersyukurlah yang akan menjadikan hidup kita bahagia.",
    "Aku memang diam. Tapi aku tidak buta.",
    "Kamu tidak bisa menyiram bunga yang layu, tapi kamu bisa menanam bunga yang baru dengan harapan yang lebih baik.",
    "Jangan pernah menyesali sehari pun dalam hidupmu. Hari baik memberimu kebahagiaan, hari buruk memberimu pengalaman.",
    "Kesabaran bukanlah kemampuan untuk menunggu, melainkan bagaimana kita bersikap saat sedang menunggu.",
    "Orang yang kuat bukanlah orang yang tidak pernah menangis, melainkan orang yang tetap tegar meski air matanya mengalir.",
    "Kebaikan yang kamu tanam hari ini mungkin tidak berbuah esok hari, tapi pasti akan berbuah pada waktunya.",
    "Waktu adalah pedang; jika kamu tidak memanfaatkannya dengan bijak, ia yang akan menebasmu.",
    "Memaafkan bukan berarti melupakan, tetapi melepaskan beban di hati agar bisa melangkah lebih ringan.",
    "Kekayaan sejati bukanlah tentang seberapa banyak yang kamu miliki, melainkan seberapa sedikit kebutuhanmu untuk merasa cukup.",
    "Kadang kita harus tersesat terlebih dahulu untuk menemukan jalan terbaik yang belum pernah terpikirkan.",
    "Belajarlah merendah sampai tidak ada seorang pun yang bisa merendahkanmu.",
    "Diam adalah jawaban terbaik untuk orang yang tidak menghargai perkataanmu.",
    "Kelemahan terbesar kita adalah mudah menyerah. Cara paling pasti untuk sukses adalah selalu mencoba satu kali lagi.",
    "Jangan membandingkan prosesmu dengan orang lain, karena pelangi dan bintang bersinar pada waktu yang berbeda.",
    "Ketenangan batin dimulai saat kamu berhenti membiarkan tindakan orang lain mengendalikan emosimu."
]

    const quote = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *W I S E  Q U O T E S*\n\n"${quote}"`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐁𝐈𝐉𝐀𝐊 」",
                description: "Think wise, live better",
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

handler.help = ["quotesbijak"]
handler.tags = ["quotes"]
handler.command = ['quotesbijak', 'bijak']
handler.register = true
handler.limit = true

export default handler
