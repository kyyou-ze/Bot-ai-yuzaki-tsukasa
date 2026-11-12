import axios from 'axios'
import { ffm } from '../../lib/core/file.js'

const SITE = 'https://cek-seberapa-femboy.vercel.app/img'

function hitung(nama) {
    const percent = Math.floor(Math.random() * 101)
    const tier = percent < 20 ? ['Cowok banget! 😎', 'normal']
        : percent < 40 ? ['Ada aura lembutnya dikit~ 🌸', 'dibwh40']
        : percent < 60 ? ['Lumayan femboy 😘', 'dibwh60']
        : percent < 80 ? ['Femboy sejati 💅✨', 'dibwh80']
        : ['FEMBOY DEWA 🔥💖', 'femboyyyy']
    return { hasil: `${nama}, kamu ${percent}% femboy!, ${tier[0]}`, gif: `${SITE}/${tier[1]}.gif` }
}

let handler = async (m, { sock, text, reply }) => {
    const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
    const self = target === m.sender
    const nama = self ? (String(text || '').trim() || m.pushName || 'Kamu') : `@${target.split('@')[0]}`
    const res = hitung(nama)
    const txt = self
        ? `Hai @${target.split('@')[0]}\n\n${res.hasil}`
        : `Kamu ingin ngecek tingkat kefemboyan @${target.split('@')[0]} yak?\n\n${res.hasil}`

    let video = null
    try {
        const gif = Buffer.from((await axios.get(res.gif, { responseType: 'arraybuffer', timeout: 20000 })).data)
        video = await ffm.run(gif, 'mp4', (i, o) => ['-ignore_loop', '0', '-i', i, '-t', '30', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', 'faststart', '-preset', 'ultrafast', '-an', o])
    } catch {}

    if (video) return sock.sendMessage(m.chat, { video, caption: txt, mimetype: 'video/mp4', gifPlayback: true, mentions: [target] }, { quoted: m })
    return sock.sendMessage(m.chat, { text: txt, mentions: [target] }, { quoted: m })
}

handler.command = ['cekfemboy', 'femboy']
handler.help = ['cekfemboy [nama/@user]']
handler.tags = ['cek']

export default handler
