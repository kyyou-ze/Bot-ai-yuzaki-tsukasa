// .menfess 628xxxx|pesan   (atau: .menfess 628xxxx pesan)  kirim pesan anonim, hanya di chat pribadi bot
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, store, menfessNomor, menfessId, menfessRapikan, menfessIsi, menfessBatas, menfessCatat, menfessPetakan, menfessFooter, wibDay } from '../../lib/engine/features.js'

let handler = async (m, { conn, text, usedPrefix, isOwner, isPremium }) => {
    const c = cfg('menfess')
    const k = store()
    if (!c.on) return m.reply('Fitur menfess sedang dimatikan.')
    if (m.isGroup) return m.reply('Menfess hanya bisa dikirim lewat chat pribadi bot supaya identitasmu aman ya~')

    const user = global.db.data.users[m.sender]
    const raw = String(text || '').trim()
    let kiri, pesan
    if (raw.includes('|')) {
        const [a, ...b] = raw.split('|')
        kiri = a
        pesan = b.join('|').trim()
    } else {
        const mt = raw.match(/^(\S+)\s+([\s\S]+)$/)
        kiri = mt?.[1]
        pesan = mt?.[2]?.trim()
    }
    const tujuan = menfessNomor(kiri)
    if (!tujuan || !pesan) {
        return m.reply(`*MENFESS ANONIM* 💌\n\nKirim pesan tanpa nama!\n\nFormat:\n*${usedPrefix}menfess nomor|pesan*\n\nContoh:\n${usedPrefix}menfess 6281234567890|hai, kamu keren banget hari ini!\n\nPesan maks ${c.maxPanjang} karakter, tanpa link & nomor telepon.\nPenerima bisa membalas anonim cukup dengan *reply* pesannya.\n\nLainnya: *${usedPrefix}menfessku* (kotak masuk & kuota), *${usedPrefix}samaranmenfess* (nama samaran)`)
    }
    if (tujuan.length < 9 || tujuan.length > 15) return m.reply('Nomor tujuan tidak valid. Pakai format 628xxx atau 08xxx.')
    const salah = menfessIsi(pesan, c)
    if (salah) return m.reply(salah)

    if (k.menfessBan[m.sender]) return m.reply('🚫 Kamu dilarang memakai menfess.' + (k.menfessBan[m.sender].alasan ? `\nAlasan: ${k.menfessBan[m.sender].alasan}` : ''))

    const tujuanJid = `${tujuan}@s.whatsapp.net`
    if (tujuanJid === m.sender) return m.reply('🍡 Masa kirim menfess ke diri sendiri~')

    const batas = menfessBatas(user, c)
    if (batas) return m.reply(batas)

    const cek = await conn.onWhatsApp(tujuanJid).catch(() => null)
    if (cek && !cek[0]?.exists) return m.reply('Nomor itu tidak terdaftar di WhatsApp.')
    const jidTujuan = cek?.[0]?.jid || tujuanJid

    if (k.menfessBlock[tujuanJid] || k.menfessBlock[jidTujuan] || k.menfessPair[`${tujuanJid}|${m.sender}`] || k.menfessPair[`${jidTujuan}|${m.sender}`]) {
        return m.reply('Penerima tidak menerima menfess.')
    }

    // batas per tujuan per hari (anti-spam ke satu orang)
    const hari = wibDay()
    const keDia = Object.values(k.menfess).filter((d) => d.from === m.sender && d.to === jidTujuan && wibDay(d.t) === hari).length
    if (keDia >= c.maxPerTujuan) return m.reply(`Kamu sudah mengirim ${c.maxPerTujuan} menfess ke nomor itu hari ini. Coba lagi besok ya.`)

    // bayar limit (non-premium)
    const biaya = Number(c.biayaLimit) || 0
    const bayar = biaya && !isPremium && !isOwner
    if (bayar && (Number(user.limit) || 0) < biaya) return m.reply(`Limit kamu habis. Menfess butuh ${biaya} limit.`)

    const id = menfessId(k)
    const nama = user.menfessNama || 'Seseorang'
    const sent = await conn.sendMessage(jidTujuan, {
        text: `💌 *MENFESS* · #${id}\n\nKamu mendapat pesan anonim dari *${nama}*:\n\n“${pesan}”\n\n${menfessFooter(usedPrefix, id)}`
    }).catch(() => { throw 'Gagal mengirim, penerima tidak bisa dihubungi.' })

    const now = Date.now()
    k.menfess[id] = { from: m.sender, to: jidTujuan, t: now, last: now, pesan, log: [{ by: 'a', t: now, pesan }], kirim: sent?.key?.id ? [sent.key.id] : [] }
    menfessPetakan(k, sent?.key?.id, id)
    menfessRapikan(k)
    global.db.kaguya = k
    menfessCatat(user, 'kirim')
    if (bayar) user.limit -= biaya

    await m.reply(`✅ Menfess terkirim secara anonim ke ${tujuan}!\n🆔 ID: *${id}*${bayar ? `\n🎫 -${biaya} limit` : ''}\n\nKalau dibalas, balasannya masuk ke chat ini. Reply balasan itu untuk lanjut ngobrol.\nTarik pesan: *${usedPrefix}tarikmenfess ${id}*`)
}

handler.help = ['menfess nomor|pesan']
handler.tags = ['menfess']
handler.command = ['menfess', 'confess']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
