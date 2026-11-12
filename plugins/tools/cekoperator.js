// Operator seluler Indonesia berdasarkan 4 digit awal nomor (prefix). Data offline.

export const PREFIX = {
    Telkomsel: {
        '0811': 'Halo', '0812': 'simPATI', '0813': 'simPATI', '0821': 'simPATI', '0822': 'simPATI',
        '0823': 'Kartu AS', '0851': 'by.U', '0852': 'Kartu AS', '0853': 'Kartu AS'
    },
    'Indosat Ooredoo': {
        '0814': 'Matrix / Mentari', '0815': 'Mentari', '0816': 'Mentari',
        '0855': 'IM3', '0856': 'IM3', '0857': 'IM3', '0858': 'Mentari'
    },
    XL: {
        '0817': 'XL', '0818': 'XL', '0819': 'XL', '0859': 'XL', '0877': 'XL', '0878': 'XL'
    },
    Axis: {
        '0831': 'Axis', '0832': 'Axis', '0833': 'Axis', '0838': 'Axis'
    },
    Tri: {
        '0895': '3 (Tri)', '0896': '3 (Tri)', '0897': '3 (Tri)', '0898': '3 (Tri)', '0899': '3 (Tri)'
    },
    Smartfren: {
        '0881': 'Smartfren', '0882': 'Smartfren', '0883': 'Smartfren', '0884': 'Smartfren',
        '0885': 'Smartfren', '0886': 'Smartfren', '0887': 'Smartfren', '0888': 'Smartfren', '0889': 'Smartfren'
    }
}

// 08xx / 628xx / +628xx / 8xx -> 08xx...
function normalize(input) {
    let n = String(input).replace(/[^\d+]/g, '')
    if (n.startsWith('+')) n = n.slice(1)
    if (n.startsWith('62')) n = '0' + n.slice(2)
    else if (n.startsWith('8')) n = '0' + n
    return n
}

// nama operator dari nomor (dipakai juga oleh plugins/main/menu.js); '-' kalau tidak dikenali
export function operatorOf(input) {
    const number = normalize(input)
    if (!/^08\d{8,12}$/.test(number)) return '-'
    const prefix = number.slice(0, 4)
    for (const [name, list] of Object.entries(PREFIX)) if (list[prefix]) return name
    return '-'
}

let handler = async (m, { text, reply, example }) => {
    if (!String(text || '').trim()) return example('08123456789')

    const number = normalize(text)
    if (!/^08\d{8,12}$/.test(number)) {
        return reply('Nomor tidak valid. Masukkan nomor HP Indonesia, contoh: 08123456789 atau 628123456789')
    }

    const prefix = number.slice(0, 4)
    let operator = null
    let kartu = null
    for (const [name, list] of Object.entries(PREFIX)) {
        if (list[prefix]) { operator = name; kartu = list[prefix]; break }
    }

    if (!operator) {
        return reply(`Prefix *${prefix}* belum ada di data operator.\n\nBisa jadi nomor ini dari operator kecil atau prefix baru.`)
    }

    return reply(
        `📱 *CEK OPERATOR*\n\n` +
        `Nomor    : ${number}\n` +
        `Format   : +62${number.slice(1)}\n` +
        `Prefix   : ${prefix}\n` +
        `Operator : *${operator}*\n` +
        `Kartu    : ${kartu}\n\n` +
        `_Berdasarkan prefix awal. Nomor yang pindah operator (MNP) bisa berbeda dari hasil ini._`
    )
}

handler.command = ['cekoperator']
handler.help = ['cekoperator']
handler.tags = ['tools']

export default handler
