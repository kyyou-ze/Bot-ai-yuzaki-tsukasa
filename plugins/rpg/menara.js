// MENARA (Tower): naik lantai demi lantai, musuh makin kuat, boss tiap 10 lantai.
// .menara            status & lantai tertinggimu
// .naiklantai        lawan monster lantai berikutnya (jeda 30 dtk, butuh HP >= 30)
// .menaratop         peringkat lantai tertinggi MINGGU INI
// Hadiah mingguan (otomatis dibayar saat minggu berganti): #1 100.000 • #2 50.000 • #3 25.000
// Kalah = lantai tidak naik dan HP tersisa 10. Pulihkan dengan .heal.
import { gameStore, save, rupiah, rpgUser, combatStats, simulateFight, weekKey, addMoney, persist, rememberSock, num } from '../../lib/group/sosial.js'

const BOSSES = ['Raja Goblin', 'Golem Batu', 'Ratu Laba-laba', 'Ksatria Kegelapan', 'Naga Api', 'Lich Abadi', 'Titan Es', 'Iblis Jurang', 'Hydra Rawa', 'Penjaga Menara']
const MOBS = ['Slime', 'Goblin', 'Kelelawar Gua', 'Serigala', 'Skeleton', 'Orc', 'Hantu', 'Troll', 'Golem Kecil', 'Wraith']
const PRIZE = [100_000, 50_000, 25_000]
const COOLDOWN = 30_000
const cd = new Map()

function monsterAt(f) {
    const boss = f % 10 === 0
    const name = boss ? BOSSES[(f / 10 - 1) % BOSSES.length] : MOBS[(f - 1) % MOBS.length]
    const scale = boss ? 2.4 : 1
    return {
        name: boss ? `👑 ${name}` : name, boss,
        hp: Math.round((40 + f * 16 + Math.pow(f, 1.4)) * scale),
        atk: Math.round((7 + f * 1.8) * (boss ? 1.5 : 1)),
        def: Math.round(f * 0.6)
    }
}

// bayar hadiah minggu lalu (sekali saja)
async function settle(sock) {
    const t = gameStore().tower
    const now = weekKey()
    t.paid ||= {}
    for (const wk of Object.keys(t.weeks || {})) {
        if (wk >= now || t.paid[wk]) continue
        const top = Object.entries(t.weeks[wk]).sort((a, b) => b[1].floor - a[1].floor || a[1].at - b[1].at).slice(0, 3)
        for (let i = 0; i < top.length; i++) await addMoney(sock, top[i][1].jid, top[i][1].name, PRIZE[i]).catch(() => null)
        t.paid[wk] = top.map(([id, v], i) => `${id}:${v.floor}:${PRIZE[i]}`)
        save()
    }
}

let handler = async (m, { sock, command, prefix, jid, reply }) => {
    rememberSock(sock)
    command = { tower: 'menara', climb: 'naiklantai', towertop: 'menaratop' }[command] || command
    await settle(sock)
    const t = gameStore().tower
    t.users ||= {}; t.weeks ||= {}
    const { pn, user } = await rpgUser(sock, m)
    const id = num(pn)
    const me = (t.users[id] ||= { floor: 0, best: 0, wins: 0, deaths: 0 })

    if (command === 'menaratop') {
        const wk = weekKey()
        const top = Object.entries(t.weeks[wk] || {}).sort((a, b) => b[1].floor - a[1].floor || a[1].at - b[1].at).slice(0, 10)
        if (!top.length) return reply(`Belum ada yang memanjat minggu ini (${wk}). Mulai: ${prefix}naiklantai`)
        const medal = ['🥇', '🥈', '🥉']
        return reply(`🗼 *PERINGKAT MENARA* — ${wk}\n\n${top.map(([k, v], i) => `${medal[i] || `${i + 1}.`} ${v.name} — Lantai *${v.floor}*`).join('\n')}\n\n🎁 Hadiah akhir minggu: ${PRIZE.map(rupiah).join(' / ')}`)
    }

    const stats = combatStats(user)
    if (command === 'menara') {
        const nx = monsterAt(me.floor + 1)
        return reply(`╭─▣「 *MENARA* 」▣─╮\n┃ 👤 ${user.name}\n┃ 🏢 Lantai   : ${me.floor}\n┃ 🏆 Terbaik  : ${me.best}\n┃ ⚔️ Menang/Kalah: ${me.wins}/${me.deaths}\n┃ ❤️ HP       : ${user.health}/${user.maxhealth || 100}\n┃ 🗡️ ATK ${stats.atk} • 🛡️ DEF ${stats.def}\n╰─────────────➤\nLantai berikutnya: *${me.floor + 1}* — ${nx.name} (HP ${nx.hp}, ATK ${nx.atk})${nx.boss ? '\n⚠️ _Lantai BOSS!_' : ''}\n\nMaju: ${prefix}naiklantai  •  Peringkat: ${prefix}menaratop`)
    }

    // naiklantai
    if (user.health < 30) return reply(`❤️ HP kamu ${user.health}. Minimal 30 untuk naik.\nPulihkan dulu dengan ${prefix}heal`)
    const wait = COOLDOWN - (Date.now() - (cd.get(id) || 0))
    if (wait > 0) return reply(`⏳ Atur napas dulu ${Math.ceil(wait / 1000)} detik.`)
    cd.set(id, Date.now())

    const f = me.floor + 1
    const mon = monsterAt(f)
    const r = simulateFight(user.health, stats, mon)

    if (!r.win) {
        user.health = 10; me.deaths++; persist(); save()
        return reply(`💀 *KALAH* di lantai ${f} melawan ${mon.name}!\nHP tersisa 10. Perkuat diri (level/pedang/armor) lalu coba lagi.`)
    }

    user.health = Math.max(1, r.hpLeft)
    me.floor = f; me.best = Math.max(me.best, f); me.wins++
    const money = Math.round(200 + f * 120 + (mon.boss ? f * 400 : 0))
    const exp = Math.round(50 + f * 30)
    user.money = (Number(user.money) || 0) + money
    user.exp = (Number(user.exp) || 0) + exp
    let extra = ''
    if (mon.boss) {
        const dia = 1 + Math.floor(f / 20), pot = 2
        user.diamond = (Number(user.diamond) || 0) + dia
        user.potion = (Number(user.potion) || 0) + pot
        extra = `\n💎 Diamond +${dia}\n🧪 Potion +${pot}`
    }
    const wk = weekKey()
    const w = ((t.weeks[wk] ||= {})[id] ||= { floor: 0, name: user.name, jid: pn, at: Date.now() })
    if (f > w.floor) { w.floor = f; w.name = user.name; w.at = Date.now() }
    persist(); save()

    return reply(`${mon.boss ? '👑 *BOSS DIKALAHKAN!*' : '✅ *MENANG!*'}\n🏢 Lantai *${f}* — ${mon.name}\n⚔️ ${r.rounds} ronde • ❤️ HP sisa ${user.health}\n\n💰 +${rupiah(money)}\n✨ EXP +${exp}${extra}\n\n_Lanjut: ${prefix}naiklantai_`)
}

handler.command = ['menara', 'climb', 'menaratop', 'naiklantai', 'tower', 'towertop']
handler.help = ['menara', 'menara naiklantai', 'menara menaratop']
handler.tags = ['rpg']
handler.group = true

export default handler
