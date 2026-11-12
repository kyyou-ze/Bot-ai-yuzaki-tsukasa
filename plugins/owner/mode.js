import { updateConfigValue } from '../../lib/core/file.js'

// Mode bot dipisah per platform: WhatsApp (global.public) dan Telegram (global.publicTelegram).
//   .mode                -> lihat mode kedua platform
//   .public [wa|tg|all]  -> semua orang bisa memakai bot
//   .self   [wa|tg|all]  -> hanya owner (dan akun bot sendiri di WhatsApp)
// Tanpa argumen, yang diubah adalah platform tempat command dijalankan.
const label = (isPublic) => (isPublic ? 'Public' : 'Self')
const NAME = { whatsapp: 'WhatsApp', telegram: 'Telegram' }
const KEY = { whatsapp: 'public', telegram: 'publicTelegram' }

const ALIAS = {
    wa: ['whatsapp'], whatsapp: ['whatsapp'],
    tg: ['telegram'], tele: ['telegram'], telegram: ['telegram'],
    all: ['whatsapp', 'telegram'], semua: ['whatsapp', 'telegram'], both: ['whatsapp', 'telegram']
}

let handler = async (m, { sock, reply, command, prefix, text }) => {
    const here = sock?.platform === 'telegram' ? 'telegram' : 'whatsapp'
    const status = () =>
        `- WhatsApp : *${label(global.isPublic('whatsapp'))}*\n- Telegram : *${label(global.isPublic('telegram'))}*`

    if (command === 'mode') {
        return reply(
            `･ﾟ✦ Mode bot saat ini:\n${status()}\n\n` +
            `${prefix}public [wa|tg|all] : semua orang bisa pakai bot\n` +
            `${prefix}self [wa|tg|all] : hanya owner\n\n` +
            `Tanpa argumen, yang diubah ${NAME[here]} (platform ini).`
        )
    }

    const arg = String(text || '').trim().toLowerCase().split(/\s+/)[0]
    const targets = arg ? ALIAS[arg] : [here]
    if (!targets) return reply(`Platform tidak dikenal. Pilih: wa, tg, atau all.\nContoh: ${prefix}${command} tg`)

    const wantPublic = command === 'public'
    const changed = []
    let unsaved = false

    for (const p of targets) {
        if (global.isPublic(p) === wantPublic) continue
        if (p === 'telegram') global.publicTelegram = wantPublic
        else global.public = wantPublic // berlaku langsung
        if (!updateConfigValue(KEY[p], wantPublic)) unsaved = true // simpan ke config.js
        changed.push(p)
    }

    if (!changed.length) {
        return reply(`･ﾟ✦ ${targets.map(p => NAME[p]).join(' & ')} sudah dalam mode *${label(wantPublic)}*.\n\n${status()}`)
    }

    await reply(
        `･ﾟ✦ Mode ${changed.map(p => NAME[p]).join(' & ')} diubah ke *${label(wantPublic)}*.\n\n${status()}\n\n` +
        (wantPublic
            ? 'Semua orang di platform itu sekarang bisa memakai bot. Command owner/premium/admin tetap terkunci.'
            : 'Di platform itu sekarang hanya owner yang dilayani.') +
        (unsaved ? '\n\n_Gagal menyimpan ke config.js, mode akan kembali seperti semula setelah restart._' : '')
    )
}

handler.command = ['mode', 'public', 'self']
handler.help = ['mode', 'public [wa|tg|all]', 'self [wa|tg|all]']
handler.tags = ['owner']
handler.owner = true

export default handler
