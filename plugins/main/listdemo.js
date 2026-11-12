// .list — menu interaktif: gambar + single_select + semua tipe tombol
import { isIosId, chatIsIos } from '../../lib/platform/wa.js'

// iPhone hanya merender sebagian tombol native flow (reply, url, copy, call). Tombol list (single_select),
// address, location, dan reminder tidak dikenali iOS, dan satu saja yang tidak dikenali bisa membuat
// seluruh pesan tidak tampil, jadi penerima iPhone dapat versi ringkas.
// Yang dicek adalah PENERIMA, bukan pengirim perintah: di chat pribadi dari pesan terakhir lawan bicara
// (bot ini sering dipakai owner dari Android, sementara lawan bicaranya iPhone); di grup dari pengirim perintah.
const isIosMessage = (m) => isIosId(m.key?.id) || (!m.isGroup && chatIsIos(m.chat))

let handler = async (m, { sock, jid, prefix }) => {
    const p = prefix || '.'

    if (isIosMessage(m)) {
        return sock.sendButtons(jid, {
            image: global.thumb?.utama,
            text: 'Pilih menu yang kamu butuhkan 👇',
            footer: global.namebot || 'Bot',
            mentions: [m.sender],
            buttons: [
                { type: 'reply', text: 'MENU', id: `${p}menu` },
                { type: 'url', text: 'Youtube', url: 'https://youtube.com/@yannrzy' },
                { type: 'call', text: 'Call', phone: global.owners?.[0] || '628999' },
                { type: 'copy', text: 'Copy', code: 'message', id: '123456789' },
                { type: 'reply', text: 'Owner Bot', id: `${p}owner` }
            ]
        }, { quoted: m })
    }

    await sock.sendButtons(jid, {
        image: global.thumb?.utama,
        text: 'Pilih menu yang kamu butuhkan 👇',
        footer: global.namebot || 'Bot',
        mentions: [m.sender],
        newsletter: { name: global.nameSaluran, jid: global.idSaluran },
        business: true,
        buttons: [
            {
                type: 'list',
                text: 'MENU',
                sections: [{
                    title: 'List menu yang sering dipakai',
                    highlight_label: 'Populer',
                    rows: [{ title: 'Menu', description: '📌 Menampilkan Menu', id: `${p}menu` }]
                }]
            },
            { type: 'url', text: 'Youtube', url: 'https://youtube.com/@yannrzy' },
            { type: 'call', text: 'Call', phone: global.owners?.[0] || '628999' },
            { type: 'copy', text: 'Copy', code: 'message', id: '123456789' },
            { type: 'reminder', text: 'Reminder', id: 'message' },
            { type: 'cancel_reminder', text: 'Cancel Reminder', id: 'message' },
            { type: 'address', text: 'Address Message', id: 'indonesia' },
            { type: 'location', text: 'Send Location' },
            { type: 'reply', text: 'Owner Bot', id: `${p}owner` }
        ]
    }, { quoted: m })
}

handler.command = ['listdemo']
handler.tags = ['main']

export default handler
