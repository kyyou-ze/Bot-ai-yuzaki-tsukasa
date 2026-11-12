/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Fitur: Ephoto360 — daftar efek text
 * Command: .ephoto
 * Letakkan di: plugins/ephoto/ephoto.js
 */

const EFFECTS = [
    'glitchtext',
    'writetext',
    'advancedglow',
    'typographytext',
    'pixelglitch',
    'neonglitch',
    'flagtext',
    'flag3dtext',
    'deletingtext',
    'blackpinkstyle',
    'glowingtext',
    'underwatertext',
    'logomaker',
    'cartoonstyle',
    'papercutstyle',
    'watercolortext',
    'effectclouds',
    'blackpinklogo',
    'gradienttext',
    'summerbeach',
    'luxurygold',
    'multicoloredneon',
    'sandsummer',
    'galaxywallpaper',
    '1917style',
    'makingneon',
    'royaltext',
    'freecreate',
    'galaxystyle',
    'amongustext',
    'rainytext',
    'lighteffects',
]

let handler = async (m, { reply, prefix }) => {
    const list = EFFECTS.map(e => `• \`${prefix}${e}\``).join('\n')

    return reply(
        `🎨 *ᴇᴘʜᴏᴛᴏ ᴇꜰꜰᴇᴄᴛs*\n\n` +
        `> Buat efek text keren!\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴀꜰᴛᴀʀ ᴇꜰᴇᴋ* 」\n${list}\n╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `> *Contoh:* ${prefix}glitchtext Ourin-AI`
    )
}

handler.help = ['ephoto']
handler.tags = ['ephoto']
handler.command = ['ephoto']

export default handler
