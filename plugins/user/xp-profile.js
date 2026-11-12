import { adapt } from '../../lib/engine/plugins.js'
import { getMessageCounts, buttonsToText } from '../../lib/platform/wa.js'
import { parsePhoneNumber } from 'awesome-phonenumber'
import { createHash } from 'crypto'
import moment from 'moment-timezone'
import sharp from 'sharp'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const GARIS = '──────────────────────'

// foto default dibuat lokal (tanpa download), jadi tidak bergantung pada host gambar luar
let fotoDefaultCache = null
async function fotoDefault() {
  if (fotoDefaultCache) return fotoDefaultCache
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <rect width="640" height="640" fill="#cfd8dc"/>
    <circle cx="320" cy="250" r="110" fill="#90a4ae"/>
    <path d="M100 640c0-130 100-210 220-210s220 80 220 210z" fill="#90a4ae"/></svg>`
  fotoDefaultCache = await sharp(Buffer.from(svg)).png().toBuffer()
  return fotoDefaultCache
}

// jaga-jaga kalau nilainya NaN
const angka = (v, cadangan = 0) => (Number.isFinite(Number(v)) ? Number(v) : cadangan)
const fmt = (v) => Math.floor(angka(v)).toLocaleString('id-ID')
const rp = (v) => `Rp${fmt(v)}`
const idOf = (jid) => String(jid || '').split('@')[0].split(':')[0]

// format birthday: 17-8-2005
function bacaUlangTahun(birthday) {
  if (!birthday) return { teks: 'Belum di set', umur: null }
  const [d, bln, thn] = String(birthday).split('-').map(Number)
  if (!d || !bln || !BULAN[bln - 1]) return { teks: 'Belum di set', umur: null }
  const teks = `${d} ${BULAN[bln - 1]}${thn ? ' ' + thn : ''}`
  if (!thn) return { teks, umur: null }

  const now = new Date()
  const belumUlangTahun = now.getMonth() + 1 < bln || (now.getMonth() + 1 === bln && now.getDate() < d)
  return { teks, umur: now.getFullYear() - thn - (belumUlangTahun ? 1 : 0) }
}

// sisa durasi premium dalam hari
function infoPremium(user) {
  const t = angka(user.premiumTime)
  if (t === Infinity || t > Date.now() * 10) return 'Ya (permanen)'
  if (t > Date.now()) {
    const hari = Math.ceil((t - Date.now()) / 86400000)
    return `Ya (${hari} hari lagi)`
  }
  return user.premium ? 'Ya' : 'Tidak'
}

// peringkat global berdasarkan total kekayaan (money + bank), hanya user terdaftar
function rankGlobal(who) {
  const semua = Object.entries(global.db.data.users || {})
    .filter(([, u]) => u && u.registered)
    .map(([jid, u]) => [jid, angka(u.money) + angka(u.bank)])
    .sort((a, b) => b[1] - a[1])
  const idx = semua.findIndex(([jid]) => jid === who)
  return { posisi: idx >= 0 ? idx + 1 : null, total: semua.length }
}

// statistik di grup tempat command dipakai: jumlah pesan dan peringkatnya
function statGrup(chat, who) {
  const { counts } = getMessageCounts(chat)
  const urut = Object.entries(counts || {}).sort((a, b) => b[1] - a[1])
  const id = idOf(who)
  const idx = urut.findIndex(([k]) => idOf(k) === id)
  return { pesan: idx >= 0 ? urut[idx][1] : 0, posisi: idx >= 0 ? idx + 1 : null, total: urut.length }
}

let handler = async (m, { conn, usedPrefix = '.' }) => {
  const who = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
  const user = global.db.data.users[who]
  if (!user) return m.reply(`${global.namebot || 'Bot'} tidak menemukan user itu di database`)

  const diriSendiri = who === m.sender
  const foto = await conn.profilePictureUrl(who, 'image').catch(() => null)
  const bio = (await conn.fetchStatus(who).catch(() => null))?.status || 'Tidak ada bio'
  // getName bisa sinkron (string) atau async tergantung versi, jadi dibungkus try/await
  const namaWA = await (async () => { try { return await conn.getName(who) } catch { return '' } })()
  const nama = user.registered && user.name ? user.name : (namaWA || idOf(who))
  const raw = idOf(who)
  const nomor = (() => { try { return parsePhoneNumber('+' + raw).number?.international || '+' + raw } catch { return '+' + raw } })()

  const ultah = bacaUlangTahun(user.birthday)
  const umur = angka(user.age, -1) > 0 ? angka(user.age) : ultah.umur
  const sn = createHash('md5').update(who).digest('hex')
  const rank = rankGlobal(who)
  const sekarang = moment().tz('Asia/Jakarta')
  const terdaftar = angka(user.regTime, -1) > 0 ? moment(user.regTime).tz('Asia/Jakarta').format('DD MMMM YYYY') : null

  const baris = []
  baris.push('🪪 *PROFIL PENGGUNA*', GARIS, '')
  baris.push(`👤 *Nama* : ${nama}`)
  baris.push(`📱 *Kontak* : ${nomor}`)
  if (diriSendiri) baris.push(`🔑 *Serial No.* : \`${sn}\``)
  baris.push(`🏷️ *Tag* : @${raw}`)
  baris.push(`💬 *Bio* : ${bio}`)
  if (umur) baris.push(`🎂 *Umur* : ${umur} tahun`)
  baris.push(`🎉 *Ulang tahun* : ${ultah.teks}`)
  baris.push(`📝 *Status* : ${user.registered ? 'Terdaftar' + (terdaftar ? ` (${terdaftar})` : '') : 'Belum terdaftar'}`)
  if (user.banned) baris.push('🚫 *Banned* : Ya')

  baris.push('', GARIS, '💰 *DOMPET & PROGRES*')
  baris.push(`• Saldo : ${rp(user.money)}`)
  baris.push(`• Bank : ${rp(user.bank)}`)
  baris.push(`• Total Kekayaan : ${rp(angka(user.money) + angka(user.bank))}`)
  baris.push(`• Role : ${user.role || 'Newbie'}`)
  baris.push(`• Level : ${fmt(user.level || 1)}`)
  baris.push(`• Exp : ${fmt(user.exp)}`)
  baris.push(`• Limit : ${fmt(user.limit)}`)
  baris.push(`• Health : ${fmt(user.health)}`)
  baris.push(`• Premium : ${infoPremium(user)}`)
  if (angka(user.warn) > 0) baris.push(`• Warn : ${fmt(user.warn)}`)
  baris.push(`• Rank Global : ${rank.posisi ? `#${rank.posisi} dari ${rank.total}` : '-'}`)

  if (String(m.chat).endsWith('@g.us')) {
    const g = statGrup(m.chat, who)
    baris.push('', '👥 *STATISTIK GRUP*')
    baris.push(`• Peringkat : ${g.posisi ? `#${g.posisi} dari ${g.total}` : '-'}`)
    baris.push(`• Total Pesan : ${fmt(g.pesan)} pesan`)
  }

  baris.push('', GARIS, `🕒 ${sekarang.format('dddd, DD MMMM YYYY • HH:mm')} WIB`)
  if (diriSendiri) baris.push('', '💡 _Gunakan tombol di bawah untuk menyalin Serial Number (SN)!_')

  const caption = baris.join('\n')
  const footer = global.namebot || 'Bot'

  const buttons = []
  if (diriSendiri) buttons.push({ type: 'copy', text: '📋 Salin SN', code: sn })
  buttons.push({ type: 'reply', text: '🎒 Cek Inventory', id: `${usedPrefix}rpg-inventory` })
  buttons.push({ type: 'reply', text: '🧍 Profil RPG', id: `${usedPrefix}rpg-me` })

  const opsi = { quoted: m }
  const kirimTombol = (image) =>
    conn.sendButtons(m.chat, { text: caption, footer, mentions: [who], buttons, ...(image ? { image } : {}) }, opsi)

  // urutan: tombol + foto WA -> tombol + foto default -> foto biasa -> teks saja
  if (foto) { try { return await kirimTombol({ url: foto }) } catch {} }
  try { return await kirimTombol(await fotoDefault()) } catch {}
  try { return await kirimTombol() } catch {}
  const tambahan = buttonsToText?.(buttons)
  const teks = tambahan ? `${caption}\n\n${tambahan}` : caption
  if (foto) { try { return await conn.sendMessage(m.chat, { image: { url: foto }, caption: teks, mentions: [who] }, opsi) } catch {} }
  await conn.sendMessage(m.chat, { text: teks, mentions: [who] }, opsi)
}

handler.help = ['xp-profile']
handler.tags = ['user']
handler.command = ['xp-profile', 'profile', 'me']
handler.limit = false

export default adapt(handler, { category: 'user' })
