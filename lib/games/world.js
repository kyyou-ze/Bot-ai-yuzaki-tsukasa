// ───────── lib/games/world.js ─────────
// Mesin "dunia role-play permanen" (konsep sama seperti koboy): daftar → pilih peran → kerja/misi →
// naik level → beli perlengkapan → upgrade skill → pindah lokasi → serang pemain lain → ranking.
// Tiap tema (bajaklaut, ninja, mafiakota, kampus, tycoon, esport, zombie) hanya berupa konfigurasi
// di lib/games/themes/*.js. Mata uang = koin RPG yang sama dengan seluruh bot.
//
// Format konfigurasi tema (lihat themes/*.js):
//   key, title, icon, intro, currency, repLabel, heat (true = ada stat "heat"/buronan),
//   roles:     [{ id, name, icon, desc, bonus: { <cmd>: pengali }, safe }]
//   locations: [{ id, name, minLevel, mult, cost, desc }]
//   actions:   [{ cmd, label, icon, energy, cd (detik), min, max (koin), xp: [a, b], risk, loss: [a, b],
//                 heat, rep, cost, minLevel, tiers: [{ id, label, minLevel, mult, risk }], ok: [...], fail: [...] }]
//   skills:    [{ id, name, desc, effect: 'power' | 'safe' | 'energy' | 'xp', per, max, price }]
//   shop:      [{ id, name, desc, price, pow, safe, energy }]    // pow/safe = permanen, energy = langsung dipakai
//   ranks:     [[levelMin, 'judul'], ...]
//   pvp:       { cmd, label, icon }

import { store, tag, send, now, coinOf, addCoin, fmt, rnd, chance, clamp, pickRandom, targetOf, num, timeLeft } from './common.js'

const ENERGY_MAX = 100
const REGEN_MS = 60 * 1000
const DAY = 24 * 3600 * 1000
const ROLE_CHANGE_FEE = 500
const SHIELD_MS = 30 * 60 * 1000
const xpNeed = (lv) => 60 + lv * 45

const data = (T) => { const s = store(T.key); s.users ||= {}; return s }
const bar = (v, max, n = 10) => '█'.repeat(Math.round(clamp(v / max, 0, 1) * n)) + '░'.repeat(n - Math.round(clamp(v / max, 0, 1) * n))

export function refresh(u) {
    const t = now()
    if (u.eAt == null) u.eAt = t
    const gain = Math.floor((t - u.eAt) / REGEN_MS)
    if (gain > 0) { u.energy = Math.min(ENERGY_MAX, u.energy + gain); u.eAt += gain * REGEN_MS }
    if (u.energy >= ENERGY_MAX) u.eAt = t
}

const skillLv = (u, id) => u.skills?.[id] || 0
const effect = (T, u, kind) => T.skills.filter(s => s.effect === kind).reduce((a, s) => a + skillLv(u, s.id) * s.per, 0)
const gear = (T, u, kind) => T.shop.filter(i => u.items?.[i.id] && i[kind]).reduce((a, i) => a + i[kind], 0)
export const rankOf = (T, lv) => [...T.ranks].reverse().find(([m]) => lv >= m)?.[1] || T.ranks[0][1]
const loc = (T, u) => T.locations.find(l => l.id === u.loc) || T.locations[0]
const role = (T, u) => T.roles.find(r => r.id === u.role)

export function addXp(T, u, amount) {
    u.xp += Math.max(0, Math.floor(amount * (1 + effect(T, u, 'xp'))))
    let ups = 0
    while (u.xp >= xpNeed(u.lvl)) { u.xp -= xpNeed(u.lvl); u.lvl++; ups++ }
    return ups
}

export function newUser(T, roleId) {
    return { role: roleId, lvl: 1, xp: 0, energy: ENERGY_MAX, eAt: now(), loc: T.locations[0].id, skills: {}, items: {}, rep: 0, heat: 0, cd: {}, daily: 0, shield: 0, acts: 0, wins: 0, joined: now() }
}

