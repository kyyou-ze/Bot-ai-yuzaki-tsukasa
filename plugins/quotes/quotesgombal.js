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
    "Hal yang paling aku suka yaitu ngemil, namun tau gak ngemil apa yang paling aku suka? ngemilikin kamu sepenuhnya.",
    "Seandainya sekarang adalah tanggal 28 oktober 1928, aku akan ubah naskah sumpah pemuda menjadi sumpah setia padamu.",
    "Kamu tau gak bedanya kamu sama modem? Kalau modem connect-nya ke internet, kalau kamu connect-nya langsung ke hatiku.",
    "Aku gak sedih kok kalo besok hari senin, asalkan seninnya dilewati bareng kamu.",
    "Muka kamu jangan dimanis-manisin gitu napa, ntar aku kena diabetes liat kamu terus.",
    "Kamu punya peta gak? Soalnya aku tersesat di dalam matamu yang indah.",
    "Bapak kamu tukang las ya? Soalnya tatapan matamu menyengat dan bikin meleleh hatiku.",
    "Cita-citaku dulu pengen jadi pilot, tapi sekarang berubah pengen jadi pendamping hidupmu aja.",
    "Kamu tau gak apa bedanya garuda sama kamu? Kalau garuda di dadaku, kalau kamu di hatiku.",
    "Rumah sakit jiwa dimana ya? Soalnya aku udah gila banget sama pesonamu.",
    "Jangan jalan-jalan terus di pikiranku dong, capek tau mikirin kamu seharian.",
    "Kamu itu kayak garam di lautan, gak keliatan tapi selalu memberi rasa di hidupku.",
    "Kalau kamu jadi senar gitar, aku gak mau jadi pemetiknya. Aku takut mutusin kamu.",
    "Kopi apa yang paling manis? Kopi-kirkan kamu setiap malam sebelum tidur.",
    "Kamu punya spidol gak? Aku mau coret nama mantanku dan tulis namamu di hatiku.",
    "Meskipun tanggal merah banyak, rasa rinduku padamu gak pernah libur barang sedetik pun.",
    "Kamu tau gak persamaan kamu sama matematika? Sama-sama bikin pusing, tapi kamu bikin pusing saking cantiknya.",
    "Aku gak butuh bintang di langit, karena senyumanmu udah cukup menerangi duniaku yang gelap.",
    "Tahu gak kenapa aku suka hujan? Karena setiap tetesnya mengingatkanku pada sejuknya senyumanmu.",
    "Kalau ada lomba mencintaimu, aku yakin pasti kalah, karena aku mencintaimu tanpa batas dan aturan.",
    "Kamu itu seperti wifi berbayar, susah didapetin tapi worth it banget bikin bahagia.",
    "Kucing apa yang paling romantis? Kucing-ta kamu selamanya tanpa ragu.",
    "Kamu tau gak kenapa menara pisa miring? Soalnya ketarik sama gravitasi kecantikanmu.",
    "Napas aku sesak nih, kayaknya gara-gara oksigen di ruangan ini habis diserap sama pesonamu.",
    "Aku rela ditilang polisi setiap hari, asalkan SIM yang disita adalah Surat Izin Menikahimu."
]

    const quote = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *Q U O T E S  G O M B A L*\n\n"${quote}"`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐆𝐎𝐌𝐁𝐀𝐋 」",
                description: "Rayuan Maut & Gombalan Manis",
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

handler.help = ["quotesgombal"]
handler.tags = ["quotes"]
handler.command = ['quotesgombal', 'gombal']
handler.register = true
handler.limit = true

export default handler
