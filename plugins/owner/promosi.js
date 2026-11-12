// plugins/owner/promosi.js
// Auto promosi ke grup tertentu (default tiap 20 menit), tampilan gambar + teks
// (tanpa tombol).
//
// Perintah (owner):
//   .promosi on | off            nyalakan / matikan
//   .promosi addgrup [idgrup]    tambah grup (tanpa id = grup tempat perintah dikirim)
//   .promosi delgrup [idgrup]    hapus grup
//   .promosi list                lihat status + daftar grup
//   .promosi interval <menit>    ubah jeda (minimal 5 menit)
//   .promosi set <teks>          ubah isi promosi (kosongkan: .promosi set reset)
//   .promosi link <url>          ubah link
//   .promosi label <teks>       ubah label link
//   .promosi test                kirim sekarang ke semua grup terdaftar
//
// Wajib: tambahkan 1 baris di index.js, tepat setelah `currentSock = sock`:
//   global.sock = sock

import { primaryPrefix } from '../../lib/engine/plugins.js'

const DEFAULTS = {
    on: false,
    interval: 20, // menit
    groups: [],
    text: '',
    link: 'https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16',
    button: 'information',
    lastRun: 0
}

const MIN_INTERVAL = 5
const TICK = 30 * 1000
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ───────── config (disimpan di global.db supaya awet setelah restart) ─────────
const getCfg = () => ({ ...DEFAULTS, ...(global.db?.promosi || {}) })

// global.db adalah Proxy: harus di-assign ulang agar tersimpan ke file
const saveCfg = (patch) => {
    global.db.promosi = { ...getCfg(), ...patch }
}

// ───────── isi pesan (gaya info.js) ─────────
function buildMessage(cfg) {
    const nama = global.namebot || 'Bot'
    const p = primaryPrefix() || '.'

    const body = `> *halow semuanya, ${nama} izin promosi yaa*`
    const footer = (cfg.text?.trim() || `
${nama} siap bantu kebutuhan kamu.

Cek produk yang tersedia lewat *${p}produk*, atau ketik *${p}menu* untuk lihat semua fitur.

Untuk informasi terbaru, update, dan promo lainnya, silakan kunjungi saluran resmi di link bawah ini
`).trim()

    return { body, footer }
}

// Urutan percobaan: gambar URL -> teks biasa. Link ditulis di akhir pesan (tanpa tombol).
async function sendPromo(sock, jid, cfg) {
    const { body, footer } = buildMessage(cfg)
    const text = [body, footer, `${cfg.button}: ${cfg.link}`].join('\n\n')

    if (global.thumb?.utama) {
        try {
            return await sock.sendMessage(jid, { image: { url: global.thumb.utama }, caption: text })
        } catch (e) {
            console.error('[PROMOSI] gambar gagal:', e.message)
        }
    }

    return sock.sendMessage(jid, { text })
}

async function broadcast(sock, cfg) {
    let ok = 0
    let fail = 0
    for (const jid of cfg.groups) {
        try {
            await sendPromo(sock, jid, cfg)
            ok++
        } catch (e) {
            fail++
            console.error(`[PROMOSI] gagal kirim ke ${jid}:`, e.message)
        }
        // jeda acak antar grup supaya tidak terlihat seperti spam massal
        await sleep(5000 + Math.floor(Math.random() * 5000))
    }
    return { ok, fail }
}

// ───────── scheduler ─────────
// Cek tiap 30 detik, kirim kalau sudah lewat `interval` menit sejak lastRun.
// lastRun disimpan di db, jadi jadwal lanjut normal setelah restart.
let running = false

async function tick() {
    if (running) return
    const cfg = getCfg()
    if (!cfg.on || !cfg.groups.length) return
    if (Date.now() - cfg.lastRun < cfg.interval * 60 * 1000) return

    const sock = global.sock
    if (!sock?.user) return

    running = true
    try {
        saveCfg({ lastRun: Date.now() })
        const { ok, fail } = await broadcast(sock, cfg)
        console.log(`[PROMOSI] terkirim ${ok} grup, gagal ${fail}`)
    } catch (e) {
        console.error('[PROMOSI] tick error:', e.message)
    } finally {
        running = false
    }
}

// plugin di-hot-reload: bersihkan timer lama supaya tidak dobel
if (global.__promosiTimer) clearInterval(global.__promosiTimer)
global.__promosiTimer = setInterval(tick, TICK)
global.__promosiTimer.unref?.()

