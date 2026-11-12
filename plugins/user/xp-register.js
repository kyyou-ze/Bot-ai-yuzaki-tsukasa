import { adapt } from '../../lib/engine/plugins.js'
import { buttonsToText } from '../../lib/platform/wa.js'
import { createHash } from 'crypto'
import moment from 'moment-timezone'

// rentang umur acak untuk "Daftar Otomatis"
const AGE_MIN = 15
const AGE_MAX = 30

// nama manual: huruf/angka (termasuk huruf non-latin), spasi, garis bawah; pemisah nama dan umur: , . | : / -
const Reg = /^([\p{L}\p{N}_\s]+?)\s*[,.|:\/-]\s*(\d{1,3})$/iu

// rapikan nama dari WhatsApp: buang karakter kontrol/tak terlihat, rapatkan spasi, batasi panjang
const cleanName = (raw) =>
  String(raw || '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)

const randomAge = () => Math.floor(Math.random() * (AGE_MAX - AGE_MIN + 1)) + AGE_MIN

const quick = (text, id) => ({ type: 'reply', text, id })

const FALLBACK_PFP = 'https://cdn.zass.in/qiudOfDPf9.jpg'

// foto profil WA pengirim; kalau tidak ada/privasi ditutup, pakai foto bawaan
const getProfilePic = async (conn, jid) => {
  try {
    const url = await conn.profilePictureUrl(jid, 'image')
    if (url) return { url }
  } catch {}
  return { url: FALLBACK_PFP }
}

let handler = async (m, { text, usedPrefix, command, conn }) => {
  const p = usedPrefix
  const user = global.db.data.users[m.sender]
  const sn = createHash('md5').update(m.sender).digest('hex')
  const arg = String(text || '').trim()
  const lower = arg.toLowerCase()

  // kirim pesan dengan tombol; kalau gagal (gambar/tombol), turun ke teks biasa
  const sendBtn = async (body, buttons, image) => {
    const base = { text: body, footer: global.nameSaluran || global.namebot, buttons }
    try {
      return await conn.sendButtons(m.chat, image ? { ...base, image } : base, { quoted: m })
    } catch {}
    if (image) {
      try { return await conn.sendButtons(m.chat, base, { quoted: m }) } catch {}
    }
    const extra = buttonsToText(buttons)
    return m.reply(extra ? `${body}\n\n${extra}` : body)
  }

  // nama WhatsApp pengirim; kalau kosong/"Unknown", pakai nomornya
  const waName = () => {
    const name = cleanName(m.pushName)
    if (name && name.toLowerCase() !== 'unknown') return name
    return String(m.sender).split('@')[0]
  }

  // contoh nama untuk format manual: hanya karakter yang diterima format (tanpa emoji/simbol)
  const exampleName = () => waName().replace(/[^\p{L}\p{N}_\s]/gu, '').replace(/\s+/g, ' ').trim() || 'nama'

  // simpan data pendaftaran + kirim kartu berhasil
  const finish = async (name, age, via) => {
    const d = new Date()
    const week = d.toLocaleDateString('id', { weekday: 'long' })
    const date = d.toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' })
    const time = moment.tz('Asia/Jakarta').format('HH:mm:ss')

    user.name = name
    user.age = age
    user.regTime = +new Date()
    user.registered = true

    const caption = `
PENDAFTARAN BERHASIL

Nama : ${name}
Umur : ${age}
SN   : ${sn}
Cara : ${via}

Tanggal : ${week}, ${date}
Waktu   : ${time}

Data berhasil disimpan di ${global.namebot || 'Bot'}
`.trim()

    const pfp = await getProfilePic(conn, m.sender)

    return sendBtn(
      caption,
      [quick('📋 Menu Utama', `${p}menu`), { type: 'copy', text: '📋 Salin SN', code: sn }],
      pfp
    )
  }

  // ───── sudah terdaftar ─────
  if (user.registered) {
    return sendBtn(
      `Kamu sudah terdaftar di ${global.namebot || 'Bot'}\n\nNama : ${user.name}\nUmur : ${user.age}\nSN   : ${sn}`,
      [quick('📋 Menu Utama', `${p}menu`), { type: 'copy', text: '📋 Salin SN', code: sn }, quick('🗑 Hapus Data (Unreg)', `${p}unreg`)]
    )
  }

  // ───── menu pilihan cara daftar ─────
  if (!arg) {
    return sendBtn(
      `*PENDAFTARAN*\n\n` +
      `Hanya user yang terdaftar yang datanya disimpan di database.\n\n` +
      `⚡ *Otomatis* — pakai nama WhatsApp kamu (*${waName()}*), umur diacak ${AGE_MIN}–${AGE_MAX}\n` +
      `✍️ *Manual* — tentukan nama dan umur sendiri`,
      [quick('⚡ Daftar Otomatis', `${p}daftar auto`), quick('✍️ Daftar Manual', `${p}daftar manual`)]
    )
  }

  // ───── otomatis: nama WhatsApp + umur acak ─────
  if (['auto', 'otomatis'].includes(lower)) {
    return finish(waName(), randomAge(), 'Otomatis')
  }

  // ───── petunjuk manual ─────
  if (lower === 'manual') {
    return sendBtn(
      `*DAFTAR MANUAL*\n\n` +
      `Kirim dengan format:\n*${p}${command} nama,umur*\n\n` +
      `Contoh: *${p}${command} ${exampleName()},17*\n\n` +
      `Tekan *Salin Format* lalu ganti nama dan umurnya. Umur harus 5–100.`,
      [
        { type: 'copy', text: '📋 Salin Format', code: `${p}${command} ${exampleName()},17` },
        quick('⚡ Daftar Otomatis', `${p}daftar auto`)
      ]
    )
  }

  // ───── manual: nama,umur ─────
  if (!Reg.test(arg)) {
    return sendBtn(
      `Format salah.\n\nContoh: *${p}${command} yannrzy,17*\nAtau pilih salah satu tombol di bawah.`,
      [quick('⚡ Daftar Otomatis', `${p}daftar auto`), quick('✍️ Daftar Manual', `${p}daftar manual`)]
    )
  }

  let [, name, ageStr] = arg.match(Reg)
  name = name.trim()
  const age = parseInt(ageStr)

  if (!name || !age) return m.reply('Nama atau umur tidak valid')
  if (name.length > 100) return m.reply('Nama maksimal 100 karakter')
  if (age < 5 || age > 100) return m.reply('Umur harus 5 - 100')

  return finish(name, age, 'Manual')
}

handler.help = ['xp-register']
handler.tags = ['user']
handler.command = ['xp-register', 'daftar']

export default adapt(handler, { category: 'user' })
