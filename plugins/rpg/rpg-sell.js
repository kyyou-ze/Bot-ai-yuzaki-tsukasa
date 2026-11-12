import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { args }) => {
    let user = global.db.data.users[m.sender]
    let e = global.rpg.emoticon

    let item = (args[0] || '').toLowerCase()
    let jumlah = parseInt(args[1]) || 1

    let harga = {
        trash: 50,

        ikan: 1500,
        lele: 2000,
        nila: 2000,
        bawal: 2500,
        udang: 3000,
        kepiting: 3500,
        paus: 10000,

        ayam: 5000,
        kambing: 8000,
        sapi: 12000,
        babi: 10000,
        banteng: 15000,

        diamond: 9000,
        emerald: 7000
    }

    if (!item) {
        throw `
*${(global.namebot || 'BOT').toUpperCase()} RPG SELL* ❀

📦 Item yang bisa dijual

🗑 Trash
🐟 Ikan / Lele / Nila / Bawal
🦐 Udang
🦀 Kepiting
🐋 Paus

🐓 Ayam
🐐 Kambing
🐄 Sapi
🐖 Babi
🐃 Banteng

💎 Diamond
❇️ Emerald

Contoh:
.sell ikan 5
.sell ayam 2
.sell diamond
`
    }

    if (!(item in harga)) throw `Item tidak bisa dijual`

    if (user[item] < jumlah) throw `Item tidak cukup`

    let total = harga[item] * jumlah

    user[item] -= jumlah
    user.money += total

    m.reply(`
❀ *BERHASIL MENJUAL* ❀

Item : ${item}
Jumlah : ${jumlah}

${e('money')} +${total}
`.trim())
}

handler.help = ['rpg-sell']
handler.tags = ['rpg']
handler.command = ['rpg-sell']
handler.group = true

export default adapt(handler, { category: 'rpg' })
