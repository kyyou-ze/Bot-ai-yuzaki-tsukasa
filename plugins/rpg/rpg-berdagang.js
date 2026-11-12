import { adapt, clockString } from '../../lib/engine/plugins.js'
let handler = async (m) => {
    const dapat = Math.floor(Math.random() * 5000);
    const who = m.mentionedJid[0];
    if (!who) throw 'Tag salah satu lah, yang kamu ingin berdagang bareng';

    if (!global.db.data.users[who]) return m.reply('Pengguna tidak ada didalam data base');

    const user = global.db.data.users[m.sender];
    const partner = global.db.data.users[who];

    const now = Date.now();
    const _timers = now - user.lastdagang;
    const timers = clockString(28800000 - _timers);

    if (now - user.lastdagang < 28800000) return m.reply(`Anda sudah berdagang, tunggu ${timers} lagi.`);

    if (partner.money < 5000) throw 'Target tidak memiliki modal, minimal 5000';
    if (user.money < 5000) throw 'Kamu tidak memiliki modal, minimal 5000';

    partner.money -= dapat;
    user.money -= dapat;
    partner.lastdagang = now;
    user.lastdagang = now;

    m.reply(
        `
Mohon tunggu kak..
Kamu dan @${who.split('@')[0]} sedang berdagang...
Kedua pihak meletakkan modal: -${dapat}
        `.trim()
    );

    setTimeout(() => {
        user.money += 15000;
        partner.money += 15000;

        m.reply(
            `
Selamat! Hasil dagang pertama telah keluar.

Kamu mendapat +15000 (Total: ${user.money})
@${who.split('@')[0]} mendapat +15000 (Total: ${partner.money})`
        );
    }, 3600000);

    setTimeout(() => {
        user.money += 15000;
        partner.money += 15000;

        m.reply(
            `
Selamat! Hasil dagang kedua telah keluar.

Kamu mendapat +15000 (Total: ${user.money})
@${who.split('@')[0]} mendapat +15000 (Total: ${partner.money})`
        );
    }, 7200000);
};

handler.help = ['rpg-berdagang']
handler.tags = ['rpg']
handler.command = ['rpg-berdagang']
handler.register = true;
handler.group = true;

export default adapt(handler, { category: 'rpg' })
