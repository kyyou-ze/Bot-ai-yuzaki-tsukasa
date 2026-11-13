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
    "Kamu suka kopi nggak? Aku sih suka. Tau kenapa alesannya? Kopi itu ibarat kamu, pahit sih tapi bikin candu jadi pingin terus.",
    "Gajian itu kayak mantan ya? Bisanya cuman lewat sebentar saja.",
    "Kata pak haji, cowok yang gak sholat jumat disuruh pake rok mini aja.",
    "Boro-boro mau beli masa depan, beli seblak aja masih mikir nambah ceker apa nggak.",
    "Muka lo kayak uang kembalian permen, ga diharapkan tapi tetep diterima.",
    "Jangan kepedean disapa ramah, kang parkir juga ramah ke semua orang.",
    "Lo itu ibarat sinyal di pelosok, kadang hilang kadang bikin emosi.",
    "Kalau ngomong jangan tinggi-tinggi, nanti ketabrak pesawat garuda.",
    "Gue kira lo tulus, ternyata lo cuma modus biar dapet tebengan gratis.",
    "Duit tinggal goceng, gaya selangit kayak sultan minyak dari Dubai.",
    "Jangan bangga dibilang manis, gula aren juga manis tapi bikin semutan.",
    "Kamera sekarang makin canggih, sayang nggak bisa dipake buat scan otak lo.",
    "Kalo gak suka ya bilang depan muka, jangan ngomong di belakang kayak knalpot bocor.",
    "Pacaran kok kayak kredit motor, kalo gak dibayar ditarik dealer.",
    "Tampang pas-pasan, selera selangit, maunya jalan-jalan ke Mars gratis.",
    "Jangan suka ngumbar janji, janji itu hutang, mending lunasin hutang kopi lo dulu.",
    "Hidup lo kebanyakan drama, pantesan ratingnya anjlok di mata orang.",
    "Gak usah sok keras, kena gerimis dikit aja langsung bikin status galau.",
    "Omonganmu kayak wifi gratisan, gampang nyambung tapi lemot dan banyak gangguan.",
    "Sahabat itu saling bantu, bukan pas butuh baru nyari kayak nyari sinyal di goa.",
    "Gak usah sok sibuk, dichat balesnya tiga abad kemudian kayak prasasti kuno.",
    "Otak lo jangan disimpen terus buat museum, dipake sesekali biar gak karatan.",
    "Cinta itu buta, tapi untung tetangga lo gak buta liat kelakuan lo.",
    "Penampilan boleh keren, tapi saldo rekening jangan kayak nilai ulangan fisika.",
    "Muka dua aja sombong, kalau mau beli bedak kan bayarnya dobel.",
    "Janji manis lo itu kayak sirup basi, manis diawal tapi bikin mules di akhir.",
    "Gaya lo udah kayak CEO ternama, giliran patungan makan langsung pura-pura ke toilet.",
    "Sok jual mahal, padahal kalo diskon 90% juga gak ada yang mau nawar.",
    "Kalau gak bisa bikin bangga, minimal jangan bikin polusi emosi orang lain.",
    "Mulut lo kayak knalpot racing, berisik banget padahal kecepatannya nol besar."
]

    const quote = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *Q U O T E S  B A C O T*\n\n"${quote}"`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐁𝐀𝐂𝐎𝐓 」",
                description: "Random Quotes Bacot & Sindiran",
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

handler.help = ["quotesbacot"]
handler.tags = ["quotes"]
handler.command = ['quotesbacot', 'bacot']
handler.register = true
handler.limit = true

export default handler

let cachedThumb = null
async function getThumbUrl(url) {
  if (cachedThumb) return cachedThumb
  try {
    const res = await fetch(url)
    const raw = Buffer.from(await res.arrayBuffer())

    cachedThumb = await sharp(raw)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer()
    return cachedThumb
  } catch {
    return Buffer.alloc(0)
  }
}

async function createHighQualityThumbnail(conn, thumb) {
  try {
    if (!thumb || !thumb.length) return null

    const { imageMessage } = await prepareWAMessageMedia(
      { image: thumb },
      {
        upload: conn.waUploadToServer,
        mediaTypeOverride: 'thumbnail-link'
      }
    )

    imageMessage.width = 1280
    imageMessage.height = 720

    return imageMessage
  } catch {
    return null
  }
}
