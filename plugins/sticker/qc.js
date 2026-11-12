// ───────── qc ─────────
// Dipecah dari plugins/sticker/maker.js (dulu digabung dengan fitur lain dalam satu file)

import axios from 'axios'
import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'
import { getAssetBuffer } from '../../lib/engine/plugins.js'
import { isIosId, chatIsIos } from '../../lib/platform/wa.js'

const _qc = (() => {
const pluginConfig = {
    name: 'qc',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker quote chat, ketik teks lalu pilih warna lewat tombol',
    usage: '.qc <text> (lalu pilih warna lewat tombol) | .qc <warna> <text>',
    example: '.qc Hai semuanya!',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const COLORS = {
    pink: '#f68ac9',
    blue: '#6cace4',
    red: '#f44336',
    green: '#4caf50',
    yellow: '#ffeb3b',
    purple: '#9c27b0',
    darkblue: '#0d47a1',
    lightblue: '#03a9f4',
    ash: '#9e9e9e',
    orange: '#ff9800',
    black: '#000000',
    white: '#ffffff',
    teal: '#008080',
    lightpink: '#FFC0CB',
    chocolate: '#A52A2A',
    salmon: '#FFA07A',
    magenta: '#FF00FF',
    tan: '#D2B48C',
    wheat: '#F5DEB3',
    deeppink: '#FF1493',
    fire: '#B22222',
    skyblue: '#00BFFF',
    brightskyblue: '#1E90FF',
    hotpink: '#FF69B4',
    lightskyblue: '#87CEEB',
    seagreen: '#20B2AA',
    darkred: '#8B0000',
    orangered: '#FF4500',
    cyan: '#48D1CC',
    violet: '#BA55D3',
    mossgreen: '#00FF7F',
    darkgreen: '#008000',
    navyblue: '#191970',
    darkorange: '#FF8C00',
    darkpurple: '#9400D3',
    fuchsia: '#FF00FF',
    darkmagenta: '#8B008B',
    darkgray: '#2F4F4F',
    peachpuff: '#FFDAB9',
    darkishgreen: '#BDB76B',
    darkishred: '#DC143C',
    goldenrod: '#DAA520',
    darkishgray: '#696969',
    darkishpurple: '#483D8B',
    gold: '#FFD700',
    silver: '#C0C0C0'
}

const DEFAULT_PP = 'https://files.catbox.moe/nwvkbt.png'

async function getProfilePicture(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image')
    } catch {
        return DEFAULT_PP
    }
}

// Pengelompokan warna untuk tombol list (nama harus ada di COLORS)
const COLOR_SECTIONS = [
    { title: 'Populer', names: ['pink', 'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'black', 'white'] },
    { title: 'Pastel & Terang', names: ['lightpink', 'hotpink', 'deeppink', 'salmon', 'peachpuff', 'wheat', 'tan', 'lightblue', 'lightskyblue', 'skyblue', 'cyan', 'seagreen', 'mossgreen', 'violet', 'gold', 'silver'] },
    { title: 'Gelap & Tegas', names: ['darkblue', 'brightskyblue', 'navyblue', 'darkgreen', 'darkishgreen', 'darkred', 'darkishred', 'fire', 'orangered', 'darkorange', 'goldenrod', 'chocolate', 'darkpurple', 'darkishpurple', 'darkmagenta', 'magenta', 'fuchsia', 'teal', 'ash', 'darkgray', 'darkishgray'] }
]

const titleCase = (name) => name.replace(/^./, c => c.toUpperCase())
const isIosMessage = (m) => isIosId(m.key?.id) || (!m.isGroup && chatIsIos(m.chat))
const isColor = (name) => Object.prototype.hasOwnProperty.call(COLORS, String(name || '').toLowerCase())

// Teks cadangan (dipakai kalau tombol gagal dikirim / iPhone)
function qcMenuText(m, text) {
    const list = COLOR_SECTIONS.map(sec => `*${sec.title}*\n${sec.names.join(', ')}`).join('\n\n')
    return (
        `💬 *Quote Sticker*\n\nTeks kamu: _${text}_\n\n` +
        `Pilih warna dengan mengetik:\n*${m.prefix}qc <warna> ${text}*\n\n${list}`
    )
}

// Kirim tombol pilih warna; id tombol = ".qc <warna> <teks>"
async function sendColorMenu(m, sock, text) {
    const p = m.prefix
    const logo = getAssetBuffer('logo')
    const footer = global.namebot || 'Quote Maker'
    const pick = (name) => ({ type: 'reply', text: titleCase(name), id: `${p}qc ${name} ${text}` })

    try {
        if (isIosMessage(m)) {
            // iPhone hanya merender tombol reply/url/copy/call: tampilkan 3 warna populer + daftar teks
            return await sock.sendButtons(m.chat, {
                ...(logo ? { image: logo } : {}),
                text: qcMenuText(m, text),
                footer,
                mentions: [m.sender],
                buttons: ['pink', 'blue', 'black'].map(pick)
            }, { quoted: m })
        }

        return await sock.sendButtons(m.chat, {
            ...(logo ? { image: logo } : {}),
            text: `💬 *Mau warna apa untuk quote-nya?*\n\nTeks kamu: _${text}_\n\nPilih warna lewat tombol di bawah 👇`,
            footer,
            mentions: [m.sender],
            buttons: [{
                type: 'list',
                text: 'Pilih Warna',
                sections: COLOR_SECTIONS.map(sec => ({
                    title: sec.title,
                    rows: sec.names.map(name => ({
                        title: titleCase(name),
                        description: COLORS[name],
                        id: `${p}qc ${name} ${text}`
                    }))
                }))
            }]
        }, { quoted: m })
    } catch (err) {
        console.error('[qc] tombol gagal, kirim teks biasa:', err.stack || err)
        return m.reply(qcMenuText(m, text))
    }
}

async function handler(m, { sock }) {
    const args = m.args || []
    const quotedText = m.quoted ? (m.quoted.text || m.quoted.body || '') : ''

    // .qc <warna> <teks> (atau reply pesan + .qc <warna>): langsung buat, ini juga yang dikirim tombol warna
    const hasColor = args.length > 0 && isColor(args[0])
    const color = hasColor ? args[0].toLowerCase() : ''
    const message = (hasColor ? args.slice(1).join(' ') : args.join(' ')).trim() || quotedText.trim()

    if (!message) {
        return m.reply(
            `💬 *ǫᴜᴏᴛᴇ sᴛɪᴄᴋᴇʀ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}qc <teks>\` lalu pilih warna lewat tombol\n` +
            `┃ ◦ Reply pesan + \`${m.prefix}qc\`\n` +
            `┃ ◦ Langsung: \`${m.prefix}qc <warna> <teks>\`\n` +
            `╰┈┈⬡\n\n` +
            `> Contoh: \`${m.prefix}qc Hai semuanya!\``
        )
    }

    if (message.length > 80) {
        return m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Maksimal 80 karakter! (Saat ini: ${message.length})`)
    }

    // belum pilih warna -> tampilkan tombol pilih warna
    if (!hasColor) return sendColorMenu(m, sock, message)

    const backgroundColor = COLORS[color]
    m.react('🕕')

    try {
        const username = m.pushName || 'User'
        const avatar = await getProfilePicture(sock, m.sender)

        const json = {
        "messages": [
            {
            "from": {
                "id": Math.floor(Math.random() * 10),
                "first_name": username,
                "last_name": "",
                "name": "",
                "photo": {
                "url": avatar
                }
            },
            "text": message,
            "entities": [],
            "avatar": true,
            "media": {
                "url": ""
            },
            "mediaType": "",
            "replyMessage": {
                "name": "",
                "text": "",
                "entities": [],
                "chatId": Math.floor(Math.random() * 10)
            }
            }
        ],
        "backgroundColor": backgroundColor,
        "width": 512,
        "height": 512,
        "scale": 2,
        "type": "quote",
        "format": "png",
        "emojiStyle": "apple"
        }

        const response = await axios.post('https://brat.siputzx.my.id/quoted', json, {
            timeout: 60000,
            responseType: 'arraybuffer'
        })

        const buffer = Buffer.from(response.data, 'base64')

        await sock.sendImageAsSticker(m.chat, buffer, m, {
            packname: config.sticker?.packname || 'Bot',
            author: config.sticker?.author || 'Bot'
        })

        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

_qc.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_qc.limit = true
export default oneCommand(_qc, 'qc')
