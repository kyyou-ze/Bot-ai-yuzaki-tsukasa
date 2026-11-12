import { updateConfigValue } from '../../lib/core/file.js'
import { isNoButton } from '../../lib/core/buttonmode.js'

// Atur global.buttonMode lewat command (khusus owner).
//   .setbutton        -> lihat mode sekarang
//   .setbutton on     -> global.buttonMode = true  (pakai button)
//   .setbutton off    -> global.buttonMode = false (tanpa button, teks biasa)
// Perubahan berlaku langsung dan disimpan ke config.js.

const ALIAS = {
    on: true, true: true, button: true, btn: true, tombol: true,
    off: false, false: false, nobutton: false, 'no-button': false, nobtn: false, teks: false, text: false, plain: false
}

const LABEL = {
    true: '🔘 true (pakai button)',
    false: '📝 false (tanpa button, teks biasa)'
}

let handler = async (m, { sock, jid, reply, prefix, text }) => {
    const p = prefix || '.'
    const now = !isNoButton()
    const arg = String(text || '').trim().toLowerCase().split(/\s+/)[0]

    const info = `･ﾟ✦ Mode button saat ini: *${LABEL[now]}*\n\n` +
        `${p}setbutton on : mode pakai button\n` +
        `${p}setbutton off : mode tanpa button, semua jadi teks biasa`

    if (!arg) {
        if (sock.platform === 'telegram') return reply(info)

        try {
            return await sock.sendButtons(jid, {
                text: info,
                footer: global.namebot || 'Bot',
                buttons: [
                    { type: 'reply', text: '🔘 Button (true)', id: `${p}setbutton on` },
                    { type: 'reply', text: '📝 No Button (false)', id: `${p}setbutton off` }
                ]
            }, { quoted: m })
        } catch {
            return reply(info)
        }
    }

    if (!(arg in ALIAS)) return reply(`Mode *${arg}* tidak dikenal.\n\n${info}`)
    const mode = ALIAS[arg]

    if (mode === now && global.buttonMode === mode) {
        return reply(`･ﾟ✦ Mode button sudah *${LABEL[mode]}*.`)
    }

    global.buttonMode = mode // berlaku langsung
    const saved = updateConfigValue('buttonMode', mode) // simpan ke config.js (true / false)

    return reply(
        `･ﾟ✦ Mode button diubah ke *${LABEL[mode]}*.\n\n` +
        (mode
            ? 'Menu, store, dan fitur lain sekarang memakai button.'
            : 'Menu, store, dan fitur lain sekarang tampil sebagai teks biasa.') +
        (saved ? '' : '\n\n_Gagal menyimpan ke config.js, mode akan kembali seperti semula setelah restart._')
    )
}

handler.command = ['setbutton']
handler.help = ['setbutton [on|off]']
handler.tags = ['owner']
handler.owner = true

export default handler
