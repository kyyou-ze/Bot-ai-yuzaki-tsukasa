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
    "Dear kamu yang tertulis di halaman defacementku, Kapan jadi pacarku?",
    "Aku rela ko jadi Processor yg kepanasan, asalkan kmu yg jadi heatsink'y yg setiap saat bisa mendinginkan ku.",
    "Gak usah nyari celah xss deh, karena ketika kamu ngeklik hatiku udah muncul pop up namamu.",
    "berharap setelah aku berhasil login di hati kamu ga akan ada tombol logout, dan sessionku ga bakal pernah expired.",
    "Masa aku harus pake teknik symlink bypass buat buka-buka folder hatimu yg open_basedir enabled.",
    "Diriku dan Dirimu itu ibarat PHP dan MySQL yang belum terkoneksi.",
    "Jangan cuma bisa inject hatinya, tapi harus bisa patchnya juga. Biar tidak selingkuh sama hacker lain.",
    "Aku memang programmer PHP, tapi aku nggak akan php-in kamu kok.",
    "Eneeeng. | Apache? | Km wanita yg paling Unix yg pernah aku kenal.",
    "Sayang, capslock kamu nyala ya? | ngga, kenapa emangnya? | soalnya nama kamu ketulis gede bgt di hati aku.",
    "Aku deketin kamu cuma untuk redirect ke hati temenmu.",
    "Domain aja bisa parkir, masa cintaku ga bisa parkir dihatimu?",
    "Aku boleh jadi pacarmu? | 400 (Bad Request) | Aku cium boleh? | 401 (Authorization Required).",
    "kamu tau ga bedanya kamu sama sintax PHP, kalo sintax PHP itu susah dihafalin kalo kamu itu susah dilupain.",
    "Menjaring hatimu lewat komputerku adalah keahlian utamaku.",
    "Jika cinta itu Array, maka cintaku padamu tak pernah empty jika di unset().",
    "SQLI ( Structured Query Love Injection ) sedang berjalan di hatimu.",
    "aku ingin kamu rm -rf kan semua mantan di otak mu, akulah root hati kamu.",
    "Senyumu bagaikan cooler yang menyejukan hatiku ketika sedang overclock.",
    "kamu adalah terminalku, dimana aku menghabiskan waktuku untuk mengetikan beribu baris kode cinta untukmu.",
    "hatiku ibarat vps hanya untukmu saja bukan shared hosting yg bisa tumpuk berbagai domain cinta.",
    "Jangan men-dualboot-kan hatiku kepadamu.",
    "cintaku kan ku Ctrl+A lalu kan ku Ctrl+C dan kan ku Ctrl+V tepat di folder system hatimu.",
    "Cintamu bagaikan TeamViewer yang selalu mengendalikan hatiku.",
    "cinta kita tak akan bisa dipisahkan walau setebal apapun itu firewall...!!",
    "while (alive) { love(you); } // Infinite loop cinta yang tidak akan pernah berhenti.",
    "Kamu itu bagaikan git commit -m 'final love', keputusan terbaik yang pernah kupush ke repo hidupku.",
    "Jangan pernah git reset --hard kenangan indah yang sudah pernah kita branch bersama.",
    "Cintaku padamu seperti kernel Linux, selalu open source, stabil, dan siap running 24/7.",
    "Error di kodingan bisa kudebug dengan mudah, tapi error saat melihat senyum manismu bikin otakku stuck selamanya."
]

    const quote = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *Q U O T E S  H A C K E R*\n\n"${quote}"`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐇𝐀𝐂𝐊𝐄𝐑 」",
                description: "Cyberpunk & Hacker Thoughts",
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

handler.help = ["quoteshacker"]
handler.tags = ["quotes"]
handler.command = ['quoteshacker', 'heker']
handler.register = true
handler.limit = true

export default handler
