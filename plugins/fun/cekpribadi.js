// CEK KADAR (ALYA MD) — hasil acak yang lucu, target bisa tag/reply/diri sendiri.
// Command: cekalim, cekcabul, cekpacar, cekpanjang, cektahanlama

const targetOf = (m) =>
  m.mentionedJid?.[0] || m.quoted?.sender || m.sender

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const SPECS = {
  cekalim: {
    title: 'CEK KADAR KEALIMAN',
    label: 'Tingkat Kealiman',
    unit: '%',
    value: () => rand(0, 100),
    tiers: [
      [20, 'Jauh dari kata alim, kerjanya nongkrong mulu tiap malam.'],
      [40, 'Alim kalau lagi di depan orang tua atau guru doang.'],
      [60, 'Standar, rajin ibadah wajib tapi kalau sunnah sering lewat.'],
      [85, 'Alim banget, rajin beribadah dan pembawaannya adem.'],
      [100, 'Ahli ibadah tingkat nasional! Auranya benar-benar menyejukkan hati.'],
    ],
  },
  cekcabul: {
    title: 'CEK KADAR CABUL',
    label: 'Tingkat Kecabulan',
    unit: '%',
    value: () => rand(0, 100),
    tiers: [
      [20, 'Kelakuan lurus dan bersih, jauh dari kata-kata atau pikiran cabul.'],
      [40, 'Masih aman, paling cuma ikut-ikutan tersenyum kalau ada candaan.'],
      [60, 'Standar manusia pada umumnya, kadang suka nyeletuk becandaan nakal.'],
      [85, 'Waduh, mulai aktif dan gercep kalau udah bahas topik-topik meresahkan.'],
      [100, 'Sudah tahap akut! Pikirannya dipenuhi hal-hal cabul tanpa kenal waktu.'],
    ],
  },
  cekpacar: {
    title: 'CEK STATUS PACAR',
    label: 'Skor',
    unit: '',
    value: () => rand(-10, 10),
    tiers: [
      [0, 'Jomblo sejati, menikmati hidup tanpa pasangan dengan tenang.'],
      [5, 'Punya pacar, tapi hubungannya rawan dan tidak setia.'],
      [10, 'Punya pacar, tapi tipe yang suka mendua alias sangat tidak setia.'],
    ],
  },
  cekpanjang: {
    title: 'CEK PANJANG',
    label: 'Ukuran',
    unit: ' cm',
    value: () => rand(5, 25),
    tiers: [
      [8, 'Ukuran minimalis, yang penting tetap percaya diri.'],
      [12, 'Ukuran standar pada umumnya, sudah pas dan normal.'],
      [16, 'Ukuran di atas rata-rata, cukup membanggakan.'],
      [25, 'Ukuran luar biasa besar, benar-benar di luar nalar!'],
    ],
  },
  cektahanlama: {
    title: 'CEK KADAR TAHAN LAMA',
    label: 'Tingkat Ketahanan',
    unit: '%',
    value: () => rand(0, 100),
    tiers: [
      [20, 'Baru mulai sebentar udah habis napas, kurang olahraga nih.'],
      [40, 'Masih di bawah rata-rata, perlu banyak latihan fisik dan pemanasan.'],
      [60, 'Standar, lumayan buat durasi normal tapi jangan diporsir.'],
      [85, 'Cukup tangguh dan staminanya terjaga dengan baik.'],
      [100, 'Luar biasa! Staminanya seperti mesin diesel, tahan lama tanpa batas.'],
    ],
  },
}

function describe(spec, value) {
  for (const [limit, text] of spec.tiers) if (value <= limit) return text
  return spec.tiers[spec.tiers.length - 1][1]
}

let handler = async (m, { sock, command, jid, reply }) => {
  const spec = SPECS[command]
  if (!spec) return true

  const target = targetOf(m)
  const value = spec.value()
  const text = [
    spec.title,
    '',
    `Target: @${String(target).split('@')[0]}`,
    `${spec.label}: ${value}${spec.unit}`,
    '',
    `_${describe(spec, value)}_`,
  ].join('\n')

  await sock.sendMessage(jid, { text, mentions: [target] }, { quoted: m })
  return true
}

handler.command = ['cekalim', 'cekcabul', 'cekpacar', 'cekpanjang', 'cektahanlama']
handler.help = ['cekalim', 'cekcabul', 'cekpacar', 'cekpanjang', 'cektahanlama']
handler.tags = ['fun']
handler.description = 'Cek kadar acak ala ALYA MD (alim, cabul, pacar, panjang, tahan lama)'

export default handler
