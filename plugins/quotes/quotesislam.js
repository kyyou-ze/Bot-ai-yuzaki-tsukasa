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
        {
            arabic: "مَنْ سَارَ عَلىَ الدَّرْبِ وَصَلَ",
            arti: "Barang siapa berjalan pada jalannya, maka dia akan sampai pada tujuannya."
        },
        {
            arabic: "مَنْ صَبَرَ ظَفِرَ",
            arti: "Barang siapa bersabar, beruntunglah ia."
        },
        {
            arabic: "مَنْ جَدَّ وَجَدَ",
            arti: "Barang siapa bersungguh-sungguh, maka dapatlah ia."
        },
        {
            arabic: "جَالِسْ أَهْلَ الصِّدْقِ وَالوَفَاءِ",
            arti: "Bergaullah dengan orang yang jujur dan menepati janji."
        },
        {
            arabic: "مَوَدَّةُ الصَّدِيقِ تَظْهَرُ وَقْتَ الضِّيقِ",
            arti: "Ketulusan cinta seorang teman akan tampak di saat kesusahan."
        },
        {
            arabic: "وَقْتُ النَّدَمِ لَا يَنْفَعُ",
            arti: "Waktu penyesalan itu tidak ada gunanya."
        },
        {
            arabic: "خَيْرُ جَلِيسٍ فِي الزَّمَانِ كِتَابٌ",
            arti: "Sebaik-baik teman duduk di setiap waktu adalah buku."
        },
        {
            arabic: "التَّعَلُّمُ فِي الصِّغَرِ كَالنَّقْشِ عَلَى الحَجَرِ",
            arti: "Belajar di waktu kecil bagaikan mengukir di atas batu."
        },
        {
            arabic: "لَنْ تَرْجِعَ الأَيَّامُ الَّتِي مَضَتْ",
            arti: "Tidak akan kembali hari-hari yang telah berlalu."
        },
        {
            arabic: "أَصْلِحْ نَفْسَكَ يَصْلُحْ لَكَ النَّاسُ",
            arti: "Perbaikilah dirimu, niscaya orang lain akan baik kepadamu."
        },
        {
            arabic: "فَكِّرْ قَبْلَ أَنْ تَعْزِمَ",
            arti: "Berpikirlah sebelum kamu bertindak."
        },
        {
            arabic: "مَنْ عَرَفَ بُعْدَ السَّفَرِ اسْتَعَدَّ",
            arti: "Barang siapa tahu jauhnya perjalanan, maka ia akan bersiap-siap."
        },
        {
            arabic: "مَنْ يَزْرَعْ يَحْصُدْ",
            arti: "Barang siapa menanam, dialah yang akan memanen."
        },
        {
            arabic: "خَيْرُ الأَصْحَابِ مَنْ يَدُلُّكَ عَلَى الخَيْرِ",
            arti: "Sebaik-baik teman adalah yang menunjukkanmu pada kebaikan."
        },
        {
            arabic: "لَوْلَا العِلْمُ لَكَانَ النَّاسُ كَالبَهَائِمِ",
            arti: "Kalaulah bukan karena ilmu, niscaya manusia itu seperti binatang."
        },
        {
            arabic: "الصَّبْرُ يُعِينُ عَلَى كُلِّ عَمَلٍ",
            arti: "Kesabaran itu menolong atas segala pekerjaan."
        },
        {
            arabic: "جَرِّبْ وَلَاحِظْ تَكُنْ عَارِفًا",
            arti: "Cobalah dan perhatikanlah, niscaya kamu akan menjadi orang yang tahu."
        },
        {
            arabic: "اطْلُبِ العِلْمَ مِنَ المَهْدِ إِلَى اللَّحْدِ",
            arti: "Tuntutlah ilmu dari buaian hingga liang lahat."
        },
        {
            arabic: "بَيْضَةُ اليَوْمِ خَيْرٌ مِنْ دَجَاجَةِ الغَدِ",
            arti: "Telur hari ini lebih baik daripada ayam esok hari."
        },
        {
            arabic: "الوَقْتُ أَثْمَنُ مِنَ الذَّهَبِ",
            arti: "Waktu itu lebih berharga daripada emas."
        },
        {
            arabic: "العَقْلُ السَّلِيمُ فِي الجِسْمِ السَّلِيمِ",
            arti: "Akal yang sehat terletak pada badan yang sehat."
        },
        {
            arabic: "عَثْرَةُ القَدَمِ أَسْلَمُ مِنْ عَثْرَةِ اللِّسَانِ",
            arti: "Tergelincirnya kaki lebih aman daripada tergelincirnya lidah."
        },
        {
            arabic: "سَلَامَةُ الإِنْسَانِ فِي حِفْظِ اللِّسَانِ",
            arti: "Keselamatan manusia terletak pada penjagaan lisannya."
        },
        {
            arabic: "آدَابُ المَرْءِ خَيْرٌ مِنْ ذَهَبِهِ",
            arti: "Adab seseorang itu lebih baik daripada emas perhiasannya."
        },
        {
            arabic: "سُوءُ الخُلُقِ يُعْدِي",
            arti: "Akhlak yang buruk itu menular."
        },
        {
            arabic: "آفَةُ العِلْمِ النِّسْيَانُ",
            arti: "Bencana ilmu adalah lupa."
        },
        {
            arabic: "إِذَا صَدَقَ العَزْمُ وَضَحَ السَّبِيلُ",
            arti: "Jika tekad sudah bulat, jalan akan terbuka terang."
        },
        {
            arabic: "لَا تَحْتَقِرْ مَنْ دُونَكَ فَلِكُلِّ شَيْءٍ مَزِيَّةٌ",
            arti: "Jangan meremehkan orang yang di bawahmu, karena setiap sesuatu punya kelebihan."
        },
        {
            arabic: "أَصْلُ النَّجَاحِ التَّوَكُّلُ عَلَى اللهِ",
            arti: "Pangkal keberhasilan adalah tawakal kepada Allah."
        },
        {
            arabic: "كُنْ عَالِمًا أَوْ مُتَعَلِّمًا أَوْ مُسْتَمِعًا",
            arti: "Jadilah orang alim, atau penuntut ilmu, atau pendengar yang baik."
        },
        {
            arabic: "الحَيَاءُ شُعْبَةٌ مِنَ الإِيمَانِ",
            arti: "Rasa malu itu adalah sebagian dari iman."
        },
        {
            arabic: "الدُّنْيَا مَزْرَعَةُ الآخِرَةِ",
            arti: "Dunia adalah ladang tempat bercocok tanam untuk akhirat."
        },
        {
            arabic: "حَاسِبُوا أَنْفُسَكُمْ قَبْلَ أَنْ تُحَاسَبُوا",
            arti: "Hisablah dirimu sebelum kamu dihisab di hari perhitungan."
        },
        {
            arabic: "مَنْ تَأَنَّى نَالَ مَا تَمَنَّى",
            arti: "Barang siapa berhati-hati, niscaya ia akan memperoleh apa yang ia cita-citakan."
        },
        {
            arabic: "قُلِ الحَقَّ وَلَوْ كَانَ مُرًّا",
            arti: "Katakanlah kebenaran walaupun itu pahit rasanya."
        }
    ]

    const item = list[Math.floor(Math.random() * list.length)]
    const client = conn || sock
    const thumb = await getThumbUrl(THUMB_URL)
    const highQualityThumbnail = await createHighQualityThumbnail(client, thumb)
    const invisible = '\u200B'.repeat(400)
    const caption = `乂  *Q U O T E S  I S L A M I*\n\n"${item.arabic}"\n\n*Artinya:*\n_${item.arti}_`

    await client.sendMessage(
        m.chat,
        {
            text: `${URL}${invisible}\n\n${caption}`,
            linkPreview: {
                'matched-text': URL,
                matchedText: URL,
                canonicalUrl: URL,
                title: "「 𝐐𝐔𝐎𝐓𝐄𝐒 𝐈𝐒𝐋𝐀𝐌𝐈 」",
                description: "Hikmah & Untaian Kata Mutiara Islami",
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

handler.help = ["quotesislami", "quotesislam"]
handler.tags = ["quotes"]
handler.command = ['quotesislami', 'quotesislam', 'islamquotes']
handler.register = true
handler.limit = true

export default handler