// hasil satu aksi (dipisah supaya bisa diuji)
export function resolveAction(T, u, act, tier, rand = Math.random) {
    const L = loc(T, u)
    const rl = role(T, u)
    const power = 1 + effect(T, u, 'power') + gear(T, u, 'pow') + u.lvl * 0.03
    const rb = rl?.bonus?.[act.cmd] || 1
    const safe = effect(T, u, 'safe') + gear(T, u, 'safe') + (rl?.safe || 0)
    let risk = (act.risk || 0) + (tier?.risk || 0) - safe + (T.heat ? u.heat * 0.002 : 0) + (L.risk || 0)
    risk = clamp(risk, 0.03, 0.85)
    const mult = (tier?.mult || 1) * L.mult
    const base = act.min + Math.floor(rand() * (act.max - act.min + 1))
    const reward = Math.max(1, Math.floor(base * mult * power * rb))
    const xp = act.xp[0] + Math.floor(rand() * (act.xp[1] - act.xp[0] + 1))
    const ok = rand() >= risk
    return { ok, risk, reward, xp: Math.floor(xp * (tier?.mult || 1)), loss: act.loss ? act.loss[0] + Math.floor(rand() * (act.loss[1] - act.loss[0] + 1)) : 0 }
}

export async function worldRun(T, A, sub) {
    const { sender, reply, pushname } = A
    const P = A.prefix || '.'
    const K = T.key
    const s = data(T)
    const say = (t, men = []) => send(A, t, men)
    const u = s.users[sender]
    const cmdName = (c) => `${P}${K}-${c}`

    const helpText = () => {
        const acts = T.actions.map(a => `• ${cmdName(a.cmd)}${a.tiers ? ` <${a.tiers.map(t => t.id).join('/')}>` : ''} — ${a.label}`).join('\n')
        return `${T.icon} *${T.title}*\n${T.intro}\n\n*Dasar*\n• ${cmdName('daftar')} <peran> — mulai\n• ${cmdName('peran')} — daftar & ganti peran (${fmt(ROLE_CHANGE_FEE)} koin)\n• ${cmdName('status')} — kartu pemain\n• ${cmdName('daily')} — bonus harian\n\n*Aktivitas*\n${acts}\n\n*Perkembangan*\n• ${cmdName('skill')} [id] — lihat/upgrade skill\n• ${cmdName('beli')} [id] — toko perlengkapan\n• ${cmdName('pindah')} [lokasi] — pindah ${T.locLabel || 'lokasi'}\n• ${cmdName(T.pvp.cmd)} @user — ${T.pvp.label}\n• ${cmdName('top')} — ranking\n\n⚡ Tiap aksi memakai energi (regen 1/menit, maks ${ENERGY_MAX}). Koin yang didapat sama dengan koin RPG bot.`
    }

    if (sub === 'help' || sub === 'menu') return reply(helpText())

    if (sub === 'peran' && !A.args.length || sub === 'roles') {
        return reply(`${T.icon} *Peran ${T.title}*\n\n${T.roles.map(r => `${r.icon} *${r.id}* — ${r.name}\n   ${r.desc}`).join('\n\n')}\n\nDaftar: *${cmdName('daftar')} <peran>*${u ? `\nGanti peran: *${cmdName('peran')} <peran>* (${fmt(ROLE_CHANGE_FEE)} koin)` : ''}`)
    }

    if (sub === 'daftar') {
        if (u) return reply(`Kamu sudah terdaftar sebagai ${role(T, u).icon} ${role(T, u).name}. Lihat: *${cmdName('status')}*`)
        const rid = (A.args[0] || '').toLowerCase()
        const r = T.roles.find(x => x.id === rid)
        if (!r) return reply(`Pilih peran:\n${T.roles.map(x => `• ${x.icon} ${x.id} — ${x.name}`).join('\n')}\n\nContoh: *${cmdName('daftar')} ${T.roles[0].id}*`)
        s.users[sender] = newUser(T, r.id)
        s.users[sender].name = pushname
        addCoin(sender, T.startBonus || 100)
        return say(`${T.icon} Selamat datang di *${T.title}*, ${tag(sender)}!\nPeran: ${r.icon} *${r.name}*\n${r.desc}\n\n🎁 Bonus pemula +${fmt(T.startBonus || 100)} koin\nMulai dengan *${cmdName(T.actions[0].cmd)}* atau lihat *${cmdName('help')}*.`, [sender])
    }

    if (sub === 'top') {
        const top = Object.entries(s.users).sort((a, b) => (b[1].lvl - a[1].lvl) || (b[1].xp - a[1].xp) || (b[1].rep - a[1].rep)).slice(0, 10)
        if (!top.length) return reply('Belum ada pemain.')
        const medal = ['🥇', '🥈', '🥉']
        return say(`🏆 *Top ${T.title}*\n\n${top.map(([j, v], i) => `${medal[i] || (i + 1) + '.'} ${tag(j)} — Lv ${v.lvl} ${rankOf(T, v.lvl)} • ${T.repLabel} ${v.rep}`).join('\n')}`, top.map(([j]) => j))
    }

    if (!u) return reply(`Kamu belum terdaftar. Ketik *${cmdName('daftar')} <peran>* — lihat peran dengan *${cmdName('peran')}*.`)
    refresh(u)
    const rl = role(T, u)

    switch (sub) {
        case 'status': {
            const L = loc(T, u)
            const sk = T.skills.filter(x => skillLv(u, x.id)).map(x => `${x.name} Lv${skillLv(u, x.id)}`).join(', ') || '-'
            const it = T.shop.filter(x => u.items[x.id] && !x.energy).map(x => x.name).join(', ') || '-'
            const extra = T.statusExtra ? '\n' + T.statusExtra(u) : ''
            const cds = T.actions.filter(a => (u.cd[a.cmd] || 0) > now()).map(a => `${a.icon} ${a.cmd}: ${timeLeft(u.cd[a.cmd] - now())}`)
            return say(`${T.icon} *${T.title}* — ${tag(sender)}\n\n${rl.icon} ${rl.name} • ${rankOf(T, u.lvl)}\n⭐ Level ${u.lvl}  [${bar(u.xp, xpNeed(u.lvl))}] ${u.xp}/${xpNeed(u.lvl)}\n⚡ Energi ${u.energy}/${ENERGY_MAX} [${bar(u.energy, ENERGY_MAX)}]\n💰 Koin ${fmt(coinOf(sender))}\n📍 ${L.name}\n🏅 ${T.repLabel}: ${u.rep}${T.heat ? `\n🔥 ${T.heatLabel || 'Heat'}: ${u.heat}` : ''}${extra}\n🧠 Skill: ${sk}\n🎒 Perlengkapan: ${it}\n📊 Aksi: ${u.acts} • Menang PvP: ${u.wins}${cds.length ? `\n\n⏳ Cooldown:\n${cds.join('\n')}` : ''}`, [sender])
        }

        case 'daily': {
            const left = DAY - (now() - u.daily)
            if (left > 0) return reply(`🕒 Bonus harian sudah diambil. Tunggu *${timeLeft(left)}*.`)
            const coin = 150 + u.lvl * 25
            u.daily = now(); u.energy = ENERGY_MAX
            addCoin(sender, coin)
            const ups = addXp(T, u, 40 + u.lvl * 5)
            return reply(`🎁 *Bonus harian ${T.title}*\n+💰 ${fmt(coin)} koin\n+⭐ XP\n⚡ Energi terisi penuh${ups ? `\n🎉 Naik ke level ${u.lvl}!` : ''}`)
        }

        case 'peran': {
            const rid = (A.args[0] || '').toLowerCase()
            const r = T.roles.find(x => x.id === rid)
            if (!r) return reply(`Peran tidak ada. Lihat daftar: *${cmdName('peran')}*`)
            if (r.id === u.role) return reply('Itu sudah perananmu.')
            if (coinOf(sender) < ROLE_CHANGE_FEE) return reply(`Biaya ganti peran ${fmt(ROLE_CHANGE_FEE)} koin, koinmu kurang.`)
            addCoin(sender, -ROLE_CHANGE_FEE); u.role = r.id
            return reply(`${r.icon} Peran diganti menjadi *${r.name}* (−${fmt(ROLE_CHANGE_FEE)} koin).`)
        }

        case 'skill': {
            const id = (A.args[0] || '').toLowerCase()
            if (!id) {
                return reply(`🧠 *Skill ${T.title}*\n\n${T.skills.map(x => `• *${x.id}* — ${x.name} (Lv ${skillLv(u, x.id)}/${x.max})\n   ${x.desc} • upgrade ${fmt(x.price * (skillLv(u, x.id) + 1))} koin`).join('\n')}\n\nUpgrade: *${cmdName('skill')} <id>*`)
            }
            const sk = T.skills.find(x => x.id === id)
            if (!sk) return reply('Skill tidak ditemukan.')
            const lv = skillLv(u, sk.id)
            if (lv >= sk.max) return reply(`${sk.name} sudah maksimum.`)
            const cost = sk.price * (lv + 1)
            if (coinOf(sender) < cost) return reply(`Koin kurang. Butuh ${fmt(cost)}.`)
            addCoin(sender, -cost); u.skills[sk.id] = lv + 1
            return reply(`🧠 *${sk.name}* naik ke Lv ${lv + 1}! (−${fmt(cost)} koin)`)
        }

        case 'beli': {
            const id = (A.args[0] || '').toLowerCase()
            if (!id) return reply(`🛒 *Toko ${T.title}*\n\n${T.shop.map(x => `• *${x.id}* — ${x.name} (${fmt(x.price)} koin)${u.items[x.id] && !x.energy ? ' ✅' : ''}\n   ${x.desc}`).join('\n')}\n\nBeli: *${cmdName('beli')} <id>*`)
            const it = T.shop.find(x => x.id === id)
            if (!it) return reply('Barang tidak ditemukan.')
            if (!it.energy && u.items[it.id]) return reply('Kamu sudah memilikinya.')
            if (coinOf(sender) < it.price) return reply(`Koin kurang. Butuh ${fmt(it.price)}.`)
            addCoin(sender, -it.price)
            if (it.energy) { u.energy = Math.min(ENERGY_MAX, u.energy + it.energy); return reply(`⚡ ${it.name} dipakai! Energi +${it.energy} → ${u.energy}/${ENERGY_MAX}`) }
            u.items[it.id] = 1
            return reply(`✅ Membeli *${it.name}* (−${fmt(it.price)} koin). ${it.desc}`)
        }

        case 'pindah': {
            const q = (A.args[0] || '').toLowerCase()
            if (!q) return reply(`📍 *${T.locLabel || 'Lokasi'}* (sekarang: ${loc(T, u).name})\n\n${T.locations.map(l => `• *${l.id}* — ${l.name} (Lv ${l.minLevel}+, hadiah x${l.mult}${l.risk ? `, risiko +${Math.round(l.risk * 100)}%` : ''}${l.cost ? `, ongkos ${fmt(l.cost)}` : ''})\n   ${l.desc}`).join('\n')}\n\nPindah: *${cmdName('pindah')} <id>*`)
            const L = T.locations.find(l => l.id === q)
            if (!L) return reply('Lokasi tidak ditemukan.')
            if (L.id === u.loc) return reply('Kamu sudah di sana.')
            if (u.lvl < L.minLevel) return reply(`Butuh level ${L.minLevel}.`)
            if (coinOf(sender) < (L.cost || 0)) return reply(`Ongkos ${fmt(L.cost)} koin, koinmu kurang.`)
            if (u.energy < 5) return reply('Energi kurang (butuh 5).')
            addCoin(sender, -(L.cost || 0)); u.energy -= 5; u.loc = L.id
            return reply(`📍 Kamu pindah ke *${L.name}*.\n${L.desc}`)
        }
    }

    // ───────── PvP ─────────
    if (sub === T.pvp.cmd) {
        const foe = targetOf(A)
        if (!foe) return reply(`Tandai lawan: *${cmdName(T.pvp.cmd)} @user*`)
        if (foe === sender) return reply('Tidak bisa menyerang diri sendiri.')
        const v = s.users[foe]
        if (!v) return reply('Lawan belum terdaftar di game ini.')
        if (u.lvl < 3 || v.lvl < 3) return reply('PvP baru terbuka untuk pemain level 3+ (kamu dan lawan).')
        const cdKey = '_pvp'
        if ((u.cd[cdKey] || 0) > now()) return reply(`⏳ PvP cooldown ${timeLeft(u.cd[cdKey] - now())}.`)
        if (u.energy < 15) return reply('Energi kurang (butuh 15).')
        if ((v.shield || 0) > now()) return reply(`🛡️ Lawan sedang dilindungi (${timeLeft(v.shield - now())}).`)
        const loot = coinOf(foe)
        if (loot < 100) return reply('Lawan terlalu miskin untuk diserang (koin < 100).')
        u.energy -= 15; u.cd[cdKey] = now() + 10 * 60 * 1000
        const pow = (x) => x.lvl * 10 + (gear(T, x, 'pow') + effect(T, x, 'power')) * 60 + (gear(T, x, 'safe') + effect(T, x, 'safe')) * 40
        const a = pow(u) * (0.6 + Math.random() * 0.8), b = pow(v) * (0.6 + Math.random() * 0.8)
        if (a > b) {
            const take = Math.min(Math.floor(loot * 0.1), 300 + u.lvl * 40)
            addCoin(foe, -take); addCoin(sender, take)
            u.wins++; u.rep += 2; v.shield = now() + SHIELD_MS
            addXp(T, u, 30 + v.lvl * 3)
            return say(`${T.pvp.icon} ${tag(sender)} *menang* ${T.pvp.label} melawan ${tag(foe)}!\n💰 +${fmt(take)} koin direbut • ${T.repLabel} +2\n🛡️ ${tag(foe)} dilindungi 30 menit.`, [sender, foe])
        }
        const pay = Math.min(Math.floor(coinOf(sender) * 0.05), 300)
        addCoin(sender, -pay); addCoin(foe, pay)
        addXp(T, u, 8)
        return say(`${T.pvp.icon} ${tag(sender)} *kalah* melawan ${tag(foe)}!\n💸 Kehilangan ${fmt(pay)} koin.`, [sender, foe])
    }

    // ───────── aksi ─────────
    const act = T.actions.find(x => x.cmd === sub)
    if (!act) return reply(`Perintah tidak dikenal. Ketik *${cmdName('help')}*.`)
    if (u.lvl < (act.minLevel || 1)) return reply(`${act.icon} ${act.label} butuh level ${act.minLevel}.`)
    let tier = null
    if (act.tiers) {
        const q = (A.args[0] || '').toLowerCase()
        tier = act.tiers.find(t => t.id.toLowerCase() === q) || act.tiers[0]
        if (q && tier.id.toLowerCase() !== q) return reply(`Tingkat tidak ada. Pilihan: ${act.tiers.map(t => `${t.id} (Lv ${t.minLevel}+)`).join(', ')}`)
        if (u.lvl < tier.minLevel) return reply(`Tingkat *${tier.id}* butuh level ${tier.minLevel}. Pilihan untukmu: ${act.tiers.filter(t => u.lvl >= t.minLevel).map(t => t.id).join(', ')}`)
    }
    const left = (u.cd[act.cmd] || 0) - now()
    if (left > 0) return reply(`⏳ ${act.label} masih cooldown *${timeLeft(left)}*.`)
    const energy = Math.max(1, Math.round(act.energy * (1 - effect(T, u, 'energy')) * (tier?.energyMult || 1)))
    if (u.energy < energy) return reply(`⚡ Energi kurang (${u.energy}/${energy}). Tunggu regen 1/menit, atau beli tonik di *${cmdName('beli')}*.`)
    const cost = act.cost ? Math.floor(act.cost * (tier?.mult || 1)) : 0
    if (cost && coinOf(sender) < cost) return reply(`Butuh ${fmt(cost)} koin untuk ${act.label}.`)

    u.energy -= energy
    if (cost) addCoin(sender, -cost)
    const r = resolveAction(T, u, act, tier)
    u.acts++
    const tl = tier ? ` [${tier.label || tier.id}]` : ''
    let text
    if (r.ok) {
        addCoin(sender, r.reward)
        const ups = addXp(T, u, r.xp)
        u.rep += act.rep || 0
        if (act.heat) u.heat = clamp(u.heat + act.heat, 0, 100)
        u.cd[act.cmd] = now() + act.cd * 1000
        text = `${act.icon} *${act.label}*${tl}\n${pickRandom(act.ok)}\n\n💰 +${fmt(r.reward)} koin${cost ? ` (biaya ${fmt(cost)})` : ''} • ⭐ +${r.xp} XP${act.rep ? ` • ${T.repLabel} +${act.rep}` : ''}${act.heat > 0 ? ` • 🔥 +${act.heat}` : ''}${act.heat < 0 ? ` • 🔥 ${act.heat}` : ''}${ups ? `\n🎉 *Naik ke level ${u.lvl}!* (${rankOf(T, u.lvl)})` : ''}`
    } else {
        const loss = Math.min(r.loss, coinOf(sender))
        if (loss) addCoin(sender, -loss)
        addXp(T, u, Math.floor(r.xp * 0.3))
        if (act.heat) u.heat = clamp(u.heat + Math.ceil(act.heat / 2), 0, 100)
        u.cd[act.cmd] = now() + Math.floor(act.cd * 1.5) * 1000
        text = `${act.icon} *${act.label}*${tl} — GAGAL!\n${pickRandom(act.fail)}\n\n${loss ? `💸 −${fmt(loss)} koin • ` : ''}⭐ +${Math.floor(r.xp * 0.3)} XP\n⏳ cooldown lebih lama`
    }
    return say(`${text}\n⚡ Energi ${u.energy}/${ENERGY_MAX}${act.tiers ? '' : ''}`, [sender])
}
