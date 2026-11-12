import { adapt } from '../../lib/engine/plugins.js'
import { fiturCfg, giveReward } from '../../lib/engine/features.js'
import { boostReward, happy } from '../../lib/engine/features.js'

// Semua angka hadiah & streak diatur di config.js -> global.fitur.reward
const rewardConfig = new Proxy({}, {
    get: (_, type) => {
        const c = fiturCfg().reward[type]
        if (!c) return undefined
        return { cooldown: c.cooldownJam * 3600000, lastKey: { harian: 'lastclaim', mingguan: 'lastweekly', bulanan: 'lastmonthly' }[type], free: c.free, prem: c.prem }
    }
});

const streakConfig = new Proxy({}, {
    get: (_, type) => {
        const r = fiturCfg().reward
        const st = r.streak
        if (!st.on || !st.tingkat[type]) return undefined
        const ms = st.milestone[type] || { setiap: 0, hadiah: {} }
        return {
            key: type === 'harian' ? 'streakDaily' : 'streakWeekly',
            unit: type === 'harian' ? 'hari' : 'minggu',
            grace: st.toleransiJam[type] * 3600000,
            tiers: st.tingkat[type].map(([n, p]) => [n, p / 100]),
            milestone: ms.setiap, milestoneReward: ms.hadiah || {}
        }
    }
});

let handler = async (m, { command, isPrems }) => {
    const type = /harian|claim|daily/i.test(command) ? 'harian' : /mingguan|weekly/i.test(command) ? 'mingguan' : /monthly|bulanan/i.test(command) ? 'bulanan' : null;

    if (!type) return;

    const user = global.db.data.users[m.sender];
    const cfg = rewardConfig[type];

    const now = Date.now();
    const last = Number(user[cfg.lastKey]) || 0; // lastmonthly tidak ada di data awal; tanpa ini klaim bulanan bisa diulang terus
    const remaining = last + cfg.cooldown - now;

    if (remaining > 0) {
        const sc = streakConfig[type];
        const streakNow = sc ? Number(user[sc.key]) || 0 : 0;
        return m.reply(`⏳ Kamu sudah klaim *${type}*.\n` + `Tunggu *${formatTime(remaining)}* lagi.` + (streakNow ? `\n🔥 Streak: ${streakNow} ${sc.unit}` : ''));
    }

    const reward = { ...(isPrems ? cfg.prem : cfg.free) };
    const sc = streakConfig[type];
    let streakText = '';

    if (sc) {
        const broken = last > 0 && now - last > sc.grace;
        const prev = Number(user[sc.key]) || 0;
        const streak = !last || broken ? 1 : prev + 1;
        const bonus = (sc.tiers.find(([n]) => streak >= n) || [0, 0])[1];

        if (bonus) for (const k of ['exp', 'money', 'limit']) reward[k] = Math.round(reward[k] * (1 + bonus));
        const milestone = sc.milestone > 0 && streak % sc.milestone === 0;
        let milestoneParts = [];
        if (milestone) milestoneParts = giveReward(user, sc.milestoneReward);

        user[sc.key] = streak;
        const siklus = type === 'harian' ? `\n🍰 Hari ke-${((streak - 1) % 7) + 1}/7 ${'🍓'.repeat(((streak - 1) % 7) + 1)}${'🤍'.repeat(7 - (((streak - 1) % 7) + 1))}${((streak - 1) % 7) + 1 === 7 ? ' ✨ HADIAH BESAR!' : ''}` : '';
        streakText =
            `\n\n🔥 Streak: *${streak} ${sc.unit}*` +
            (bonus ? ` (bonus +${Math.round(bonus * 100)}%)` : '') +
            siklus + (milestone && milestoneParts.length ? `\n🎉 Bonus milestone: ${milestoneParts.join(', ')}` : '') +
            (broken && prev > 1 ? `\n💔 Streak sebelumnya (${prev} ${sc.unit}) putus, mulai lagi dari 1.` : '');
        const nextTier = [...sc.tiers].reverse().find(([n]) => n > streak);
        if (nextTier) streakText += `\n➡️ ${nextTier[0] - streak} ${sc.unit} lagi untuk bonus +${Math.round(nextTier[1] * 100)}%`;
        streakText += `\n⚠️ Klaim lagi sebelum ${new Date(now + sc.grace).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} supaya streak tidak putus.`;
    }

    // jam bahagia: semua hadiah dikali pengali (lihat config.js -> global.extra.jamBahagia)
    const hp = happy();
    const boosted = boostReward(reward);
    for (const k of ['exp', 'money', 'limit']) reward[k] = boosted[k];
    if (hp.aktif) streakText += `\n\n *Jam Bahagia x${hp.mult}* aktif, hadiah dikali ${hp.mult}!`;

    user.exp += reward.exp;
    user.money += reward.money;
    user.limit += reward.limit;

    user[cfg.lastKey] = now;

    m.reply(`🎁 *Hadiah ${type.charAt(0).toUpperCase() + type.slice(1)}*\n` + `\n+ ${reward.exp} Exp` + `\n+ ${reward.money} Money` + `\n+ ${reward.limit} Limit` + streakText);
};

handler.help = ['rpg-reward daily', 'rpg-reward weekly', 'rpg-reward monthly']
handler.tags = ['rpg']
handler.command = ['rpg-reward', 'harian', 'daily', 'claim', 'mingguan', 'weekly', 'monthly', 'bulanan']
handler.as = 'harian'

export default adapt(handler, { category: 'rpg' })

function formatTime(ms) {
    let h = Math.floor(ms / 3600000);
    let m = Math.floor((ms % 3600000) / 60000);
    let s = Math.floor((ms % 60000) / 1000);

    return `${h} Jam ${m} Menit ${s} Detik`;
}
