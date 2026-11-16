// KATA-KATA (ALYA MD) — bucin & galau, dipilih acak.
// Command: katabucin/bucin, katagalau/galau/katasedih

const BUCIN = [
  'Kalau badai datang aku tidak takut, yang aku takutkan kalau kamu pergi dariku.',
  'Kamu itu seperti kopi, pahit di awal tapi bikin ketagihan.',
  'Cukup jaringan saja yang hilang, kamu jangan.',
  'Mencintaimu adalah hal terindah yang pernah terjadi dalam hidupku.',
  'Bahkan rumus matematika yang rumit pun kalah rumit dibanding cara memikirkanmu setiap hari.',
  'Seandainya jarak adalah tembok, aku rela merobohkannya demi melihat senyummu.',
  'Aku tidak tahu apa itu cinta sebelum aku mengenalmu.',
  'Menjadi tua bersamamu adalah impian terbesarku.',
  'Dunia terasa sempurna saat kau ada di sampingku.',
  'Tidak perlu alasan untuk mencintaimu, karena cinta ini datang begitu saja.',
  'Setiap detik bersama terasa begitu singkat karena aku terlampau bahagia.',
  'Kamu adalah rumah tempat kepulanganku setelah lelah seharian.',
  'Matahari boleh bersinar terang, tapi bagiku tetap kamu sumber sinarnya.',
  'Hujan di luar tidak membuatku dingin, karena ada kenangan tentangmu yang menghangatkan.',
  'Aku rela menjadi alasan di balik senyuman manismu setiap pagi.',
  'Merindukanmu adalah rutinitas harian yang paling menyenangkan.',
  'Jika hidup adalah pilihan, aku pasti akan memilih untuk selalu bersamamu.',
  'Kamu bukan hanya sekadar kekasih, tapi juga sahabat terbaikku.',
  'Aku bersyukur semesta mempertemukan kita di waktu yang tepat.',
  'Tidak ada tempat ternyaman selain berada di dalam dekapanmu.',
  'Senyummu adalah candu yang membuatku selalu ingin kembali.',
  'Aku ingin menjadi orang terakhir yang membuatmu tertawa sebelum tidur.',
  'Bahkan bintang di langit malam kalah indah dibanding binar matamu.',
  'Kamu adalah alasan mengapa aku percaya pada keajaiban cinta.',
  'Bersamamu, waktu berjalan terlalu cepat dan terasa kurang.',
  'Suaramu adalah melodi terindah yang ingin kudengar setiap hari.',
  'Aku ingin menua bersama dan menghabiskan sisa hidup di sisimu.',
  'Kamu adalah mimpi indah yang menjadi kenyataan dalam hidupku.',
  'Hatiku sudah terkunci rapat dan kuncinya ada di tanganmu.',
  'Aku jatuh cinta kepadamu berkali-kali pada orang yang sama.',
  'Kamu adalah kompas yang menuntunku kembali saat aku tersesat.',
  'Senyummu adalah matahari pagiku yang menghangatkan jiwa.',
  'Kamu adalah jawaban dari doa-doa panjang yang selalu kupanjatkan.',
  'Aku mencintaimu bukan karena siapa kamu, tapi karena diriku saat bersamamu.',
  'Kamu adalah alasan di balik setiap bait kata indah yang kuciptakan.',
  'Aku ingin menua bersama rambut memutih dan cinta yang tetap sama.',
  'Kamu adalah matahari di musim dingin dan kesejukan di musim panas.',
  'Cinta sejati kita akan terus abadi melintasi ruang dan waktu.',
  'Kamu adalah pemilik sah dari seluruh sisa ruang di hatiku.',
  'Aku mencintaimu selamanya tanpa syarat dan tanpa batas.',
]