// ───────── command ─────────
let handler = async (m, { sock, text, prefix, jid, reply }) => {
    const p = prefix || primaryPrefix() || '.'
    // pisahkan sub-command dari isinya TANPA merusak baris baru (teks promosi bisa multi-baris)
    const parsed = String(text || '').trim().match(/^(\S*)\s*([\s\S]*)$/)
    const sub = parsed?.[1] || ''
    const value = (parsed?.[2] || '').trim()
    const cfg = getCfg()

    switch (sub.toLowerCase()) {
        case 'on': {
            if (!cfg.groups.length) return reply(`Belum ada grup. Tambah dulu dengan *${p}promosi addgrup*`)
            saveCfg({ on: true, lastRun: 0 })
            return reply(`Auto promosi *aktif*. Dikirim tiap *${cfg.interval} menit* ke *${cfg.groups.length}* grup (kiriman pertama dalam ±30 detik).`)
        }

        case 'off': {
            saveCfg({ on: false })
            return reply('Auto promosi *dimatikan*.')
        }

        case 'addgrup': {
            const target = value || (m.isGroup ? jid : '')
            if (!target.endsWith('@g.us')) return reply(`Kirim perintah ini di dalam grup, atau pakai id grup:\n${p}promosi addgrup 1203xxxxxxxx@g.us\n\n(id grup bisa dilihat dengan *${p}idgrup*)`)
            if (cfg.groups.includes(target)) return reply('Grup itu sudah ada di daftar.')
            saveCfg({ groups: [...cfg.groups, target] })
            return reply(`Grup ditambahkan. Total: *${cfg.groups.length + 1}* grup.`)
        }

        case 'delgrup': {
            const target = value || (m.isGroup ? jid : '')
            if (!cfg.groups.includes(target)) return reply('Grup itu tidak ada di daftar.')
            saveCfg({ groups: cfg.groups.filter(g => g !== target) })
            return reply('Grup dihapus dari daftar promosi.')
        }

        case 'interval': {
            const minutes = parseInt(value)
            if (!minutes || minutes < MIN_INTERVAL) return reply(`Isi angka menit, minimal *${MIN_INTERVAL}*.\nContoh: ${p}promosi interval 20`)
            saveCfg({ interval: minutes })
            return reply(`Jeda promosi diubah jadi *${minutes} menit*.`)
        }

        case 'set': {
            if (!value) return reply(`Teksnya belum diisi.\nContoh: ${p}promosi set Halo semua! Ada promo hari ini...\n\nReset ke teks bawaan: ${p}promosi set reset`)
            saveCfg({ text: value.toLowerCase() === 'reset' ? '' : value })
            return reply(value.toLowerCase() === 'reset' ? 'Teks promosi dikembalikan ke bawaan.' : 'Teks promosi diperbarui.')
        }

        case 'link': {
            if (!/^https?:\/\//i.test(value)) return reply(`Isi link yang valid.\nContoh: ${p}promosi link https://yannrzy.my.id`)
            saveCfg({ link: value })
            return reply('Link diperbarui.')
        }

        case 'label':
        case 'tombol': {
            if (!value) return reply(`Isi label link-nya.\nContoh: ${p}promosi label kunjungi saluran`)
            saveCfg({ button: value.slice(0, 25) })
            return reply('Label link diperbarui.')
        }

        case 'test': {
            if (!cfg.groups.length) return reply(`Belum ada grup. Tambah dulu dengan *${p}promosi addgrup*`)
            await reply(`Mengirim promosi ke ${cfg.groups.length} grup...`)
            const { ok, fail } = await broadcast(sock, cfg)
            return reply(`Selesai. Berhasil: *${ok}*, gagal: *${fail}*`)
        }

        case 'list': {
            const lines = []
            for (const [i, g] of cfg.groups.entries()) {
                const meta = await sock.groupMetadata(g).catch(() => null)
                lines.push(`${i + 1}. ${meta?.subject || '(tidak bisa dibaca)'}\n   ${g}`)
            }
            return reply(
                `╭─▣「 *AUTO PROMOSI* 」▣─╮\n` +
                `│ Status : *${cfg.on ? 'aktif' : 'nonaktif'}*\n` +
                `│ Jeda   : *${cfg.interval} menit*\n` +
                `│ Tombol : *${cfg.button}*\n` +
                `│ Link   : ${cfg.link}\n` +
                `│ Teks   : ${cfg.text ? 'kustom' : 'bawaan'}\n` +
                `╰─────────────➤\n\n` +
                (lines.length ? `Daftar grup:\n${lines.join('\n')}` : 'Belum ada grup terdaftar.')
            )
        }

        default:
            return reply(
                `*AUTO PROMOSI*\n\n` +
                `${p}promosi on / off\n` +
                `${p}promosi addgrup [idgrup]\n` +
                `${p}promosi delgrup [idgrup]\n` +
                `${p}promosi list\n` +
                `${p}promosi interval <menit>\n` +
                `${p}promosi set <teks>\n` +
                `${p}promosi link <url>\n` +
                `${p}promosi label <teks>\n` +
                `${p}promosi test`
            )
    }
}

handler.command = ['promosi']
handler.tags = ['owner']
handler.owner = true

export default handler