const GALAU = [
  'Pura-pura bahagia itu melelahkan, padahal aslinya hancur berkeping-keping.',
  'Terkadang seseorang memilih diam bukan karena marah, tapi karena lelah menjelaskan.',
  'Hujan di luar tidak sebanding dengan hujan yang ada di dalam hati.',
  'Menunggu sesuatu yang tidak pasti adalah cara terbaik untuk menyiksa diri sendiri.',
  'Kenangan indah itu berubah menjadi luka saat diingat kembali.',
  'Cukup tahu dan diam, itu lebih baik daripada berdebat dengan orang yang tidak mau mengerti.',
  'Pernah berjuang setengah mati, tapi akhirnya dianggap angin lalu.',
  'Sakit itu ketika kamu menganggap dia spesial, tapi bagi dia kamu cuma pilihan.',
  'Rindu paling berat adalah merindukan seseorang yang sudah tidak bisa dijangkau.',
  'Luka hari ini mungkin akan sembuh, tapi bekasnya tidak akan pernah hilang.',
  'Sakit hati yang paling sunyi adalah ketika menangis tanpa suara di malam hari.',
  'Berharap pada manusia itu mengecewakan, jadi belajarlah untuk bergantung pada diri sendiri.',
  'Tersenyum di depan banyak orang bukan berarti hidup baik-baik saja.',
  'Kamu adalah alasan kenapa aku belajar cara merelakan sesuatu yang tidak bisa dimiliki.',
  'Menjadi kuat adalah satu-satunya pilihan ketika tidak ada seorang pun yang bisa diandalkan.',
  'Berhenti mengejar orang yang tidak pernah menoleh ke belakang adalah bentuk penghargaan untuk diri sendiri.',
  'Ada rindu yang sengaja ditenggelamkan karena tahu tidak akan pernah sampai.',
  'Kesendirian ini mengajarkan bahwa tidak semua orang yang datang berniat untuk tinggal.',
  'Sakitnya dikecewakan orang terdekat jauh lebih membekas daripada musuh.',
  'Hati yang terluka butuh waktu yang sangat lama untuk kembali percaya.',
  'Berada di tengah keramaian tapi merasa menjadi orang paling kesepian di dunia.',
  'Tidak ada yang lebih menyedihkan selain menjadi orang kedua di hati seseorang.',
  'Terkadang kita harus melepaskan bukan karena tidak cinta, tapi karena lelah terluka.',
  'Kepercayaan itu seperti kaca, sekali pecah tidak akan pernah sama lagi meski disatukan.',
  'Rasa sakit ini mengajarkan arti pendewasaan yang paling kejam.',
  'Mengingatmu adalah kebiasaan buruk yang sulit sekali dihilangkan.',
  'Kenangan adalah hantu yang paling sering menghantui di sepi malam.',
  'Cinta itu buta, tapi kenapa lukanya bisa terlihat begitu jelas?',
  'Aku memilih pergi bukan karena benci, tapi karena harganya diriku sudah tidak dihargai.',
  'Sakit hati mengajari kita bagaimana cara bertahan dalam dinginnya dunia.',
  'Kenangan terindah terkadang menjadi racun paling mematikan dalam ingatan.',
  'Aku belajar ikhlas dari cara Tuhan mengambil kebahagiaan itu satu per satu.',
  'Orang yang paling sering tersenyum biasanya adalah orang yang paling mahir menyembunyikan luka.',
  'Mengikhlaskanmu adalah ujian terberat dalam hidupku sejauh ini.',
  'Aku hanya ingin dihargai, bukan dikasihani.',
  'Sembuh dari luka batin butuh proses yang sunyi dan panjang.',
  'Kamu adalah babak paling indah dalam hidupku, namun sekaligus akhir yang paling menyakitkan.',
  'Perasaan ini tulus, tapi salah orang.',
  'Aku memilih diam karena tahu suaraku tidak akan pernah didengar lagi.',
  'Cinta sejati tidak akan membuatmu menangis setiap malam.',
  'Aku menyerah bukan karena kalah, tapi karena lelah berjuang sendirian.',
]

const pick = (list) => list[Math.floor(Math.random() * list.length)]

let handler = async (m, { command, reply }) => {
  const galau = ['katagalau', 'galau', 'katasedih'].includes(command)
  const text = galau ? `*KATA GALAU*\n\n"${pick(GALAU)}"` : `KATA BUCIN\n\n"${pick(BUCIN)}"`
  return reply(text)
}

handler.command = ['katabucin', 'bucin', 'katagalau', 'galau', 'katasedih']
handler.help = handler.command.slice()
handler.tags = ['fun']
handler.description = 'Kata-kata bucin dan galau ala ALYA MD'

export default handler
