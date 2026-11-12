/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Creator      : YannRzy Tech
 * Recode       : (Your Name)
 *
 * Developer Channels:
 * • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
 *
 * Info Update Kaguya Channels:
 * • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
 *
 * Copyright © YannRzy Tech 2026
 * All Rights Reserved.
 */

// Penghubung game RPG (koboy, catur, uno, gaple, dll) ke engine bot dan data user.

import fs from 'fs'
import path from 'path'
import { saveDB, DB_DIR } from '../core/system.js'
import { getOwners } from '../core/system.js'
import { getMeta } from '../platform/wa.js'
import {
    rpgStore, makeDefaultUser, ensureUser, wrapMessage, toPN, wrapPlugin, promptRegister,
    xpRange, findLevel, notifyLevelUp, saluranCtx, config as engineConfig
} from '../engine/plugins.js'

export { xpRange, findLevel }

const SELF = Symbol('flat')
const cleanId = (jid) => String(jid || '').replace(/@.+/g, '').replace(/:\d+$/, '')
const isBadJid = (jid) => /@(g\.us|broadcast|newsletter)$/.test(String(jid || ''))
const keyFor = (id) => `${id}@s.whatsapp.net`

// ───────── config ala backup (dibangun di atas config Kaguya) ─────────
export const config = Object.create(engineConfig, {
    owner: { get: () => ({ number: getOwners().map(n => String(n).replace(/\D/g, '')), name: global.ownername || 'Owner' }) },
    energi: { value: { enabled: true, default: 20, premium: -1, owner: -1 } },
    command: { get: () => ({ prefix: (Array.isArray(global.prefix) ? global.prefix[0] : global.prefix) || '.' }) }
})
config.isOwner = (jid) => {
    const n = cleanId(jid)
    return !!n && getOwners().some(o => String(o).replace(/\D/g, '') === n)
}
config.isPremium = (jid) => {
    const n = cleanId(jid)
    if (!n) return false
    if (config.isOwner(n)) return true
    const u = rpgStore().users[keyFor(n)]
    return !!(u && (u.premium === true || Number(u.premiumTime) > Date.now()))
}
const MSG = {
    groupOnly: '⚠️ Fitur ini hanya bisa dipakai di grup.',
    privateOnly: '⚠️ Fitur ini hanya bisa dipakai di chat pribadi.',
    adminOnly: '⚠️ Fitur ini hanya untuk admin grup.',
    botAdminOnly: '⚠️ Jadikan bot admin grup dulu.',
    energiExceeded: '⚡ *Limit habis!* Limit kamu sudah habis, beli lewat *.buy limit* atau tunggu reset.',
    cooldown: '🕕 *Tunggu dulu!* Kamu masih dalam cooldown. Tunggu %time% detik lagi ya.'
}
Object.defineProperty(config, 'messages', {
    get: () => ({ ...engineConfig.messages, ...MSG }),
    configurable: true
})
export default config

// ───────── penyimpanan ─────────
let saveTimer = null
function saveSoon() {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
        saveTimer = null
        try { saveDB(global.db) } catch { }
    }, 3000)
    saveTimer.unref?.()
}

// data selain user (grup, setting, stat, guild, simulator, ...) ikut tersimpan di rpgData
function ext() {
    const s = rpgStore()
    const e = (s.bridge ||= {})
    e.groups ||= {}
    e.settings ||= {}
    e.stats ||= {}
    e.sewa ||= { enabled: false, groups: {} }
    e.legacy ||= { clans: {}, sider: {}, antipm: {}, autopost: {}, activeWars: {}, pendingWars: {}, warHistory: [] }
    e.guilds ||= {}
    e.simulator ||= {}
    e.bots ||= { stock: {} }
    e.game ||= {}
    return e
}

// ───────── tampilan user ─────────
const FLAT_ALIAS = { koin: 'money', energi: 'limit', isPremium: 'premium', isRegistered: 'registered', isBanned: 'banned', maxHealth: 'maxhealth' }
const RPG_ALIAS = { health: 'health', maxHealth: 'maxhealth', mana: 'mana', stamina: 'stamina' }
// field datar yang bukan item (tidak ikut dihitung sebagai inventory)
const NOT_ITEM = new Set(['exp', 'money', 'level', 'limit', 'age', 'regTime', 'afk', 'warn', 'premiumTime', 'health', 'maxhealth', 'stamina', 'mana', 'energy', 'gold', 'bank', 'atm', 'fullatm', 'horseexp'])
const isItemKey = (k, v) => typeof v === 'number' && !NOT_ITEM.has(k) && !/^(last|cd|cooldown)/i.test(k)

function rpgView(u) {
    const store = (u.rpgx ||= {})
    return new Proxy(store, {
        get(t, p) {
            if (typeof p === 'symbol') return Reflect.get(t, p)
            if (p === 'level') return u.level
            if (RPG_ALIAS[p]) return u[RPG_ALIAS[p]]
            return t[p]
        },
        set(t, p, v) {
            if (p === 'level') return true // level dikelola sistem level Kaguya
            if (RPG_ALIAS[p]) u[RPG_ALIAS[p]] = v
            else t[p] = v
            saveSoon()
            return true
        },
        has(t, p) { return p === 'level' || !!RPG_ALIAS[p] || p in t },
        ownKeys(t) { return [...new Set([...Reflect.ownKeys(t), 'level', ...Object.keys(RPG_ALIAS)])] },
        getOwnPropertyDescriptor(t, p) {
            if (p === 'level' || RPG_ALIAS[p]) return { value: this.get(t, p), writable: true, enumerable: true, configurable: true }
            return Reflect.getOwnPropertyDescriptor(t, p)
        },
        deleteProperty(t, p) { delete t[p]; saveSoon(); return true }
    })
}

function inventoryView(u) {
    const store = (u.inventoryx ||= {})
    const flatItem = (p) => typeof p === 'string' && Object.prototype.hasOwnProperty.call(u, p) && typeof u[p] === 'number'
    return new Proxy(store, {
        get(t, p) {
            if (typeof p === 'symbol') return Reflect.get(t, p)
            if (p in t) return t[p]
            if (flatItem(p) && !NOT_ITEM.has(p)) return u[p]
            return undefined
        },
        set(t, p, v) {
            if (flatItem(p) && !NOT_ITEM.has(p) && !(p in t)) u[p] = v
            else t[p] = v
            saveSoon()
            return true
        },
        has(t, p) { return p in t || (flatItem(p) && !NOT_ITEM.has(p)) },
        ownKeys(t) {
            const flat = Object.keys(u).filter(k => isItemKey(k, u[k]) && !(k in t))
            return [...Reflect.ownKeys(t), ...flat]
        },
        getOwnPropertyDescriptor(t, p) {
            if (p in t) return Reflect.getOwnPropertyDescriptor(t, p)
            if (flatItem(p) && !NOT_ITEM.has(p)) return { value: u[p], writable: true, enumerable: true, configurable: true }
            return undefined
        },
        deleteProperty(t, p) { delete t[p]; if (flatItem(p) && !NOT_ITEM.has(p)) u[p] = 0; saveSoon(); return true }
    })
}

const views = new WeakMap()
function userView(u, id) {
    if (views.has(u)) return views.get(u)
    const view = new Proxy(u, {
        get(t, p) {
            if (p === SELF) return t
            if (typeof p === 'symbol') return Reflect.get(t, p)
            if (p === 'rpg') return rpgView(t)
            if (p === 'inventory') return inventoryView(t)
            if (p === 'jid' || p === 'number') return id
            if (p === 'cooldowns') return (t.cooldowns ||= {})
            if (p === 'saldo') return t.saldo ?? 0
            if (FLAT_ALIAS[p]) return t[FLAT_ALIAS[p]]
            return t[p]
        },
        set(t, p, v) {
            if (p === 'rpg') { Object.assign(rpgView(t), v); return true }
            if (p === 'inventory') { Object.assign(inventoryView(t), v); return true }
            if (FLAT_ALIAS[p]) t[FLAT_ALIAS[p]] = v
            else t[p] = v
            saveSoon()
            return true
        },
        has(t, p) { return p === 'rpg' || p === 'inventory' || !!FLAT_ALIAS[p] || p in t },
        ownKeys(t) { return [...new Set([...Reflect.ownKeys(t), 'rpg', 'inventory', ...Object.keys(FLAT_ALIAS)])] },
        getOwnPropertyDescriptor(t, p) {
            if (p === 'rpg' || p === 'inventory' || FLAT_ALIAS[p]) return { value: this.get(t, p), writable: true, enumerable: true, configurable: true }
            return Reflect.getOwnPropertyDescriptor(t, p)
        },
        deleteProperty(t, p) { delete t[FLAT_ALIAS[p] || p]; saveSoon(); return true }
    })
    views.set(u, view)
    return view
}

/** record user Kaguya (datar) di balik tampilan */
export const flatOf = (user) => (user && user[SELF]) || user

// db.db.data.users: peta nomor -> tampilan user (bisa di-loop dan diubah)
const usersMap = new Proxy({}, {
    get(_, p) {
        if (typeof p === 'symbol') return undefined
        const u = rpgStore().users[keyFor(cleanId(p))]
        return u ? userView(u, cleanId(p)) : undefined
    },
    set(_, p, v) {
        const id = cleanId(p)
        const users = rpgStore().users
        const u = users[keyFor(id)] || (users[keyFor(id)] = makeDefaultUser(v?.name || id))
        if (v && typeof v === 'object') Object.assign(userView(u, id), v)
        saveSoon()
        return true
    },
    has(_, p) { return typeof p === 'string' && !!rpgStore().users[keyFor(cleanId(p))] },
    deleteProperty(_, p) { delete rpgStore().users[keyFor(cleanId(p))]; saveSoon(); return true },
    ownKeys() { return Object.keys(rpgStore().users).filter(k => k.endsWith('@s.whatsapp.net')).map(cleanId) },
    getOwnPropertyDescriptor(_, p) {
        const v = typeof p === 'string' ? this.get(_, p) : undefined
        return v ? { value: v, writable: true, enumerable: true, configurable: true } : undefined
    }
})

// ───────── database ala backup ─────────
const data = {
    users: usersMap,
    get groups() { return ext().groups },
    get settings() { return ext().settings },
    get stats() { return ext().stats },
    get sewa() { return ext().sewa },
    get legacy() { return ext().legacy },
    get guilds() { return ext().guilds },
    get simulator() { return ext().simulator },
    get bots() { return ext().bots },
    get clans() { return ext().legacy.clans },
    get activeWars() { return ext().legacy.activeWars },
    get pendingWars() { return ext().legacy.pendingWars },
    get warHistory() { return ext().legacy.warHistory },
    premium: [], owner: [], partner: []
}

const database = {
    db: { data, write: () => { saveSoon() }, read: () => { } },
    get data() { return data },
    get users() { return data.users },
    get groups() { return data.groups },
    get settings() { return data.settings },
    get stats() { return data.stats },
    get sewa() { return data.sewa },
    get legacy() { return data.legacy },

    markDirty() { saveSoon() },
    async save() { try { saveDB(global.db); return true } catch { return false } },
    flushAll() { try { saveDB(global.db) } catch { } },

    getUser(jid) {
        if (!jid || isBadJid(jid)) return null
        const id = cleanId(jid)
        if (!id) return null
        const u = rpgStore().users[keyFor(id)]
        return u ? userView(u, id) : null
    },
    setUser(jid, patch = {}) {
        if (!jid || isBadJid(jid)) return null
        const id = cleanId(jid)
        if (!id) return null
        const users = rpgStore().users
        const u = users[keyFor(id)] || (users[keyFor(id)] = makeDefaultUser(patch.name || id))
        const view = userView(u, id)
        for (const key of Object.keys(patch)) view[key] = patch[key]
        saveSoon()
        return view
    },
    deleteUser(jid) {
        const key = keyFor(cleanId(jid))
        if (!rpgStore().users[key]) return false
        delete rpgStore().users[key]
        saveSoon()
        return true
    },
    getAllUsers() { return data.users },
    getUserCount() { return Object.keys(data.users).length },

    updateEnergi(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        if (user.energi === -1) return -1
        if (config.isOwner(jid) || config.isPremium(jid)) return -1
        user.energi = Math.max(0, (Number(user.energi) || 0) + amount)
        saveSoon()
        return user.energi
    },
    updateKoin(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        user.koin = Math.max(0, Math.min(9e12, (Number(user.koin) || 0) + amount))
        saveSoon()
        return user.koin
    },
    updateSaldo(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        user.saldo = Math.max(0, (Number(user.saldo) || 0) + amount)
        saveSoon()
        return user.saldo
    },
    updateExp(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        user.exp = Math.max(0, Math.min(9e9, (Number(user.exp) || 0) + amount))
        saveSoon()
        return user.exp
    },
    getTopUsers(field, limit = 10) {
        return Object.values(data.users)
            .filter(u => (u[field] || 0) > 0)
            .sort((a, b) => (b[field] || 0) - (a[field] || 0))
            .slice(0, limit)
    },
    checkCooldown(jid, command) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return false
        const end = user.cooldowns[command] || 0
        const now = Date.now()
        return now < end ? Math.ceil((end - now) / 1000) : false
    },
    setCooldown(jid, command, seconds) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return
        user.cooldowns[command] = Date.now() + seconds * 1000
        saveSoon()
    },

    getGroup(jid) { return jid ? (data.groups[jid] || null) : null },
    setGroup(jid, patch = {}) {
        if (!jid) return null
        const old = data.groups[jid] || {}
        data.groups[jid] = {
            ...old, ...patch, jid,
            name: patch.name || old.name || 'Unknown Group',
            game: patch.game ?? old.game ?? true,
            rpg: patch.rpg ?? old.rpg ?? true,
            warnings: patch.warnings ?? old.warnings ?? [],
            chat: old.chat ?? {}
        }
        saveSoon()
        return data.groups[jid]
    },
    getAllGroups() { return data.groups },

    setting(key, value = undefined) {
        if (value !== undefined) { data.settings[key] = value; saveSoon() }
        return data.settings[key]
    },
    getSettings() { return data.settings },
    incrementStat(key, inc = 1) {
        data.stats[key] = (data.stats[key] || 0) + inc
        saveSoon()
        return data.stats[key]
    },
    getStats(key) { return key ? (data.stats[key] || 0) : data.stats },
    resetAllEnergi(defaultEnergi = 20) {
        let count = 0
        for (const user of Object.values(data.users)) { if (!user.isPremium) user.energi = defaultEnergi; count++ }
        saveSoon()
        return count
    }
}

export function getDatabase() { return database }
export const initDatabase = async () => database

// ───────── level (rumus Kaguya) ─────────
export const calculateLevel = (exp) => findLevel(Number(exp) || 0)
export const expForLevel = (level) => xpRange(Math.max(0, level)).min

export function getRole(level) {
    if (level >= 100) return '🐉 Mythic'
    if (level >= 80) return '⚔️ Legend'
    if (level >= 60) return '💜 Epic'
    if (level >= 40) return '💪 Grandmaster'
    if (level >= 20) return '🎖️ Master'
    if (level >= 10) return '⭐ Elite'
    return '🛡️ Warrior'
}

export async function checkAndNotifyLevelUp(sock, m, _db, user) {
    const flat = flatOf(user)
    const oldLevel = Number(flat.level) || 0
    let notified = false
    try { notified = await notifyLevelUp(sock, m, flat, m.chat) } catch { }
    const newLevel = Number(flat.level) || oldLevel
    return { leveledUp: newLevel > oldLevel, notified: !!notified, oldLevel, newLevel }
}

export async function addExpWithLevelCheck(sock, m, db, user, expAmount) {
    if (!user) return { leveledUp: false, notified: false, oldLevel: 1, newLevel: 1 }
    db.updateExp(m.sender, expAmount)
    const result = await checkAndNotifyLevelUp(sock, m, db, user)
    saveSoon()
    return result
}

// ───────── pengiriman pesan (ala src/context.js) ─────────
async function sendPreview(sock, jid, text, _title, options = {}) {
    const { mentions, quoted, contextInfo, ...rest } = options || {}
    const body = String(text ?? '')
    const auto = [...body.matchAll(/@(\d{5,20})/g)].map(x => `${x[1]}@s.whatsapp.net`)
    const all = [...new Set([...(Array.isArray(mentions) ? mentions : []), ...auto])]
    const content = { text: body }
    if (all.length) content.mentions = all
    const ctx = { ...saluranCtx(), ...(contextInfo || {}) }
    if (Object.keys(ctx).length) content.contextInfo = ctx
    const sent = await sock.sendMessage(jid, content, { quoted: quoted || undefined, ...rest })
    return { key: sent?.key || { id: sent?.key?.id, remoteJid: jid, fromMe: true } }
}
export const sendGamePreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const sendWinnerPreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const sendRpgPreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const sendToolsPreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const getGameContextInfo = () => saluranCtx()
export const getWinnerContextInfo = () => saluranCtx()
export const getRpgContextInfo = () => saluranCtx()
export { saluranCtx }

// ───────── pembungkus plugin RPG gaya config + handler ─────────
// Meniru gerbang adapter backup: wajib daftar (pakai status daftar Kaguya), cek grup/privat,
// biaya energi (= limit Kaguya), lalu menjalankan handler dengan sender nomor telepon.
export function rpgPlugin(pluginConfig, handler, opts = {}) {
    const cfg = { ...pluginConfig, cooldown: pluginConfig.cooldown ?? 0 }
    // data grup hanya diambil kalau handler memintanya
    const wantsGroup = /\b(groupMetadata|participants)\b/.test(Function.prototype.toString.call(handler))
    const run = async (m, ctx) => {
        const sock = ctx.sock
        const pm0 = await wrapMessage(sock, m)
        const sender = pm0.sender
        const mentioned = pm0.mentionedJid
        const quotedSender = pm0.quoted?.sender
        let groupMetadata
        if (wantsGroup && m.isGroup) {
            const meta = await getMeta(sock, ctx.jid || m.chat).catch(() => null)
            groupMetadata = meta
                ? { ...meta, participants: (meta.participants || []).map(x => ({ ...x, id: x.phoneNumber || x.id })) }
                : { id: ctx.jid || m.chat, participants: [] }
        }
        const pm = new Proxy(m, {
            get(t, p) {
                if (p === 'sender') return sender
                if (p === 'groupMetadata' && groupMetadata) return groupMetadata
                if (p === 'isAdmin') return !!ctx.isAdmin
                if (p === 'isBotAdmin') return !!ctx.isBotAdmin
                if (p === 'isOwner') return !!ctx.isOwner
                if (p === 'isPremium') return !!ctx.isPremium
                if (p === 'mentionedJid') return mentioned
                if (p === 'quoted' && t.quoted) {
                    return new Proxy(t.quoted, { get(q, k) { if (k === 'sender') return quotedSender; const v = Reflect.get(q, k); return typeof v === 'function' ? v.bind(q) : v } })
                }
                const v = Reflect.get(t, p)
                return typeof v === 'function' ? v.bind(t) : v
            }
        })

        const db = getDatabase()
        const flat = ensureUser({ sender, pushName: m.pushName })
        const user = userView(flat, cleanId(sender))
        const owner = !!ctx.isOwner
        const premium = !!ctx.isPremium || owner

        if (cfg.isEnabled === false) return ctx.reply('⚠️ Fitur ini sedang dinonaktifkan.')
        if (!cfg.noRegister && !owner && !flat.registered) {
            const p = ctx.prefix || '.'
            return promptRegister(sock, m, ctx, p)
        }
        const cost = Number(cfg.energi) || 0
        if (cost > 0 && !owner && !premium) {
            if ((Number(flat.limit) || 0) < cost) return ctx.reply(MSG.energiExceeded)
        }

        try {
            await handler(pm, { ...ctx, db, config, user, groupMetadata, participants: groupMetadata?.participants })
            if (cost > 0 && !owner && !premium) flat.limit = Math.max(0, (Number(flat.limit) || 0) - cost)
            db.incrementStat('rpgCommands')
        } catch (e) {
            // konvensi plugin lama: throw 'teks' = kirim teks itu, throw false = diam
            if (typeof e === 'string') return ctx.reply(e)
            if (e === false || e == null) return
            console.error(`[RPG] error pada command "${ctx.command}":`, e)
            return ctx.reply('⚠️ Terjadi kesalahan saat menjalankan perintah ini, coba lagi nanti.')
        } finally {
            saveSoon()
        }
    }
    const plugin = wrapPlugin(cfg, run)
    plugin.tags = [opts.tag || 'rpg'] // kategori menu (default rpg)
    return plugin
}


// ═══════════════════════════════════════════════════════════
// GAME RPG TAMBAHAN (storage, ekonomi, petualangan, tempur, karakter, cerita,
// bertahan, uno, gaple, genshin, hadiah, patroli, dll)
// Semua data disimpan di database: global.db.rpgData.bridge.game -> database/rpg.json
// (ikut tersimpan lewat saveDB bersama data RPG lain, tidak ada file json terpisah).
// ═══════════════════════════════════════════════════════════

const GAME_DEFAULT = () => ({ rpg: {}, guild: {}, uno: {}, gaple: {}, koboy: {}, catur: {}, arcade: {}, crypto: {}, clangame: {}, judibola: {}, bankCentral: 0, market: [], partyList: {}, mailbox: {} })
let gameFallback = null

function game() {
    let g
    try { g = ext().game } catch { g = (gameFallback ||= {}) } // database belum siap
    const def = GAME_DEFAULT()
    for (const k of Object.keys(def)) if (g[k] === undefined || typeof g[k] !== typeof def[k]) g[k] = def[k]
    return g
}

// Objek yang selalu menunjuk ke data database terbaru (tetap aman walau database dimuat ulang / direstore).
function live(getter) {
    return new Proxy({}, {
        get: (_, p) => { const o = getter(); const v = Reflect.get(o, p); return typeof v === 'function' ? v.bind(o) : v },
        set: (_, p, v) => Reflect.set(getter(), p, v),
        has: (_, p) => p in getter(),
        deleteProperty: (_, p) => Reflect.deleteProperty(getter(), p),
        ownKeys: () => Reflect.ownKeys(getter()),
        getOwnPropertyDescriptor: (_, p) => {
            const d = Reflect.getOwnPropertyDescriptor(getter(), p)
            return d ? { ...d, configurable: true } : undefined
        },
        defineProperty: (_, p, d) => Reflect.defineProperty(getter(), p, d)
    })
}

// state global yang dipakai plugin (global.bankCentral, global.market, ...) -> tersimpan di database
for (const key of ['bankCentral', 'market', 'partyList', 'mailbox']) {
    Object.defineProperty(global, key, {
        get: () => game()[key],
        set: (v) => { game()[key] = v; saveSoon() },
        configurable: true,
        enumerable: true
    })
}

// ───────── data RPG ─────────
// Objek ini dipakai bersama oleh semua plugin (referensinya tidak pernah diganti).
// ───────── data RPG tersambung ke akun user Kaguya ─────────
// Data RPG gaya Kaguya (rpgDb[jid]) dulu terpisah dari akun Kaguya. Sekarang field intinya
// dihubungkan langsung ke akun user (database.rpgData.users), jadi semua command (.work, .bank,
// .rpg-*, .clan*, dst.) membaca & mengubah angka yang SAMA:
//   coin -> money | bank -> bank | exp -> exp | level -> level | hp -> health | maxHp -> maxhealth
// Field lain (inv, weapon, armor, skill, cooldown, dst.) tetap di rpgDb[jid].
const RPG_LINK = { coin: 'money', bank: 'bank', exp: 'exp', level: 'level', hp: 'health', maxHp: 'maxhealth' }
const RPG_LINK_DEFAULT = { coin: 0, bank: 0, exp: 0, level: 1, hp: 100, maxHp: 100 }
const rpgViews = new WeakMap()
const rpgViewRaw = new WeakMap()
const pnKey = (id) => keyFor(cleanId(id))
const numOr0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

function flatPeek(id) {
    try { return rpgStore().users[pnKey(id)] } catch { return undefined }
}

// ambil / buat akun user Kaguya; sekali jalan memindahkan nilai lama rpgDb ke akun user
function flatEnsure(id, rec) {
    const users = rpgStore().users
    const key = pnKey(id)
    let flat = users[key]
    let created = false
    if (!flat) {
        flat = users[key] = makeDefaultUser(rec?.name || cleanId(id))
        created = true
    }
    if (rec && !rec._linked) {
        // cadangan nilai lama supaya bisa dipulihkan manual kalau perlu
        rec._pre = { coin: rec.coin, bank: rec.bank, exp: rec.exp, level: rec.level, hp: rec.hp, maxHp: rec.maxHp }
        // koin awal 100 dari sistem lama tidak digandakan untuk user yang sudah punya akun
        flat.money = numOr0(flat.money) + (created ? numOr0(rec.coin) : Math.max(0, numOr0(rec.coin) - 100))
        flat.bank = numOr0(flat.bank) + numOr0(rec.bank)
        flat.exp = numOr0(flat.exp) + numOr0(rec.exp)
        if (created && Number(rec.level) > 1) flat.level = Number(rec.level)
        for (const k of Object.keys(RPG_LINK)) delete rec[k]
        rec._linked = true
        saveSoon()
    }
    return flat
}

function rpgLinked(id, rec) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec) || isBadJid(id)) return rec
    if (rpgViews.has(rec)) return rpgViews.get(rec)
    const view = new Proxy(rec, {
        get(t, p) {
            if (typeof p === 'symbol') return Reflect.get(t, p)
            const k = RPG_LINK[p]
            if (!k) return t[p]
            let flat = flatPeek(id)
            if (!flat) return t[p] ?? RPG_LINK_DEFAULT[p] // belum punya akun: nilai lama (tidak membuat akun saat hanya membaca)
            if (!t._linked) flatEnsure(id, t)
            const v = flat[k]
            return v === undefined || v === null ? RPG_LINK_DEFAULT[p] : v
        },
        set(t, p, v) {
            const k = RPG_LINK[p]
            if (!k) { t[p] = v; saveSoon(); return true }
            flatEnsure(id, t)[k] = v
            saveSoon()
            return true
        },
        has(t, p) { return p in RPG_LINK || p in t },
        ownKeys(t) { return [...new Set([...Reflect.ownKeys(t), ...Object.keys(RPG_LINK)])] },
        getOwnPropertyDescriptor(t, p) {
            if (p in RPG_LINK) return { value: this.get(t, p), writable: true, enumerable: true, configurable: true }
            return Reflect.getOwnPropertyDescriptor(t, p)
        },
        deleteProperty(t, p) { delete t[p]; saveSoon(); return true }
    })
    rpgViews.set(rec, view)
    rpgViewRaw.set(view, rec)
    return view
}

const rpgRoot = () => game().rpg
// rpgDb[jid] selalu mengembalikan tampilan yang tersambung ke akun user (lihat RPG_LINK)
export const rpgDb = new Proxy({}, {
    get: (_, p) => {
        const o = rpgRoot()
        const v = Reflect.get(o, p)
        if (typeof p === 'string' && v && typeof v === 'object' && !Array.isArray(v)) return rpgLinked(p, v)
        return typeof v === 'function' ? v.bind(o) : v
    },
    set: (_, p, v) => Reflect.set(rpgRoot(), p, (v && rpgViewRaw.get(v)) || v),
    has: (_, p) => p in rpgRoot(),
    deleteProperty: (_, p) => Reflect.deleteProperty(rpgRoot(), p),
    ownKeys: () => Reflect.ownKeys(rpgRoot()),
    getOwnPropertyDescriptor: (_, p) => {
        const d = Reflect.getOwnPropertyDescriptor(rpgRoot(), p)
        return d ? { ...d, configurable: true } : undefined
    },
    defineProperty: (_, p, d) => Reflect.defineProperty(rpgRoot(), p, d)
})
export const saveRpg = () => saveSoon()

export const rpgGuildDb = live(() => game().guild)
export const saveGuild = () => saveSoon()

export function initRpgUser(id, name = 'Petualang') {
    const db = game().rpg
    if (!db[id]) {
        db[id] = {
            name,
            coin: 100,
            exp: 0,
            maxExp: 100,
            level: 1,
            inv: [],
            weapon: '',
            armor: '',
            bank: 0,
            dailyCooldown: 0,
            workCooldown: 0,
            huntCooldown: 0,
            quest: { dailyDone: false }
        }
        saveSoon()
    }
    const u = db[id]
    if (!Array.isArray(u.inv)) u.inv = []
    if (!u._linked) {
        if (!Number.isFinite(Number(u.coin))) u.coin = 0
        if (!Number.isFinite(Number(u.maxExp))) u.maxExp = 100
    }
    u.quest ||= { dailyDone: false }
    if (name && name !== 'No Name' && (!u.name || u.name === 'Petualang')) u.name = name
    if (isBadJid(id)) return u
    flatEnsure(id, u) // sambungkan ke akun user Kaguya (buat akun kalau belum ada)
    return rpgLinked(id, u)
}

export const bankCfg = {
    minAmount: 10,                   // minimal transaksi
    dailyTransferCap: 100000,        // batas transfer harian (dihitung dari JUMLAH sebelum fee)
    interestRate: 0.02,              // bunga tabungan / hari (klaim manual)
    loanInterest: 0.20,              // bunga pinjaman flat saat ambil
    heistSuccess: 0.5,               // peluang heist 50%
    heistCut: 0.20,                  // ambil 20% saldo korban jika sukses
    heistCooldownMs: 60 * 60 * 1000, // cooldown heist 1 jam
    insurancePremium: 250,           // biaya beli polis
    insuranceCoverage: 0.5,          // kurangi 50% kerugian saat kena heist
    feeRate: 0.01                    // 1% fee untuk tarik/transfer (masuk bankCentral)
}

export function ensureBankFields(u) {
    u.bank ??= 0
    u.loan ??= 0
    u.lastInterest ??= 0
    u.lastHeist ??= 0
    u.transferDay ??= 0
    u.transferUsed ??= 0
    u.insurance ??= false
    u.bankLog ??= []
    u.deposit ??= { amount: 0, until: 0 }
    u.escrow ??= null
}

export function todayKey() {
    const d = new Date()
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function pushLog(u, msg) {
    ensureBankFields(u)
    u.bankLog.unshift(`[${new Date().toLocaleString('id-ID')}] ${msg}`)
    if (u.bankLog.length > 20) u.bankLog.length = 20
}

export function isGuildLeaderOrOfficer(userId) {
    const u = game().rpg[userId]
    if (!u) return false
    if (u.isGuildLeader || u.isGuildOfficer) return true
    const gid = u.guild
    if (!gid) return false
    const g = game().guild[gid]
    if (!g) return false
    if (g.leader && g.leader === userId) return true
    if (Array.isArray(g.officers) && g.officers.includes(userId)) return true
    return false
}

// ───────── uno & gaple ─────────
const unoLive = live(() => game().uno)
const gapleLive = live(() => game().gaple)
const gameSlot = (key, view) => (data) => {
    const cur = game()[key]
    // data yang dikembalikan plugin biasanya objek yang sama dengan hasil read*, jangan dikosongkan dulu
    if (data && data !== cur && data !== view) {
        for (const k of Object.keys(cur)) delete cur[k]
        Object.assign(cur, data)
    }
    saveSoon()
}
// data game folder baru (dam, othello, ludo, mafia, bajaklaut, dst) -> game().arcade[nama game]
export const arcadeDb = live(() => game().arcade)
export const readUnoGameData = () => unoLive
export const writeUnoGameData = gameSlot('uno', unoLive)
export const readGapleGameData = () => gapleLive
export const writeGapleGameData = gameSlot('gaple', gapleLive)

// ───────── helper umum ─────────
export const fmt = (n) => Number(n || 0).toLocaleString('id-ID')

export function hms(ms) {
    const s = Math.max(0, Math.ceil(Number(ms) / 1000) || 0)
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), d = s % 60
    return [h && `${h} jam`, m && `${m} menit`, `${d} detik`].filter(Boolean).join(' ')
}
export const msToTime = hms

export const pickRandom = (list) => list[Math.floor(list.length * Math.random())]
export const randomNumber = (min, max = null) => {
    if (max === null) { max = min; min = 0 }
    return Math.floor(Math.random() * (max - min + 1)) + min
}
export function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}
export const delay = (ms) => new Promise(r => setTimeout(r, ms))

// genshin-db dimuat saat dibutuhkan saja, supaya bot tetap jalan walau paketnya belum dipasang
let genshinMod = null
export async function loadGenshin() {
    if (genshinMod) return genshinMod
    const mod = await import('genshin-db')
    genshinMod = mod.default && typeof mod.default.characters === 'function' ? mod.default : mod
    return genshinMod
}

// ───────── koboy (dipindah dari script Kaguya, data ikut database game) ─────────
// Semua data pemain tersimpan di database: game().koboy -> database/rpg.json (lewat saveDB).
export const koboyDb = live(() => game().koboy)

const KOBOY_SHOP = { 'pistol kayu': 0, 'pistol besi': 500, shotgun: 1500, armor: 1000, peluru: 100, 'tas besar': 800, medkit: 300, kuda: 1000 }
const KOBOY_CORE = ['pistol kayu', 'pistol besi', 'shotgun', 'peluru', 'armor']
const KOBOY_EXTRA = ['tas besar', 'medkit', 'kuda']
const KOBOY_MISI = [
    { jenis: 'kerja', teks: 'Kerja 1 kali', target: 1 },
    { jenis: 'tembak', teks: 'Menang duel 1 kali', target: 1 },
    { jenis: 'beli', teks: 'Beli item di toko', target: 1 },
    { jenis: 'kirim', teks: 'Kirim item ke pemain lain', target: 1 }
]
const koboyDay = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10)
const koboyRoll = (n) => Math.floor(Math.random() * n)

// stok toko harian: item inti selalu ada + 1 item tambahan yang berganti tiap hari
function koboyStok() {
    const d = Number(koboyDay().replace(/-/g, ''))
    return [...KOBOY_CORE, KOBOY_EXTRA[d % KOBOY_EXTRA.length]]
}

function koboyUser(id, name) {
    const db = game().koboy
    const isNew = !db[id]
    if (isNew) db[id] = { nama: name, role: 'Koboy', uang: 500, bank: 0, exp: 0, level: 1, senjata: 'Pistol Kayu', wanted: false }
    const u = db[id]
    if (name && name !== 'No Name') u.nama = name
    u.nama ||= 'Koboy'
    u.role ||= 'Koboy'
    for (const k of ['uang', 'bank', 'exp', 'kills']) if (!Number.isFinite(Number(u[k]))) u[k] = 0
    if (!Number.isFinite(Number(u.level)) || u.level < 1) u.level = 1
    if (!Array.isArray(u.inventori)) u.inventori = []
    if (!Number.isFinite(Number(u.kapasitas))) u.kapasitas = 10
    u.senjata ||= 'Pistol Kayu'
    u.wanted = !!u.wanted
    u.daily ??= null
    if (!u.investasi || typeof u.investasi !== 'object') u.investasi = { jumlah: 0, waktu: null }
    if (!u.statistik || typeof u.statistik !== 'object') u.statistik = { kerja: 0, duelMenang: 0, misiSelesai: 0 }
    if (!u.misi || typeof u.misi !== 'object') u.misi = { terakhir: null, status: 'belum', jenis: null, progress: 0, target: 1 }
    return { u, isNew }
}

function koboyLevelUp(u) {
    const notes = []
    let need = u.level * 100
    while (u.exp >= need) {
        u.exp -= need
        u.level += 1
        let t = `🎉 *Level Up!* Sekarang level ${u.level}`
        if (u.level === 15) { u.uang += 1000; t += '\n🎁 Bonus: 💰 1000!' }
        if (u.level === 10 && u.role === 'Koboy') { u.role = 'Bandit'; t += '\n🎯 Role berubah jadi *Bandit*!' }
        if (u.level === 20 && u.role === 'Bandit') { u.role = 'Sheriff'; t += '\n👑 Kamu sekarang jadi *Sheriff*!' }
        notes.push(t)
        need = u.level * 100
    }
    return notes
}

const koboyMisiTick = (u, jenis) => { if (u.misi?.jenis === jenis && u.misi.status === 'proses') u.misi.progress += 1 }

function koboyHelp(P, sub, role) {
        if (sub === 'help-role') {
        const umum = [
            `📜 ${P}koboy-status`, `💼 ${P}koboy-kerja`, `💼 ${P}koboy-kerja_berani`, `🎯 ${P}koboy-misi`, `🎁 ${P}koboy-daily`,
            `🛒 ${P}koboy-beli [item]`, `💸 ${P}koboy-jual [item]`, `📦 ${P}koboy-kirim [item] @user`, `🏦 ${P}koboy-setor [jumlah]`,
            `🏦 ${P}koboy-tarik [jumlah]`, `🏙️ ${P}koboy-kota`, `🛠️ ${P}koboy-equip [item]`, `📘 ${P}koboy-level`, `📈 ${P}koboy-rank`,
            `🏆 ${P}koboy-top`, `🎲 ${P}koboy-tebak [1-5]`, `🍺 ${P}koboy-minum`, `📈 ${P}koboy-invest [jumlah]`, `📈 ${P}koboy-cair`,
            `🛒 ${P}koboy-cekstok`, `🔎 ${P}koboy-skill`, `🔫 ${P}koboy-tembak @user`
        ]
        let khusus = []
        if (role === 'bandit') khusus = [`💣 ${P}koboy-rampok @user — Rampok pemain`, `🚨 ${P}koboy-wanted — Jadi buronan`]
        else if (role === 'sheriff') khusus = [`🪤 ${P}koboy-tangkap @user — Tangkap bandit`, `⚖️ ${P}koboy-hukum @user — Hukum bandit`, `🔓 ${P}koboy-lepas @user — Bebaskan pemain dari wanted`]
        return `🎭 *Menu Per Role: ${role.toUpperCase()}*\n\n📌 *Umum:*\n${umum.map(i => '• ' + i).join('\n')}` +
            (khusus.length ? `\n\n🧬 *Khusus ${role}:*\n${khusus.map(i => '• ' + i).join('\n')}` : '')
    }
    if (sub === 'help-ekonomi') return `💰 *Bantuan Ekonomi & Inventori:*\n\n🛒 *Toko & Inventori:*\n• ${P}koboy-beli [item] — Beli item\n• ${P}koboy-jual [item] — Jual item\n• ${P}koboy-equip [item] — Pasang senjata\n• ${P}koboy-kirim [item] @user — Kirim item ke pemain lain\n• ${P}koboy-cekstok — Cek stok toko\n\n🏦 *Bank & Uang:*\n• ${P}koboy-setor [jumlah] — Simpan uang ke bank\n• ${P}koboy-tarik [jumlah] — Ambil uang dari bank\n• ${P}koboy-invest [jumlah] — Investasi harian\n• ${P}koboy-cair — Ambil hasil investasi\n\n💼 *Pekerjaan & Misi:*\n• ${P}koboy-kerja — Kerja harian\n• ${P}koboy-kerja_berani — Hadiah besar, risiko tinggi\n• ${P}koboy-misi — Misi harian (hadiah)\n• ${P}koboy-daily — Bonus harian`
    if (sub === 'help-perang') return `🔫 *Bantuan Perang, Duel & Kejahatan:*\n\n🎯 *Duel & PVP:*\n• ${P}koboy-tembak @user — Duel pistol\n\n☠️ *Bandit (khusus role Bandit):*\n• ${P}koboy-wanted — Jadi buronan\n• ${P}koboy-rampok @user — Rampok pemain\n\n👮 *Sheriff (khusus role Sheriff):*\n• ${P}koboy-tangkap @user — Tangkap bandit\n• ${P}koboy-hukum @user — Hukum bandit\n• ${P}koboy-lepas @user — Bebaskan dari wanted`
    if (sub === 'help-tempat') return `🏙️ *Bantuan Lokasi & Kota:*\n\n• ${P}koboy-kota — Lihat lokasi tersedia\n• ${P}koboy-kota bank — Info setor & tarik uang\n• ${P}koboy-kota toko — Belanja item senjata\n• ${P}koboy-kota saloon — Minum & dapat EXP\n• ${P}koboy-kota penjara — Lihat daftar bandit wanted\n• ${P}koboy-kota sheriff — Info fitur Sheriff\n\n🎲 *Mini Game:*\n• ${P}koboy-tebak [1-5] — Tebak angka, dapat hadiah\n• ${P}koboy-minum — Minum di saloon (EXP +)`
    if (sub === 'help-ranking') return `🏆 *Bantuan Ranking & Statistik:*\n\n• ${P}koboy-top — Top 5 pemain terkaya\n• ${P}koboy-rank — Ranking EXP & Kill\n• ${P}koboy-leveltop — Ranking Level Tertinggi`
    return `🤠 *Koboy Game Help Menu*

📦 Bantuan
• ${P}koboy-helprole — Menu sesuai role kamu\n\n📜 *Dasar Pemula:*\n• ${P}koboy-daftar — Daftar sebagai koboy\n• ${P}koboy-status — Lihat status pemain\n• ${P}koboy-level — Cek EXP & Level\n• ${P}koboy-skill — Lihat skill berdasarkan role\n• ${P}koboy-peran — Lihat role kamu\n• ${P}koboy-kota — Masuk ke lokasi kota\n• ${P}koboy-cekstok — Cek stok toko hari ini\n\n📈 *Ranking & Statistik:*\n• ${P}koboy-top — Top 5 pemain terkaya\n• ${P}koboy-rank — Top EXP & Kill\n• ${P}koboy-leveltop — Top Level pemain\n\n💼 *Pekerjaan & Misi:*\n• ${P}koboy-kerja — Kerja biasa (💰 +EXP)\n• ${P}koboy-kerja_berani — Risiko tinggi, hadiah besar\n• ${P}koboy-misi — Ambil/cek misi harian\n• ${P}koboy-daily — Klaim bonus harian\n\n🛍️ *Toko & Barang:*\n• ${P}koboy-beli [item] — Beli item di toko\n• ${P}koboy-jual [item] — Jual item dari inventori\n• ${P}koboy-equip [item] — Pasang senjata\n• ${P}koboy-kirim [item] @user — Kirim item ke pemain lain\n\n🔫 *Pertarungan & Kejahatan:*\n• ${P}koboy-tembak @user — Duel dengan pemain lain\n• ${P}koboy-wanted — Jadi buronan (khusus Bandit)\n• ${P}koboy-rampok @user — Rampok pemain (khusus Bandit)\n\n👮 *Perintah Khusus Sheriff:*\n• ${P}koboy-tangkap @user — Tangkap bandit wanted\n• ${P}koboy-hukum @user — Hukum bandit (uang & EXP berkurang)\n• ${P}koboy-lepas @user — Bebaskan pemain dari wanted\n\n🏦 *Bank & Investasi:*\n• ${P}koboy-setor [jumlah] — Setor uang ke bank\n• ${P}koboy-tarik [jumlah] — Tarik uang dari bank\n• ${P}koboy-invest [jumlah] — Investasi 24 jam\n• ${P}koboy-cair — Ambil hasil investasi\n\n🍻 *Tempat & Mini Game:*\n• ${P}koboy-minum — Minum di saloon (EXP +)\n• ${P}koboy-tebak [1-5] — Tebak angka & menang hadiah\n• ${P}koboy-kota [lokasi] — bank, toko, sheriff, saloon, penjara\n\n📝 *Tips:*\n• EXP didapat dari kerja, tembak, minum, dan misi\n• Naik level = bonus uang dan perubahan role\n• Gunakan ${P}koboy-helprole untuk lihat skill khusus peran\n\nContoh:\n${P}koboy-kerja\n${P}koboy-beli peluru\n${P}koboy-tembak @user\n${P}koboy-kota toko`
}

export async function koboyRun(A, forcedSub) {
    const { m, reply, sender, prefix } = A
    const args = forcedSub ? [forcedSub, ...A.args] : A.args
    const P = prefix || '.'
        const db = game().koboy
    const { u, isNew } = koboyUser(sender, A.pushname)
    const say = (t) => reply(t)
    const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : 0 }

    let sub = String(args[0] || 'status').toLowerCase()
    const alias = { helprole: 'help-role', 'help-role': 'help-role', helpekonomi: 'help-ekonomi', helpperang: 'help-perang', helptempat: 'help-tempat', helpranking: 'help-ranking', toplevel: 'leveltop', kerjaberani: 'kerja_berani', 'kerja-berani': 'kerja_berani' }
    sub = alias[sub] || sub
    const rest = args.slice(1)
    // nama item = semua kata setelah sub-command, tanpa tag @ (mis. "kirim pistol besi @628xx")
    const itemText = rest.filter(w => !w.startsWith('@')).join(' ').toLowerCase().trim()
    const target = m.mentionedJid?.[0] || m.quoted?.sender || null
    const role = () => String(u.role).toLowerCase()
    const needTarget = (aksi) => {
        if (!target) { say(`🚨 Tag pemain yang ingin ${aksi}!`); return null }
        if (target === sender) { say('❌ Tidak bisa menarget diri sendiri.'); return null }
        const t = db[target]
        if (!t) { say('❌ Target belum terdaftar sebagai koboy.'); return null }
        koboyUser(target)
        return t
    }

    const exec = async () => {
        switch (sub) {
            case 'daftar':
                return say(isNew ? `🤠 Selamat datang, *${u.nama}*! Kamu terdaftar sebagai koboy dengan 💰 ${u.uang}.\nKetik *${P}koboy-help* untuk melihat semua perintah.` : '🤠 Kamu sudah terdaftar sebagai koboy!')

            case 'status': {
                const need = u.level * 100
                return say(`🤠 *STATUS KOBOY*\nNama: ${u.nama}\nPeran: ${u.role}\nLevel: ${u.level} (EXP: ${u.exp}/${need})\nUang: 💰 ${u.uang}\nBank: 🏦 ${u.bank}\nSenjata: ${u.senjata}\nWanted: ${u.wanted ? '🚨 IYA' : '❌ TIDAK'}\nKills: ${u.kills}\nInventori (${u.inventori.length}/${u.kapasitas}): ${u.inventori.join(', ') || 'Kosong'}`)
            }

            case 'kerja': {
                const hasil = koboyRoll(100) + 50
                u.uang += hasil; u.exp += 5; u.statistik.kerja += 1
                koboyMisiTick(u, 'kerja')
                return say(`💼 Kamu bekerja dan mendapatkan 💰 ${hasil}`)
            }

            case 'tembak': {
                const t = needTarget('ditembak'); if (!t) return
                if (!u.inventori.includes('peluru')) return say('🔫 Kamu kehabisan peluru!')
                const senjata = String(u.senjata).toLowerCase()
                let damage = 10
                if (senjata.includes('besi')) damage = 25
                else if (senjata.includes('shotgun')) damage = 40
                u.inventori.splice(u.inventori.indexOf('peluru'), 1)
                const finalDamage = t.inventori.includes('armor') ? Math.floor(damage / 2) : damage
                let chance = 0.5
                if (role() === 'koboy') chance += 0.1
                if (role() === 'bandit' && String(t.role).toLowerCase() === 'sheriff') chance -= 0.2
                if (senjata.includes('besi')) chance += 0.1
                if (senjata.includes('shotgun')) chance += 0.15
                if (Math.random() < chance) {
                    let curian = Math.min(100, t.uang)
                    if (role() === 'bandit') curian = Math.min(t.uang, Math.floor(curian * 1.15))
                    u.exp += finalDamage; u.uang += curian; t.uang -= curian
                    u.kills += 1; u.statistik.duelMenang += 1
                    koboyMisiTick(u, 'tembak')
                    return say(`🔫 Kamu menang duel melawan ${t.nama}!\n- Damage: ${finalDamage}\n- Ambil 💰 ${curian}\n- EXP +${finalDamage}`)
                }
                u.uang = Math.max(0, u.uang - 100)
                return say(`💥 Kamu kalah duel dari ${t.nama}! Kehilangan 💰 100 dan 1 peluru.`)
            }

            case 'beli': {
                const stok = koboyStok()
                if (!itemText || KOBOY_SHOP[itemText] === undefined || !stok.includes(itemText)) return say(`❌ Item tidak tersedia di toko.\nTersedia: ${stok.join(', ')}`)
                const harga = KOBOY_SHOP[itemText]
                if (u.uang < harga) return say('💸 Uang kamu tidak cukup!')
                if (itemText !== 'tas besar' && u.inventori.length >= u.kapasitas) return say('🎒 Tas kamu penuh! Tingkatkan kapasitas atau jual item.')
                u.uang -= harga
                koboyMisiTick(u, 'beli')
                if (itemText === 'tas besar') {
                    u.kapasitas += 5
                    return say(`🎒 Kamu membeli *tas besar*! Kapasitas inventori bertambah jadi ${u.kapasitas} slot.`)
                }
                u.inventori.push(itemText)
                return say(`🛒 Kamu membeli *${itemText}* seharga 💰 ${harga}`)
            }

            case 'jual': {
                if (!itemText) return say(`💵 Format: ${P}koboy-jual [item]`)
                const idx = u.inventori.indexOf(itemText)
                if (idx < 0) return say('❌ Kamu tidak punya item itu.')
                const harga = Math.floor((KOBOY_SHOP[itemText] || 0) / 2)
                u.inventori.splice(idx, 1)
                u.uang += harga
                if (String(u.senjata).toLowerCase() === itemText && !u.inventori.includes(itemText)) u.senjata = 'Pistol Kayu'
                return say(`💵 Kamu menjual *${itemText}* seharga 💰 ${harga}`)
            }

            case 'skill': {
                let s = '⚡ *Skill Role:*\n'
                if (role() === 'koboy') s += '- +10% peluang menang duel\n- Bisa kerja cari uang\n'
                else if (role() === 'bandit') s += '- Bisa merampok\n- +15% keuntungan tembak\n'
                else if (role() === 'sheriff') s += '- Bisa tangkap bandit\n- Dapat bonus uang dari tangkapan\n'
                else s += 'Belum ada skill.'
                return say(s)
            }

            case 'wanted':
                if (role() !== 'bandit') return say('❌ Hanya Bandit bisa jadi Wanted.')
                u.wanted = true
                return say('🚨 Kamu sekarang WANTED! Hati-hati jika bertemu Sheriff!')

            case 'top':
            case 'topkoboy': {
                const list = Object.values(db).sort((a, b) => b.uang - a.uang).slice(0, 5)
                    .map((d, i) => `*${i + 1}. ${d.nama}* - 💰${d.uang}`).join('\n') || 'Belum ada data'
                return say(`🏆 Top 5 Koboy Kaya:\n\n${list}`)
            }

            case 'level': {
                const need = u.level * 100
                return say(`📘 *Level Kamu: ${u.level}*\nEXP: ${u.exp}/${need} (${Math.floor((u.exp / need) * 100)}%)\nKetik ${P}koboy-kerja, ${P}koboy-tembak, atau ${P}koboy-misi untuk menambah EXP!`)
            }

            case 'leveltop': {
                const list = Object.values(db).sort((a, b) => b.level - a.level || b.exp - a.exp).slice(0, 5)
                    .map((d, i) => `*${i + 1}. ${d.nama}* - Level ${d.level} (EXP: ${d.exp})`).join('\n') || 'Belum ada data.'
                return say(`🏆 *Top Level Koboy*\n\n${list}`)
            }

            case 'peran':
                return say('👤 Peran kamu saat ini: ' + u.role)

            case 'tangkap': {
                if (role() !== 'sheriff') return say('❌ Hanya Sheriff yang bisa menangkap!')
                const t = needTarget('ditangkap'); if (!t) return
                if (!t.wanted) return say('✅ Target bukan bandit yang dicari.')
                u.uang += 300; t.wanted = false
                return say(`🪤 Kamu menangkap ${t.nama}! Dapat 💰 300`)
            }

            case 'lepas': {
                if (role() !== 'sheriff') return say('❌ Hanya Sheriff yang bisa melepas tahanan!')
                const t = needTarget('dilepas'); if (!t) return
                t.wanted = false
                return say(`🔓 Kamu melepaskan ${t.nama} dari status wanted.`)
            }

            case 'hukum': {
                if (role() !== 'sheriff') return say('❌ Hanya Sheriff yang bisa menghukum!')
                const t = needTarget('dihukum'); if (!t) return
                if (!t.wanted) return say('✅ Target bukan bandit yang dicari.')
                t.uang = Math.max(0, t.uang - 200)
                t.exp = Math.max(0, t.exp - 20)
                t.wanted = false
                return say(`⚖️ ${t.nama} dihukum! Kehilangan 💰200 dan EXP 20`)
            }

            case 'misi': {
                const today = koboyDay()
                if (!u.misi || u.misi.terakhir !== today) {
                    const ms = KOBOY_MISI[koboyRoll(KOBOY_MISI.length)]
                    u.misi = { terakhir: today, status: 'proses', jenis: ms.jenis, teks: ms.teks, progress: 0, target: ms.target }
                    return say(`🎯 Misi harian kamu:\n${ms.teks}\n\nGunakan kembali *${P}koboy-misi* untuk cek progres.`)
                }
                if (u.misi.status === 'selesai') return say('✅ Kamu sudah menyelesaikan misi hari ini.')
                if (u.misi.progress >= u.misi.target) {
                    u.uang += 200; u.exp += 25; u.misi.status = 'selesai'; u.statistik.misiSelesai += 1
                    return say('📜 Misi selesai!\n+💰 200\n+📘 EXP 25')
                }
                return say(`📊 Progres Misi:\n${u.misi.teks}\n${u.misi.progress}/${u.misi.target}`)
            }

            case 'kirim': {
                const item = rest.filter(w => !w.startsWith('@')).join(' ').toLowerCase().trim()
                if (!item || !target) return say(`🔁 Format: ${P}koboy-kirim [item] @user`)
                const t = needTarget('dikirimi item'); if (!t) return
                const idx = u.inventori.indexOf(item)
                if (idx < 0) return say('❌ Kamu tidak punya item itu!')
                if (t.inventori.length >= t.kapasitas) return say(`🎒 Tas ${t.nama} penuh, item tidak bisa dikirim.`)
                u.inventori.splice(idx, 1)
                t.inventori.push(item)
                if (String(u.senjata).toLowerCase() === item && !u.inventori.includes(item)) u.senjata = 'Pistol Kayu'
                koboyMisiTick(u, 'kirim')
                return say(`📦 Item *${item}* berhasil dikirim ke ${t.nama}`)
            }

            case 'rank': {
                const list = Object.values(db).sort((a, b) => b.exp - a.exp).slice(0, 5)
                    .map((d, i) => `*${i + 1}. ${d.nama}* - EXP: ${d.exp}, Kill: ${d.kills || 0}`).join('\n') || 'Data kosong.'
                return say(`🎖️ *Top EXP & Kill*\n\n${list}`)
            }

            case 'kota': {
                const tempat = String(args[1] || '').toLowerCase()
                if (!tempat) return say(`🏙️ Selamat datang di Kota Koboy!\nKetik: ${P}koboy-kota [tempat]\n\nTempat yang tersedia:\n🏦 bank - Simpan/ambil uang\n🍺 saloon - Minum & dapat EXP\n🛒 toko - Belanja senjata & item\n🧾 penjara - Lihat daftar bandit\n👮 sheriff - Info kantor sheriff`)
                if (tempat === 'bank') return say(`🏦 *BANK KOBOY*\nGunakan: ${P}koboy-setor [jumlah] atau ${P}koboy-tarik [jumlah]\nSaldo bank kamu: 💰 ${u.bank}`)
                if (tempat === 'saloon') return say(`🍺 *SALOON KOBOY*\nMinuman 💰 50 dan dapat EXP.\nGunakan: ${P}koboy-minum`)
                if (tempat === 'toko') return say(`🛒 *TOKO DINAMIS*\nGunakan: ${P}koboy-beli [item]\n\nStok hari ini:\n` + koboyStok().map(i => `- ${i} (💰 ${KOBOY_SHOP[i]})`).join('\n'))
                if (tempat === 'penjara') {
                    const list = Object.values(db).filter(d => d.wanted).map(d => `👤 ${d.nama} - 💰 ${d.uang}`).join('\n') || 'Tidak ada bandit wanted.'
                    return say(`🧾 *DAFTAR BURONAN*\n\n${list}`)
                }
                if (tempat === 'sheriff') return say(`👮 *KANTOR SHERIFF*\nSheriff bisa memakai ${P}koboy-tangkap, ${P}koboy-hukum, atau ${P}koboy-lepas untuk menangani bandit!`)
                return say(`❌ Tempat tidak ditemukan. Gunakan: ${P}koboy-kota`)
            }

            case 'setor': {
                const jml = num(args[1])
                if (!jml) return say(`💰 Masukkan jumlah uang yang ingin disetor!\nContoh: ${P}koboy-setor 100`)
                if (jml > u.uang) return say('💸 Uang kamu tidak cukup!')
                u.uang -= jml; u.bank += jml
                return say(`🏦 Kamu menyetor 💰 ${jml} ke bank.`)
            }

            case 'tarik': {
                const jml = num(args[1])
                if (!jml) return say(`💰 Masukkan jumlah uang yang ingin ditarik!\nContoh: ${P}koboy-tarik 100`)
                if (jml > u.bank) return say('🏦 Uang di bank tidak cukup!')
                u.bank -= jml; u.uang += jml
                return say(`💸 Kamu menarik 💰 ${jml} dari bank.`)
            }

            case 'cekstok':
                return say('🛒 Stok toko hari ini:\n' + koboyStok().join(', '))

            case 'rampok': {
                if (role() !== 'bandit') return say('❌ Hanya Bandit yang bisa merampok!')
                const t = needTarget('dirampok'); if (!t) return
                if (t.uang < 100) return say('💸 Target terlalu miskin, tidak bisa dirampok.')
                if (Math.random() < 0.5) {
                    const hasil = Math.min(200, t.uang)
                    t.uang -= hasil; u.uang += hasil; u.exp += 10
                    return say(`🏴‍☠️ Kamu berhasil merampok ${t.nama} dan mendapatkan 💰 ${hasil}!`)
                }
                u.uang = Math.max(0, u.uang - 150)
                u.wanted = true
                return say('💥 Rampokan gagal! Kamu ketahuan dan kehilangan 💰150.\n🚨 Sekarang kamu jadi *WANTED*!')
            }

            case 'equip': {
                if (!itemText) return say(`⚙️ Format: ${P}koboy-equip [item]`)
                if (!u.inventori.includes(itemText)) return say('❌ Kamu tidak memiliki item tersebut!')
                if (itemText.includes('pistol') || itemText.includes('shotgun')) {
                    u.senjata = itemText
                    return say(`🔫 Senjata kamu sekarang: *${itemText}*`)
                }
                if (itemText === 'armor') return say('🛡️ Armor tidak perlu di-equip, otomatis aktif jika kamu memilikinya.')
                return say('❌ Item tidak bisa dipasang/equip.')
            }

            case 'daily': {
                const today = koboyDay()
                if (u.daily === today) return say('📆 Kamu sudah klaim bonus hari ini!')
                u.daily = today; u.uang += 150; u.exp += 15
                return say('🎁 Bonus harian diklaim!\n+💰 150 uang\n+📘 15 EXP')
            }

            case 'minum': {
                if (u.uang < 50) return say('🍺 Uang kamu kurang! Minuman harganya 💰 50')
                u.uang -= 50
                const bonus = koboyRoll(10) + 5
                u.exp += bonus
                return say(`🍻 Kamu menikmati minuman di saloon.\n+📘 ${bonus} EXP, -💰 50`)
            }

            case 'kerja_berani': {
                if (Math.random() < 0.6) {
                    const hasil = koboyRoll(200) + 100
                    u.uang += hasil; u.exp += 10
                    return say(`💼 Kerja berani sukses! Kamu dapat 💰 ${hasil} dan 📘 10 EXP`)
                }
                const rugi = koboyRoll(100) + 50
                u.uang = Math.max(0, u.uang - rugi)
                return say(`💥 Kerja gagal total! Kamu rugi 💰 ${rugi}`)
            }

            case 'invest': {
                if (u.investasi.jumlah > 0) return say(`💼 Kamu masih punya investasi aktif 💰 ${u.investasi.jumlah}. Ketik *${P}koboy-cair* dulu.`)
                const jml = num(args[1])
                if (!jml) return say(`💼 Masukkan jumlah uang untuk investasi!\nContoh: ${P}koboy-invest 100`)
                if (jml > u.uang) return say('💸 Uang kamu tidak cukup!')
                u.uang -= jml
                u.investasi = { jumlah: jml, waktu: Date.now() }
                return say(`🏦 Kamu menginvestasikan 💰 ${jml}.\nGunakan *${P}koboy-cair* setelah 24 jam untuk ambil hasil.`)
            }

            case 'cair': {
                if (!u.investasi || u.investasi.jumlah <= 0) return say('❌ Kamu tidak punya investasi aktif.')
                const durasi = Date.now() - u.investasi.waktu
                const hari = 24 * 60 * 60 * 1000
                if (durasi < hari) return say(`⏳ Investasi belum matang. Tunggu sekitar ${Math.ceil((hari - durasi) / 36e5)} jam lagi.`)
                const hasil = Math.floor(u.investasi.jumlah * 1.5)
                u.uang += hasil
                u.investasi = { jumlah: 0, waktu: null }
                return say(`💰 Investasi cair! Kamu dapat ${hasil}`)
            }

            case 'tebak': {
                const tebakan = parseInt(args[1], 10)
                if (!tebakan || tebakan < 1 || tebakan > 5) return say(`🎲 Masukkan angka antara 1 sampai 5\nContoh: ${P}koboy-tebak 3`)
                const benar = koboyRoll(5) + 1
                if (tebakan === benar) {
                    u.uang += 200; u.exp += 10
                    return say(`🎯 Benar! Angka: ${benar}\n+💰 200 uang\n+📘 10 EXP`)
                }
                u.uang = Math.max(0, u.uang - 50)
                return say(`❌ Salah! Angka yang benar: ${benar}\n-💰 50`)
            }

            case 'roll': {
                const t = needTarget('diajak adu dadu'); if (!t) return
                const a = koboyRoll(6) + 1, b = koboyRoll(6) + 1
                let pesan = `🎲 PVP Roll!\n${u.nama}: ${a}\n${t.nama}: ${b}\n`
                if (a > b) { u.kills += 1; u.exp += 10; pesan += `🎉 ${u.nama} menang! +10 EXP` }
                else if (b > a) { t.kills += 1; t.exp += 10; pesan += `🎉 ${t.nama} menang! +10 EXP` }
                else pesan += '🤝 Seri! Tidak ada yang menang.'
                return say(pesan)
            }

            case 'help':
            case 'menu':
            case 'help-role':
            case 'help-ekonomi':
            case 'help-perang':
            case 'help-tempat':
            case 'help-ranking':
                return say(koboyHelp(P, sub === 'menu' ? 'help' : sub, role()))

            default:
                return say(`⚠️ Sub-command tidak ditemukan.\nContoh: ${P}koboy-kerja, ${P}koboy-beli pistol besi, ${P}koboy-wanted\nKetik *${P}koboy-help* untuk daftar lengkap.`)
        }
    }

    await exec()
    const notes = koboyLevelUp(u)
    if (notes.length) await say(notes.join('\n\n'))
    saveSoon()
}

// ───────── catur (dipindah dari script Kaguya, dirapikan jadi satu model data) ─────────
// Data tersimpan di database game: game().catur = { games: {chat: game}, skor: {jid: {menang, kalah, seri}} }
const CT_WHITE = '♙♖♘♗♕♔'
const CT_BLACK = '♟♜♞♝♛♚'
const CT_VAL = { '♙': 1, '♟': 1, '♘': 3, '♞': 3, '♗': 3, '♝': 3, '♖': 5, '♜': 5, '♕': 9, '♛': 9 }
const CT_WAIT = 3 * 60 * 1000
const ctTimers = new Map()

const ctSide = (p) => (p && CT_WHITE.includes(p) ? 'white' : p && CT_BLACK.includes(p) ? 'black' : null)
const ctStore = () => { const c = game().catur; c.games ||= {}; c.skor ||= {}; return c }
const ctNum = (jid) => String(jid || '').split('@')[0]
const ctPoin = (s) => (s.menang || 0) * 3 + (s.seri || 0)

function ctBoard() {
    return [
        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
        ['', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', ''],
        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
    ]
}

export function caturPapan(board) {
    let s = ''
    for (let r = 0; r < 8; r++) {
        s += (8 - r) + ' '
        for (let c = 0; c < 8; c++) s += board[r][c] || '⬛'
        s += '\n'
    }
    return s + '  A B C D E F G H'
}

// Aturan gerak bidak (tanpa rokade, en passant, dan deteksi skak; raja yang dimakan = kalah)
function ctCheckMove(board, fx, fy, tx, ty) {
    const piece = board[fx][fy], dest = board[tx][ty], side = ctSide(piece)
    if (fx === tx && fy === ty) return 'Bidak harus berpindah tempat.'
    if (dest && ctSide(dest) === side) return 'Kotak tujuan berisi bidakmu sendiri.'
    const dx = tx - fx, dy = ty - fy, adx = Math.abs(dx), ady = Math.abs(dy)
    const clear = () => {
        const sx = Math.sign(dx), sy = Math.sign(dy)
        for (let x = fx + sx, y = fy + sy; x !== tx || y !== ty; x += sx, y += sy) if (board[x][y]) return false
        return true
    }
    const kind = '♙♟'.includes(piece) ? 'p' : '♖♜'.includes(piece) ? 'r' : '♘♞'.includes(piece) ? 'n' : '♗♝'.includes(piece) ? 'b' : '♕♛'.includes(piece) ? 'q' : 'k'
    if (kind === 'p') {
        const dir = side === 'white' ? -1 : 1, start = side === 'white' ? 6 : 1
        if (dy === 0 && dx === dir && !dest) return null
        if (dy === 0 && dx === 2 * dir && fx === start && !dest && !board[fx + dir][fy]) return null
        if (ady === 1 && dx === dir && dest) return null
        return 'Langkah pion tidak valid.'
    }
    if (kind === 'n') return (adx === 2 && ady === 1) || (adx === 1 && ady === 2) ? null : 'Langkah kuda tidak valid.'
    if (kind === 'k') return adx <= 1 && ady <= 1 ? null : 'Raja hanya boleh melangkah 1 kotak.'
    const straight = dx === 0 || dy === 0, diag = adx === ady
    if ((kind === 'r' && !straight) || (kind === 'b' && !diag) || (kind === 'q' && !straight && !diag)) return 'Langkah bidak tidak valid.'
    return clear() ? null : 'Jalur terhalang bidak lain.'
}

function ctMaterial(board) {
    let w = 0, b = 0
    for (const row of board) for (const p of row) { if (CT_VAL[p]) (ctSide(p) === 'white' ? (w += CT_VAL[p]) : (b += CT_VAL[p])) }
    return { w, b }
}

function ctClear(chat) {
    const t = ctTimers.get(chat)
    if (t) { clearTimeout(t.timer); clearTimeout(t.notif); ctTimers.delete(chat) }
}

function ctScore(jid) { const s = ctStore().skor; return (s[jid] ||= { menang: 0, kalah: 0, seri: 0 }) }

function ctFinish(chat, winner, loser) {
    const c = ctStore()
    if (winner && loser) { ctScore(winner).menang++; ctScore(loser).kalah++ }
    delete c.games[chat]
    ctClear(chat)
    saveSoon()
}

// timer giliran (3 menit) & notifikasi diam; dipasang ulang tiap ada langkah
function ctArm(sock, chat) {
    ctClear(chat)
    const g = ctStore().games[chat]
    if (!g || g.status !== 'ongoing' || (!g.timer && !g.notif)) return
    const slot = {}
    const turnId = g.hist.length + (g.skips || 0)
    const cur = () => (g.turn === 'white' ? g.p1 : g.p2)
    const still = () => ctStore().games[chat] === g && g.hist.length + (g.skips || 0) === turnId
    if (g.notif) slot.notif = setTimeout(() => {
        if (!still()) return
        sock.sendMessage(chat, { text: `⏳ @${ctNum(cur())}, giliranmu belum dimainkan selama 3 menit.`, mentions: [cur()] }).catch(() => {})
    }, CT_WAIT)
    if (g.timer) slot.timer = setTimeout(() => {
        if (!still()) return
        const kalah = cur(), menang = kalah === g.p1 ? g.p2 : g.p1
        ctFinish(chat, menang, kalah)
        sock.sendMessage(chat, { text: `⏰ Waktu habis! @${ctNum(kalah)} dianggap kalah.\n🏆 Pemenang: @${ctNum(menang)}`, mentions: [menang, kalah] }).catch(() => {})
    }, CT_WAIT)
    ctTimers.set(chat, slot)
}

function ctHelp(P) {
    const c = `${P}catur`
    return `┌───⌈ *📖 PANDUAN CATUR MULTIPLAYER* ⌋
│
│ ♟️ Bermain catur langsung di grup bersama temanmu!
│
│ 🎮 *Cara Memulai:*
│ ➤ ${c} @tag — Tantang pemain lain
│ ➤ ${c}-terima / ${c}-tolak — Jawab tantangan
│ ➤ ${c}-langkah e2 e4 — Jalankan bidak
│
│ ⚙️ *Kontrol Permainan:*
│ ➤ ${c}-status — Status permainan
│ ➤ ${c}-skip — Lewati giliran
│ ➤ ${c}-draw — Ajukan / terima seri
│ ➤ ${c}-menyerah — Menyerah
│ ➤ ${c}-hapus — (Admin) Hapus pertandingan
│
│ 📊 *Skor & Ranking:*
│ ➤ ${c}-nilai — Statistik menang, kalah, seri kamu
│ ➤ ${c}-rank — Posisi kamu dalam peringkat
│ ➤ ${c}-top10 — Top 10 pemain terbaik
│ ➤ ${c}-skorreset — (Owner) Reset skor pemain
│
│ ♟️ *Papan & Analisa:*
│ ➤ ${c}-next — Siapa giliran sekarang?
│ ➤ ${c}-board — Lihat papan
│ ➤ ${c}-history — Riwayat langkah
│ ➤ ${c}-analisa — Langkah terakhir & material
│
│ ⏱️ *Timer & Notifikasi:*
│ ➤ ${c}-timer — (Admin) Timer giliran 3 menit
│ ➤ ${c}-notif — (Admin) Notif jika pemain diam > 3 menit
│
│ ℹ️ Raja yang dimakan = kalah. Rokade, en passant, dan
│ deteksi skak belum didukung. Pion promosi jadi Ratu.
└─────⌈ ♟️ Jadilah legenda catur grupmu! ⌋`
}

export async function caturRun(A, sub) {
    const { m, reply, sender, prefix, isOwner, isAdmins, text } = A
    const P = prefix || '.'
    const chat = m.chat
    const c = ctStore()
    const g = c.games[chat]
    const say = (t) => reply(t)
    const noGame = () => say('❌ Tidak ada pertandingan di chat ini.')
    const ongoing = () => g && g.status === 'ongoing'
    const nameOf = (side) => `@${ctNum(side === 'white' ? g.p1 : g.p2)} (${side === 'white' ? 'Putih' : 'Hitam'})`
    const target = m.mentionedJid?.[0] || m.quoted?.sender || null

    switch (sub) {
        case 'challenge': {
            if (!target) return say(`❌ Tag pengguna untuk ditantang!\nContoh: *${P}catur @user*`)
            if (target === sender) return say('Kamu tidak bisa menantang dirimu sendiri.')
            if (g) return say('❌ Masih ada game di chat ini.')
            c.games[chat] = { p1: sender, p2: target, turn: 'white', board: ctBoard(), status: 'pending', hist: [], skips: 0, draw: null, timer: false, notif: false, at: Date.now() }
            return say(`♟️ Tantangan dikirim ke @${ctNum(target)}!\n\nBalas dengan *${P}catur-terima* untuk main atau *${P}catur-tolak* untuk menolak.\nGunakan *${P}catur-help* untuk panduan lengkap.`)
        }
        case 'terima': {
            if (!g || g.status !== 'pending') return say('❌ Tidak ada tantangan aktif.')
            if (g.p2 !== sender) return say('Kamu bukan yang ditantang.')
            g.status = 'ongoing'
            ctArm(A.Bot, chat)
            return say(`♟️ Game dimulai!\nPutih: @${ctNum(g.p1)}\nHitam: @${ctNum(g.p2)}\nGiliran: *Putih*\n\n${caturPapan(g.board)}\n\nJalankan bidak: *${P}catur-langkah e2 e4*`)
        }
        case 'tolak': {
            if (!g || g.status !== 'pending') return say('❌ Tidak ada tantangan aktif.')
            if (g.p2 !== sender && g.p1 !== sender) return say('Kamu bukan bagian dari tantangan ini.')
            delete c.games[chat]
            return say('❌ Tantangan ditolak/dibatalkan.')
        }
        case 'langkah': {
            if (!ongoing()) return say('❌ Tidak ada game berjalan.')
            const mv = String(text || '').toLowerCase().replace(/[\s\-→x]/g, '')
            const mm = /^([a-h])([1-8])([a-h])([1-8])$/.exec(mv)
            if (!mm) return say(`Gunakan: *${P}catur-langkah e2 e4*`)
            const cur = g.turn === 'white' ? g.p1 : g.p2
            if (sender !== cur) return say(sender === g.p1 || sender === g.p2 ? '⏳ Bukan giliranmu.' : 'Kamu bukan pemain di game ini.')
            const col = 'abcdefgh'
            const fx = 8 - Number(mm[2]), fy = col.indexOf(mm[1]), tx = 8 - Number(mm[4]), ty = col.indexOf(mm[3])
            const piece = g.board[fx][fy]
            if (!piece) return say('❌ Tidak ada bidak di posisi itu.')
            if (ctSide(piece) !== g.turn) return say('Itu bukan bidakmu.')
            const bad = ctCheckMove(g.board, fx, fy, tx, ty)
            if (bad) return say(`❌ ${bad}`)
            const taken = g.board[tx][ty]
            let placed = piece
            if (piece === '♙' && tx === 0) placed = '♕'
            if (piece === '♟' && tx === 7) placed = '♛'
            g.board[tx][ty] = placed
            g.board[fx][fy] = ''
            g.hist.push(`${piece} ${mm[1]}${mm[2]}${taken ? '✕' : '→'}${mm[3]}${mm[4]}${placed !== piece ? ' (promosi ♛)' : ''}`)
            g.draw = null
            if (taken === '♚' || taken === '♔') {
                const kalah = g.turn === 'white' ? g.p2 : g.p1
                const board = caturPapan(g.board)
                ctFinish(chat, sender, kalah)
                return say(`🏁 *SKAKMAT!* Raja dimakan.\n🏆 Pemenang: @${ctNum(sender)}\n\n${board}`)
            }
            g.turn = g.turn === 'white' ? 'black' : 'white'
            ctArm(A.Bot, chat)
            return say(`✅ Langkah berhasil!${taken ? ` (memakan ${taken})` : ''}\n\n${caturPapan(g.board)}\nGiliran: ${nameOf(g.turn)}`)
        }
        case 'status': {
            if (!g) return noGame()
            const st = g.status === 'pending' ? '🕐 Menunggu lawan menerima...' : '♟️ Sedang berlangsung'
            return say(`♟️ *Status Game Catur:*\n• Putih: @${ctNum(g.p1)}\n• Hitam: @${ctNum(g.p2)}\n• Status: ${st}\n• Langkah: ${g.hist.length}\n• Timer: ${g.timer ? 'aktif' : 'mati'} | Notif: ${g.notif ? 'aktif' : 'mati'}`)
        }
        case 'skip': {
            if (!ongoing()) return noGame()
            const cur = g.turn === 'white' ? g.p1 : g.p2
            if (sender !== cur) return say('❌ Bukan giliranmu.')
            g.turn = g.turn === 'white' ? 'black' : 'white'
            g.skips = (g.skips || 0) + 1
            g.draw = null
            ctArm(A.Bot, chat)
            return say(`⏩ @${ctNum(sender)} melewatkan giliran.\n🔁 Giliran selanjutnya: ${nameOf(g.turn)}`)
        }
        case 'draw': {
            if (!ongoing()) return noGame()
            if (sender !== g.p1 && sender !== g.p2) return say('Kamu bukan pemain di game ini.')
            if (!g.draw) {
                g.draw = sender
                return say(`🤝 @${ctNum(sender)} mengajukan hasil seri.\nJika lawan setuju, ketik *${P}catur-draw* juga.`)
            }
            if (g.draw === sender) return say('❌ Kamu sudah mengajukan seri, tunggu respon lawan.')
            ctScore(g.p1).seri++; ctScore(g.p2).seri++
            const [a, b] = [g.p1, g.p2]
            ctFinish(chat)
            return say(`🤝 Pertandingan diakhiri dengan hasil *Seri* antara @${ctNum(a)} dan @${ctNum(b)}.`)
        }
        case 'menyerah': {
            if (!ongoing()) return noGame()
            if (sender !== g.p1 && sender !== g.p2) return say('Kamu bukan pemain di game ini.')
            const menang = sender === g.p1 ? g.p2 : g.p1
            ctFinish(chat, menang, sender)
            return say(`🏳️ @${ctNum(sender)} menyerah.\n🏆 Pemenang: @${ctNum(menang)}`)
        }
        case 'hapus': {
            if (!isOwner && !isAdmins) return say('❌ Hanya admin atau owner yang bisa menghapus pertandingan.')
            if (!g) return say('❌ Tidak ada pertandingan untuk dihapus.')
            ctFinish(chat)
            return say('✅ Pertandingan catur dihapus.')
        }
        case 'nilai': {
            const s = c.skor[sender] || { menang: 0, kalah: 0, seri: 0 }
            return say(`📊 *Skor Catur Kamu*\n\n🏆 Menang : ${s.menang || 0}\n💀 Kalah : ${s.kalah || 0}\n🤝 Seri : ${s.seri || 0}\n⭐ Poin : ${ctPoin(s)}`)
        }
        case 'rank': {
            const list = Object.entries(c.skor).sort((a, b) => ctPoin(b[1]) - ctPoin(a[1]))
            if (!list.length) return say('❌ Belum ada pemain yang memiliki skor.')
            const i = list.findIndex(([id]) => id === sender)
            if (i < 0) return say('❌ Kamu belum punya skor. Main dulu: ' + `${P}catur @user`)
            return say(`🏁 *Peringkat Catur Kamu*\n\nPosisi: *#${i + 1}* dari ${list.length} pemain\n⭐ Poin: ${ctPoin(list[i][1])} (W:${list[i][1].menang || 0}, D:${list[i][1].seri || 0}, L:${list[i][1].kalah || 0})`)
        }
        case 'top10': {
            const top = Object.entries(c.skor).map(([jid, s]) => ({ jid, ...s, poin: ctPoin(s) })).sort((a, b) => b.poin - a.poin).slice(0, 10)
            if (!top.length) return say('❌ Belum ada skor.')
            return say('🏆 *Top 10 Pemain Catur*\n\n' + top.map((p, i) => `${i + 1}. @${ctNum(p.jid)} | ${p.poin} pts (W:${p.menang || 0}, D:${p.seri || 0}, L:${p.kalah || 0})`).join('\n'))
        }
        case 'skorreset': {
            if (!isOwner) return say('❌ Hanya owner yang bisa reset skor.')
            const t = target || sender
            if (!c.skor[t]) return say('❌ Pengguna belum punya skor.')
            delete c.skor[t]
            return say(`✅ Skor catur @${ctNum(t)} telah di-reset.`)
        }
        case 'next': {
            if (!ongoing()) return noGame()
            return say(`🔁 Sekarang giliran: ${nameOf(g.turn)}`)
        }
        case 'board': {
            if (!g || !g.board) return noGame()
            return say(`♟️ Papan Catur Saat Ini:\n\n${caturPapan(g.board)}${g.status === 'ongoing' ? `\nGiliran: ${nameOf(g.turn)}` : ''}`)
        }
        case 'history': {
            if (!g) return noGame()
            if (!g.hist.length) return say('📜 Belum ada langkah yang dilakukan.')
            return say('📜 Riwayat Langkah:\n' + g.hist.map((h, i) => `${i + 1}. ${h}`).join('\n'))
        }
        case 'analisa': {
            if (!g) return noGame()
            if (!g.hist.length) return say('📜 Belum ada langkah yang dilakukan.')
            const { w, b } = ctMaterial(g.board)
            const lead = w === b ? 'Seimbang' : w > b ? `Putih unggul +${w - b}` : `Hitam unggul +${b - w}`
            return say(`📊 *Analisa*\nLangkah terakhir: *${g.hist[g.hist.length - 1]}*\nTotal langkah: ${g.hist.length}\nMaterial: Putih ${w} vs Hitam ${b} (${lead})`)
        }
        case 'timer':
        case 'notif': {
            if (!isOwner && !isAdmins) return say(`❌ Hanya owner/admin yang bisa menyalakan ${sub}.`)
            if (!g) return noGame()
            const key = sub === 'timer' ? 'timer' : 'notif'
            g[key] = !g[key]
            ctArm(A.Bot, chat)
            return say(key === 'timer'
                ? (g.timer ? '⏱️ Timer giliran *dinyalakan* (3 menit per giliran, habis = kalah).' : '⏱️ Timer giliran *dimatikan*.')
                : (g.notif ? '🔔 Notifikasi diam *dinyalakan* (giliran tidak dimainkan >3 menit).' : '🔕 Notifikasi diam *dimatikan*.'))
        }
        case 'help':
            return say(ctHelp(P))
        default:
            return say(`⚠️ Perintah catur tidak dikenal. Ketik *${P}catur-help*.`)
    }
}

// ───────── crypto (dipindah dari script Kaguya) ─────────
// Data tersimpan di database game: game().crypto = { portfolio, alert, watchlist }
// Harga dari CoinGecko (USD). Portofolio bersifat simulasi (tanpa saldo).
const CR_IDS = {
    btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin',
    ton: 'the-open-network', trx: 'tron', dot: 'polkadot', matic: 'matic-network', pol: 'polygon-ecosystem-token', ltc: 'litecoin',
    usdt: 'tether', usdc: 'usd-coin', shib: 'shiba-inu', avax: 'avalanche-2', link: 'chainlink', xlm: 'stellar', atom: 'cosmos',
    bch: 'bitcoin-cash', near: 'near', etc: 'ethereum-classic', pepe: 'pepe', sui: 'sui', apt: 'aptos', arb: 'arbitrum', op: 'optimism'
}
const CR_SYM = Object.fromEntries(Object.entries(CR_IDS).map(([s, id]) => [id, s.toUpperCase()]))
const crId = (s) => { const k = String(s || '').toLowerCase().trim(); return CR_IDS[k] || k }
const crName = (id) => CR_SYM[id] || String(id).toUpperCase()
const crStore = () => { const s = game().crypto; s.portfolio ||= {}; s.alert ||= {}; s.watchlist ||= {}; return s }
const crUSD = (n) => {
    const v = Number(n) || 0
    return '$' + v.toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) < 1 ? 6 : 2 })
}

async function crPrices(ids) {
    const list = [...new Set(ids.filter(Boolean))]
    if (!list.length) return {}
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(list.join(','))}&vs_currencies=usd`, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } })
        if (!res.ok) return null
        const j = await res.json()
        return Object.fromEntries(list.map(id => [id, j?.[id]?.usd ?? null]))
    } catch { return null }
}

// pengecek alert harga (jalan tiap 2 menit setelah ada command crypto; alert yang kena dikirim ke DM pemilik)
let crWatcher = null
function crWatch(sock) {
    if (crWatcher) return
    crWatcher = setInterval(async () => {
        try {
            const al = crStore().alert
            const ids = Object.values(al).flat().map(a => a.coin)
            if (!ids.length) return
            const prices = await crPrices(ids)
            if (!prices) return
            let changed = false
            for (const [jid, arr] of Object.entries(al)) {
                const keep = []
                for (const a of arr) {
                    const p = prices[a.coin]
                    const hit = p != null && (a.dir === 'below' ? p <= a.price : p >= a.price)
                    if (!hit) { keep.push(a); continue }
                    changed = true
                    sock.sendMessage(jid, { text: `⏰ *ALERT CRYPTO*\n${crName(a.coin)} sekarang ${crUSD(p)} (target ${crUSD(a.price)}).` }).catch(() => {})
                }
                if (keep.length) al[jid] = keep; else delete al[jid]
            }
            if (changed) saveSoon()
        } catch (e) { console.error('[CRYPTO] alert:', e.message) }
    }, 2 * 60 * 1000)
    crWatcher.unref?.()
}

export async function cryptoRun(A, sub) {
    const { reply, sender, args, prefix } = A
    const P = prefix || '.'
    const s = crStore()
    const say = (t) => reply(t)
    const raw = String(args[0] || '').toLowerCase()
    const coin = crId(raw)
    const val = parseFloat(String(args[1] ?? '').replace(',', '.'))
    const fail = '⚠️ Gagal mengambil harga dari CoinGecko, coba lagi nanti.'
    crWatch(A.Bot)

    switch (sub) {
        case 'price': {
            if (!raw) return say(`Contoh: ${P}crypto-price btc`)
            const p = await crPrices([coin])
            if (!p) return say(fail)
            if (!p[coin]) return say('Koin tidak ditemukan.')
            return say(`💸 Harga *${crName(coin)}* sekarang: ${crUSD(p[coin])}`)
        }
        case 'buy': {
            if (!raw || !(val > 0)) return say(`Contoh: ${P}crypto-buy btc 100 (nilai dalam USD)`)
            const p = await crPrices([coin])
            if (!p) return say(fail)
            if (!p[coin]) return say('Koin tidak ditemukan.')
            const amount = val / p[coin]
            const pf = (s.portfolio[sender] ||= {})
            pf[coin] = (pf[coin] || 0) + amount
            return say(`✅ Membeli *${amount.toFixed(6)} ${crName(coin)}* senilai ${crUSD(val)}`)
        }
        case 'sell': {
            if (!raw || !(val > 0)) return say(`Contoh: ${P}crypto-sell btc 100 (nilai dalam USD)`)
            const pf = s.portfolio[sender]
            if (!pf || !pf[coin]) return say('Kamu belum punya koin ini.')
            const p = await crPrices([coin])
            if (!p || !p[coin]) return say(fail)
            const amount = val / p[coin]
            if (pf[coin] + 1e-12 < amount) return say(`Jumlah koin tidak cukup. Kamu punya ${pf[coin].toFixed(6)} ${crName(coin)} (${crUSD(pf[coin] * p[coin])}).`)
            pf[coin] -= amount
            if (pf[coin] <= 1e-9) delete pf[coin]
            if (!Object.keys(pf).length) delete s.portfolio[sender]
            return say(`✅ Menjual *${amount.toFixed(6)} ${crName(coin)}* senilai ${crUSD(val)}`)
        }
        case 'portfolio': {
            const pf = s.portfolio[sender]
            if (!pf || !Object.keys(pf).length) return say('📭 Portofoliomu kosong.')
            const prices = await crPrices(Object.keys(pf))
            if (!prices) return say(fail)
            let teks = '*📊 PORTOFOLIO KAMU:*\n', total = 0
            for (const [id, jml] of Object.entries(pf)) {
                const v = jml * (prices[id] || 0)
                total += v
                teks += `• ${crName(id)}: ${jml.toFixed(6)} (${prices[id] ? crUSD(v) : 'harga tidak tersedia'})\n`
            }
            return say(teks + `\n💰 Total: *${crUSD(total)}*`)
        }
        case 'alert': {
            if (!raw || !(val > 0)) return say(`Contoh: ${P}crypto-alert btc 50000`)
            const p = await crPrices([coin])
            if (!p) return say(fail)
            if (!p[coin]) return say('Koin tidak ditemukan.')
            const arr = (s.alert[sender] ||= [])
            if (arr.length >= 10) return say('❌ Maksimal 10 alert aktif per pengguna.')
            const dir = val >= p[coin] ? 'above' : 'below'
            arr.push({ coin, price: val, dir, at: Date.now() })
            return say(`⏰ Alert dibuat! Kamu akan diberi tahu lewat chat pribadi saat ${crName(coin)} ${dir === 'above' ? 'naik ke' : 'turun ke'} ${crUSD(val)} (sekarang ${crUSD(p[coin])}).`)
        }
        case 'watchlist': {
            const list = s.watchlist[sender] || []
            if (!list.length) return say('📭 Watchlist kosong.')
            const prices = await crPrices(list)
            return say('👁️ Watchlist kamu:\n' + list.map(id => `- ${crName(id)}${prices && prices[id] ? ` — ${crUSD(prices[id])}` : ''}`).join('\n'))
        }
        case 'watchadd': {
            if (!raw) return say(`Contoh: ${P}crypto-watchadd btc`)
            const list = (s.watchlist[sender] ||= [])
            if (list.includes(coin)) return say('Sudah ada di watchlist.')
            const p = await crPrices([coin])
            if (p && !p[coin]) return say('Koin tidak ditemukan.')
            list.push(coin)
            return say(`✅ ${crName(coin)} ditambahkan ke watchlist.`)
        }
        case 'watchdel': {
            if (!raw) return say(`Contoh: ${P}crypto-watchdel btc`)
            const list = s.watchlist[sender] || []
            if (!list.includes(coin)) return say('Koin itu tidak ada di watchlist kamu.')
            s.watchlist[sender] = list.filter(v => v !== coin)
            if (!s.watchlist[sender].length) delete s.watchlist[sender]
            return say(`🗑️ ${crName(coin)} dihapus dari watchlist.`)
        }
        default:
            return say(`*🪙 CRYPTO MENU*\n\n• ${P}crypto-price <coin>\n• ${P}crypto-buy <coin> <usd>\n• ${P}crypto-sell <coin> <usd>\n• ${P}crypto-portfolio\n• ${P}crypto-alert <coin> <harga>\n• ${P}crypto-watchlist\n• ${P}crypto-watchadd <coin>\n• ${P}crypto-watchdel <coin>`)
    }
}

// ───────── gaple (dipindah dari script Kaguya) ─────────
// Data per grup tersimpan di database game: game().gaple[chat] (lewat readGapleGameData / writeGapleGameData).
// Command: gaple, gaple-join, gaple-start, gaple-info, gaple-hand, gaple-play, gaple-draw, gaple-pass, gaple-stop
const gpDeck = () => { const d = []; for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) d.push([i, j]); return d }
const gpCard = (c) => `[${c[0]}|${c[1]}]`
const gpTag = (jid) => `@${String(jid).split('@')[0]}`
const gpHand = (p) => p.hand.map((c, i) => `${i}: ${gpCard(c)}`).join('\n') || '(kosong)'
const gpEnds = (g) => g.table.length ? [g.table[0][0], g.table[g.table.length - 1][1]] : null
const gpCanPlay = (g, hand) => {
    const e = gpEnds(g)
    return !e || hand.some(c => c.includes(e[0]) || c.includes(e[1]))
}
function gpPlace(table, card, side) {
    if (!table.length) { table.push([card[0], card[1]]); return true }
    const left = table[0][0]
    const right = table[table.length - 1][1]
    if (side === 'left') {
        if (card[1] === left) { table.unshift([card[1], card[0]]); return true }
        if (card[0] === left) { table.unshift([card[0], card[1]]); return true }
    } else if (side === 'right') {
        if (card[0] === right) { table.push([card[0], card[1]]); return true }
        if (card[1] === right) { table.push([card[1], card[0]]); return true }
    }
    return false
}

export async function gapleRun(A, sub) {
    const { m, reply, sender, prefix, isOwner, isAdmins, Bot } = A
    const P = prefix || '.'
    const chat = m.chat
    const say = (t) => reply(t)
    if (!m.isGroup) return say('❌ Perintah ini hanya bisa digunakan di grup.')

    const games = readGapleGameData()
    let g = games[chat]
    const save = () => writeGapleGameData(games)
    const me = () => g?.players.find(p => p.id === sender)
    const turnOf = () => g?.players[g.currentPlayer]
    const status = async () => {
        const meja = g.table.length ? g.table.map(gpCard).join(' - ') : '(kosong)'
        const hands = g.players.map((p, i) => `${i}: ${gpTag(p.id)} (${p.hand.length} kartu)`).join('\n')
        const e = gpEnds(g)
        return say(
            `🀄 *Permainan Gaple*\n\nMeja: ${meja}\n` +
            (e ? `Ujung: kiri *${e[0]}* | kanan *${e[1]}*\n` : '') +
            `Sisa deck: ${g.deck.length}\nGiliran: ${gpTag(turnOf().id)}\n\n📊 Jumlah kartu pemain:\n${hands}`
        )
    }
    const sendHand = async (p, title) => {
        try { await Bot.sendMessage(String(p.id), { text: `🀱 *${title}* 🀱\n\n${gpHand(p)}` }); return true } catch { return false }
    }
    const finish = (text) => { delete games[chat]; save(); return say(text) }

    switch (sub) {
        case 'info':
            return say(`
📘 *Panduan Bermain Gaple (Domino)*

1) Bergabung & Mulai
   • \`${P}gaple\` → buat permainan di grup
   • \`${P}gaple-join\` → ikut permainan
   • \`${P}gaple-start\` → mulai (minimal 2 pemain)

2) Lihat Kartu
   • \`${P}gaple-hand\` → kartu milikmu (dikirim via chat pribadi)

3) Main Kartu
   • \`${P}gaple-play <nomor_kartu> <left/right>\`
   • Contoh: \`${P}gaple-play 2 left\`
   • Kartu hanya bisa ditaruh bila salah satu angkanya sama dengan ujung kiri/kanan di meja.

4) Ambil Kartu
   • \`${P}gaple-draw\` → ambil kartu dari deck jika buntu (jika deck masih ada)

5) Lewati Giliran
   • \`${P}gaple-pass\` → lewati giliran jika tidak bisa jalan

6) Pemenang
   • Pemain pertama yang habis kartunya adalah pemenang 🎉
   • Kalau semua pemain buntu, pemenangnya yang sisa angkanya paling kecil

7) Hentikan Permainan
   • \`${P}gaple-stop\` → hentikan permainan (butuh persetujuan semua pemain atau admin)
`.trim())

        case 'create': {
            if (g) return g.started ? status() : say(`🀄 Permainan Gaple sudah dibuat. Ketik *${P}gaple-join* untuk bergabung, lalu *${P}gaple-start*.`)
            games[chat] = { players: [], deck: gpDeck(), table: [], currentPlayer: 0, stopVotes: [], started: false, passes: 0 }
            save()
            return say(`🀄 Permainan Gaple dimulai! Ketik *${P}gaple-join* untuk bergabung.\nPanduan: *${P}gaple-info*`)
        }
    }

    if (!g) return say(`❌ Belum ada permainan Gaple di grup ini. Ketik *${P}gaple* untuk membuatnya.`)

    switch (sub) {
        case 'join': {
            if (g.started) return say('❌ Permainan sudah berjalan, tidak bisa bergabung.')
            if (me()) return say('Kamu sudah bergabung ke permainan ini.')
            g.players.push({ id: sender, hand: [] })
            save()
            return say(`✅ ${gpTag(sender)} bergabung ke permainan Gaple! (${g.players.length} pemain)`)
        }

        case 'start': {
            if (g.started) return say('❌ Permainan sudah berjalan.')
            if (g.players.length < 2) return say('❌ Minimal 2 pemain untuk memulai permainan.')
            g.deck = shuffle(gpDeck())
            const failed = []
            for (const p of g.players) {
                p.hand = []
                for (let i = 0; i < 7 && g.deck.length; i++) p.hand.push(g.deck.pop())
                if (!await sendHand(p, 'Kartu Awalmu')) failed.push(p.id)
            }
            if (g.deck.length) g.table = [g.deck.pop()]
            g.currentPlayer = 0
            g.started = true
            g.passes = 0
            save()
            if (failed.length) await say(`⚠️ Kartu tidak bisa dikirim ke chat pribadi: ${failed.map(gpTag).join(', ')}.\nChat bot dulu, lalu ketik *${P}gaple-hand*.`)
            return status()
        }

        case 'hand': {
            const p = me()
            if (!p) return say('❌ Kamu belum bergabung ke permainan.')
            if (!g.started) return say('❌ Permainan belum dimulai.')
            const ok = await sendHand(p, 'Kartu Milikmu')
            return say(ok ? `📩 ${gpTag(sender)} sudah menerima daftar kartunya di chat pribadi.` : `❌ Gagal mengirim ke chat pribadi ${gpTag(sender)}. Chat bot dulu, lalu coba lagi.`)
        }

        case 'play': {
            if (!g.started) return say('❌ Permainan belum dimulai.')
            const pl = turnOf()
            if (!pl || pl.id !== sender) return say('❌ Sekarang bukan giliranmu!')
            const idx = parseInt(A.args[0], 10)
            const side = String(A.args[1] || '').toLowerCase()
            if (isNaN(idx) || idx < 0 || idx >= pl.hand.length) return say(`❌ Nomor kartu tidak valid. Contoh: ${P}gaple-play 2 left`)
            if (!['left', 'right'].includes(side)) return say('❌ Pilih sisi: left/right.')
            const card = pl.hand[idx]
            if (!gpPlace(g.table, card, side)) return say('❌ Kartu itu tidak cocok dengan ujung meja.')
            pl.hand.splice(idx, 1)
            g.passes = 0
            if (pl.hand.length === 0) return finish(`🎉 ${gpTag(sender)} MENANG permainan Gaple!`)
            g.currentPlayer = (g.currentPlayer + 1) % g.players.length
            save()
            return status()
        }

        case 'draw': {
            if (!g.started) return say('❌ Permainan belum dimulai.')
            const pl = turnOf()
            if (!pl || pl.id !== sender) return say('❌ Sekarang bukan giliranmu!')
            if (gpCanPlay(g, pl.hand)) return say('❌ Kamu masih punya kartu yang bisa dimainkan.')
            if (!g.deck.length) return say(`📦 Deck kosong, tidak bisa draw. Ketik *${P}gaple-pass* untuk melewati giliran.`)
            const card = g.deck.pop()
            pl.hand.push(card)
            save()
            await sendHand(pl, 'Kartu Milikmu')
            await say(`📥 ${gpTag(sender)} mengambil kartu dari deck. (sisa deck ${g.deck.length})`)
            return status()
        }

        case 'pass': {
            if (!g.started) return say('❌ Permainan belum dimulai.')
            const pl = turnOf()
            if (!pl || pl.id !== sender) return say('❌ Sekarang bukan giliranmu!')
            if (gpCanPlay(g, pl.hand)) return say('❌ Kamu masih punya kartu yang bisa dimainkan.')
            if (g.deck.length) return say(`❌ Deck masih ada, ambil dulu dengan *${P}gaple-draw*.`)
            g.passes = (g.passes || 0) + 1
            if (g.passes >= g.players.length) {
                // semua pemain buntu: pemenang = total angka kartu paling kecil
                const score = (p) => p.hand.reduce((s, c) => s + c[0] + c[1], 0)
                const sorted = [...g.players].sort((a, b) => score(a) - score(b))
                const rank = sorted.map((p, i) => `${i + 1}. ${gpTag(p.id)} (${score(p)} poin)`).join('\n')
                return finish(`🔒 Semua pemain buntu!\n\n${rank}\n\n🎉 ${gpTag(sorted[0].id)} MENANG dengan sisa angka paling kecil!`)
            }
            g.currentPlayer = (g.currentPlayer + 1) % g.players.length
            save()
            return status()
        }

        case 'stop': {
            if (isAdmins || isOwner) return finish('⏹ Permainan Gaple dihentikan oleh admin/owner.')
            if (!me()) return say('❌ Kamu belum bergabung ke permainan.')
            if (!g.stopVotes.includes(sender)) g.stopVotes.push(sender)
            if (g.stopVotes.length >= g.players.length) return finish('⏹ Permainan Gaple dihentikan dengan persetujuan semua pemain.')
            save()
            return say(`📢 Permintaan stop diterima. Masih dibutuhkan ${g.players.length - g.stopVotes.length} pemain untuk setuju.`)
        }

        default:
            return say(`❓ Perintah tidak dikenali. Gunakan *${P}gaple-info* untuk melihat panduan.`)
    }
}

// ───────── clan game (dipindah dari script Kaguya) — SATU DATA dengan plugins/clan ─────────
// Dulu clan-game punya penyimpanan sendiri (game().clangame.clans). Sekarang semua command clan
// (clancreate, clanjoin, ... dan clan-create, clan-join, ...) memakai store yang sama:
//   db.db.data.clans[id] = { id, name, emblem, leader, members:[jid], exp, level, wins, losses, ... }
// ditambah field clan-game (joinRequests, points, warLimit, currentWarCount, missions, clanTasks)
// dan user.clanId tetap disinkronkan. Data clan-game lama dipindah otomatis sekali (cgMigrate).
// Turnamen tetap di game().clangame.tournaments (peserta = id clan).
const CLAN_EMBLEMS = ['🐉', '🦅', '🐺', '🦁', '🔥', '⚡', '🌙', '☀️', '💎', '🗡️']
const CG_MAX_MEMBERS = 50

export function clanShortId(name, existing) {
    const clean = String(name || '').replace(/[^a-zA-Z]/g, '').toUpperCase()
    let id = clean.length >= 3 ? clean.slice(0, 3) : clean.padEnd(3, 'X')
    if (!existing[id]) return id
    id = clean.slice(0, 4) || id
    if (!existing[id]) return id
    for (let i = 1; i <= 99; i++) {
        const attempt = clean.slice(0, 3) + i
        if (!existing[attempt]) return attempt
    }
    return clean.slice(0, 2) + Math.random().toString(36).slice(2, 5).toUpperCase()
}

const cgMemberId = (x) => (typeof x === 'string' ? x : x?.id)
const cgSetClanId = (jid, clanId) => { try { database.setUser(jid, { clanId }) } catch { } }

// lengkapi field clan-game pada clan lama (aman dipanggil berulang)
function cgNorm(c) {
    c.name ||= c.clan || c.id
    c.leader ||= c.owner
    c.members = (Array.isArray(c.members) ? c.members : []).map(cgMemberId).filter(Boolean)
    c.level = Number(c.level) || 1
    c.points = Number(c.points) || 0
    c.exp = Number(c.exp) || 0
    c.wins = Number(c.wins) || 0
    c.losses = Number(c.losses) || 0
    c.warLimit = Number(c.warLimit) || 5
    c.currentWarCount = Number(c.currentWarCount) || 0
    c.joinRequests = Array.isArray(c.joinRequests) ? c.joinRequests : []
    c.clanTasks ||= { description: 'Reach level 3', progress: 1, target: 3, reward: 300 }
    c.emblem ||= '🏰'
    c.description ||= 'Belum ada deskripsi'
    if (c.isOpen === undefined) c.isOpen = true
    return c
}

// pindahkan clan dari penyimpanan clan-game lama ke store clan utama (sekali jalan)
function cgMigrate() {
    const old = game().clangame
    if (!old?.clans || !Object.keys(old.clans).length) return
    const clans = ext().legacy.clans
    const idOf = {}
    for (const [key, c] of Object.entries(old.clans)) {
        const name = c.clan || key
        let found = Object.values(clans).find(x => String(x.name).toLowerCase() === String(name).toLowerCase())
        if (!found) {
            const id = clanShortId(name, clans)
            found = clans[id] = {
                id, name, emblem: CLAN_EMBLEMS[Math.floor(Math.random() * CLAN_EMBLEMS.length)],
                leader: c.owner, members: [], exp: 0, level: Number(c.level) || 1, wins: 0, losses: 0,
                createdAt: new Date(c.createdAt || Date.now()).toISOString(), description: 'Belum ada deskripsi', isOpen: true
            }
        }
        idOf[key] = found.id
        for (const f of ['points', 'warLimit', 'currentWarCount', 'missions', 'lastDailyMissionDate', 'lastWeeklyMissionDate', 'warDate', 'joinRequests', 'clanTasks']) {
            if (c[f] !== undefined && found[f] === undefined) found[f] = c[f]
        }
        found.members = [...new Set([...(found.members || []).map(cgMemberId), ...(c.members || []).map(cgMemberId)])].filter(Boolean)
        for (const jid of found.members) cgSetClanId(jid, found.id)
    }
    for (const t of Object.values(old.tournaments || {})) {
        t.participants = (t.participants || []).map(k => idOf[k] || k)
        for (const mt of t.matches || []) { mt.clan1 = idOf[mt.clan1] || mt.clan1; mt.clan2 = idOf[mt.clan2] || mt.clan2; mt.winner = idOf[mt.winner] || mt.winner }
        if (t.winner) t.winner = idOf[t.winner] || t.winner
    }
    delete old.clans
    saveSoon()
}

const cgStore = () => {
    cgMigrate()
    const g = game().clangame
    g.tournaments ||= {}
    if (g.current === undefined) g.current = null
    const clans = ext().legacy.clans
    for (const c of Object.values(clans)) cgNorm(c)
    return {
        clans,
        tournaments: g.tournaments,
        get current() { return g.current },
        set current(v) { g.current = v }
    }
}
const cgKey = (name) => String(name || '').trim().toLowerCase()
const cgFind = (s, name) => {
    const k = cgKey(name)
    if (!k) return undefined
    return Object.values(s.clans).find(c => cgKey(c.name) === k || cgKey(c.id) === k)
}
const cgOfMember = (s, jid) => Object.values(s.clans).find(c => c.members.includes(jid))
const cgOfOwner = (s, jid) => Object.values(s.clans).find(c => c.leader === jid)
const cgPower = (c) => c.level * c.members.length
const cgLevelCost = { 2: 100, 3: 200, 4: 400, 5: 800 }
const CG_MAX_LEVEL = 5

// misi harian & mingguan (reset otomatis), dari lib clan Kaguya (setMissions)
function cgSetMissions(c) {
    cgNorm(c)
    const day = String(todayKey())
    const week = String(Math.floor(Date.now() / (7 * 86400000)))
    c.missions ||= {}
    if (c.lastDailyMissionDate !== day || !c.missions.daily) {
        c.missions.daily = { description: 'Complete 3 battles', progress: 0, target: 3, reward: 50 }
        c.lastDailyMissionDate = day
    }
    if (c.lastWeeklyMissionDate !== week || !c.missions.weekly) {
        c.missions.weekly = { description: 'Recruit 5 new members', progress: 0, target: 5, reward: 200 }
        c.lastWeeklyMissionDate = week
    }
    if (c.warDate !== day) { c.warDate = day; c.currentWarCount = 0 }
}

// tambah progres misi; kalau tercapai, hadiah masuk ke poin clan (updateMissionProgress)
function cgMission(c, type, n = 1) {
    cgSetMissions(c)
    const ms = c.missions[type]
    ms.progress += n
    if (ms.progress >= ms.target) {
        c.points = (c.points || 0) + ms.reward
        ms.progress = 0
        return `🎯 Misi ${type} selesai! Clan dapat +${ms.reward} poin.`
    }
    return ''
}

// task clan "Reach level N": selesai kalau level tercapai, lalu target naik (updateClanTaskProgress)
function cgCheckTask(c) {
    cgNorm(c)
    const t = c.clanTasks
    t.progress = c.level
    if (t.progress >= t.target) {
        c.points = (c.points || 0) + t.reward
        const msg = `📌 Task clan selesai! Clan dapat +${t.reward} poin.`
        c.clanTasks = { description: `Reach level ${t.target + 2}`, progress: c.level, target: t.target + 2, reward: t.reward + 300 }
        return msg
    }
    return ''
}

const cgNewClan = (s, name, owner) => {
    const id = clanShortId(name, s.clans)
    const c = cgNorm({
        id, name, emblem: CLAN_EMBLEMS[Math.floor(Math.random() * CLAN_EMBLEMS.length)],
        leader: owner, members: [owner], exp: 0, level: 1, wins: 0, losses: 0,
        createdAt: new Date().toISOString(), description: 'Belum ada deskripsi', isOpen: true,
        points: 0, warLimit: 5, currentWarCount: 0, joinRequests: []
    })
    cgSetMissions(c)
    s.clans[id] = c
    cgSetClanId(owner, id)
    return c
}

export async function clanGameRun(A, sub) {
    const { m, reply, sender, prefix, isOwner, isAdmins, Bot } = A
    const P = prefix || '.'
    const say = (t) => reply(t)
    if (!m.isGroup) return say('❌ Perintah clan hanya bisa digunakan di grup.')
    const s = cgStore()
    const text = String(A.text || '').trim()
    const mine = () => cgOfOwner(s, sender)
    const need = (c, what) => c || (say(`❌ Kamu tidak punya clan untuk ${what}. Buat dulu dengan *${P}clan-create <nama>*.`), null)
    const tag = (jid) => `@${String(jid).split('@')[0]}`

    switch (sub) {
        case 'create': {
            if (!text) return say(`Contoh: *${P}clan-create Naga Api*`)
            if (text.length > 20) return say('❌ Nama clan maksimal 20 karakter.')
            if (!/^[a-zA-Z0-9 _-]+$/.test(text)) return say('❌ Nama clan hanya boleh huruf, angka, spasi, _ dan -.')
            if (mine()) return say('❌ Kamu sudah punya clan.')
            if (cgOfMember(s, sender) || database.getUser(sender)?.clanId) return say('❌ Kamu masih tergabung di clan lain. Keluar dulu dengan *' + P + 'clan-leave*.')
            if (cgFind(s, text)) return say('❌ Nama clan itu sudah dipakai.')
            const c = cgNewClan(s, text, sender)
            return say(`*Hore, Clan berhasil dibuat!* 🛡️\n\nClan: *${c.name}* (ID: ${c.id})\nKetua: ${tag(sender)}\n\nUntuk bergabung: *${P}clan-join ${c.name}*`)
        }

        case 'join': {
            if (!text) return say(`Masukkan nama clan yang ingin kamu masuki.\nContoh: *${P}clan-join Naga Api*\nDaftar: *${P}clan-list*`)
            if (cgOfMember(s, sender) || database.getUser(sender)?.clanId) return say('❌ Kamu sudah tergabung di sebuah clan.')
            const c = cgFind(s, text)
            if (!c) return say('❌ Clan yang ingin kamu masuki tidak ditemukan.')
            if (c.members.length >= CG_MAX_MEMBERS) return say('❌ Clan itu sudah penuh.')
            if (c.joinRequests.some(r => r.id === sender)) return say('⏳ Permintaan bergabungmu masih menunggu persetujuan ketua.')
            c.joinRequests.push({ id: sender, chat: m.chat, at: Date.now() })
            return say(`📨 Permintaan bergabung dikirim ke clan *${c.name}*.\nTunggu persetujuan ketua (${tag(c.leader)}).`)
        }

        case 'approve': {
            const parts = A.args
            const last = String(parts[parts.length - 1] || '').toLowerCase()
            const sel = last === 'all' || /^\d+$/.test(last) ? last : ''
            const name = (sel ? parts.slice(0, -1) : parts).join(' ')
            const c = name ? cgFind(s, name) : mine()
            if (!c) return say(name ? '❌ Clan tidak ditemukan.' : `❌ Kamu tidak punya clan. Buat dulu dengan *${P}clan-create <nama>*.`)
            if (c.leader !== sender) return say('❌ Hanya ketua clan yang bisa menyetujui permintaan bergabung.')
            if (!c.joinRequests.length) return say('Tidak ada permintaan bergabung yang menunggu persetujuan.')
            const accept = (r) => {
                if (cgOfMember(s, r.id) || c.members.length >= CG_MAX_MEMBERS) return false
                c.members.push(r.id)
                cgSetClanId(r.id, c.id)
                return true
            }
            if (sel === 'all') {
                const list = c.joinRequests.splice(0)
                const done = list.map(r => ({ r, ok: accept(r) }))
                const note = cgMission(c, 'weekly', done.filter(x => x.ok).length)
                return say(done.map(x => x.ok ? `✅ Permintaan ${tag(x.r.id)} disetujui.` : `⚠️ ${tag(x.r.id)} tidak bisa masuk (sudah di clan lain / clan penuh).`).join('\n') + (note ? `\n\n${note}` : ''))
            }
            if (sel) {
                const i = parseInt(sel, 10) - 1
                if (i < 0 || i >= c.joinRequests.length) return say('❌ Nomor permintaan tidak valid.')
                const [r] = c.joinRequests.splice(i, 1)
                if (!accept(r)) return say(`⚠️ ${tag(r.id)} tidak bisa masuk (sudah di clan lain / clan penuh).`)
                const note = cgMission(c, 'weekly', 1)
                return say(`✅ Permintaan ${tag(r.id)} disetujui.` + (note ? `\n\n${note}` : ''))
            }
            return say(
                `*Daftar Permintaan Bergabung — ${c.name}:*\n` +
                c.joinRequests.map((r, i) => `${i + 1}. ${tag(r.id)}`).join('\n') +
                `\n\nSetujui satu: *${P}clan-approve <nomor>*\nSetujui semua: *${P}clan-approve all*`
            )
        }

        case 'war': {
            const c = need(mine(), 'memulai war')
            if (!c) return
            cgSetMissions(c)
            if (c.currentWarCount >= c.warLimit) return say(`❌ Limit war harian clanmu sudah habis (${c.currentWarCount}/${c.warLimit}).`)
            const foes = Object.values(s.clans).filter(x => x.id !== c.id)
            if (!foes.length) return say('❌ Belum ada clan lain untuk diajak war.')
            const foe = foes[Math.floor(Math.random() * foes.length)]
            cgSetMissions(foe)
            const pa = cgPower(c), pb = cgPower(foe)
            const win = pa >= pb ? c : foe
            const lose = win === c ? foe : c
            const bonus = Math.floor(Math.random() * 3) + 1
            win.level += 1
            win.wins += 1
            lose.losses += 1
            win.warLimit += bonus
            c.currentWarCount += 1
            foe.currentWarCount += 1
            // riwayat war ikut tercatat di riwayat clan lama (.clanwarhistory / .clanraport)
            const hist = ext().legacy.warHistory
            hist.push({ attacker: c.id, defender: foe.id, attackerScore: pa, defenderScore: pb, winner: win.id, endTime: Date.now() })
            if (hist.length > 300) hist.splice(0, hist.length - 300)
            const notes = [cgMission(c, 'daily', 1), cgMission(foe, 'daily', 1), cgCheckTask(win)].filter(Boolean)
            return say(
                `⚔️ *Hasil War*\n\n` +
                `${c.name} (power ${pa}) 🆚 ${foe.name} (power ${pb})\n\n` +
                `🏆 Pemenang: *${win.name}* (Level ${win.level})\n` +
                `💀 Kalah: *${lose.name}* (Level ${lose.level})\n` +
                `Hadiah: limit war *${win.name}* +${bonus}\n\n` +
                `War harian ${c.name}: ${c.currentWarCount}/${c.warLimit}` +
                (notes.length ? `\n\n${notes.join('\n')}` : '')
            )
        }

        case 'list': {
            const list = Object.values(s.clans).sort((a, b) => b.level - a.level || b.members.length - a.members.length)
            if (!list.length) return say(`Belum ada clan. Buat dengan *${P}clan-create <nama>*.`)
            return say(`*Daftar Clan:*\n\n` + list.map((c, i) => {
                cgSetMissions(c)
                return `${i + 1}. ${c.emblem} *${c.name}* (${c.id})\n   Level: ${c.level} | Member: ${c.members.length} | Poin: ${c.points || 0}\n   War harian: ${c.currentWarCount}/${c.warLimit} | W/L: ${c.wins}/${c.losses}`
            }).join('\n\n'))
        }

        case 'leave': {
            const c = cgOfMember(s, sender)
            if (!c) {
                if (database.getUser(sender)?.clanId) { cgSetClanId(sender, null); return say('🧹 Data clanmu yang rusak sudah dibersihkan.') }
                return say('❌ Kamu tidak tergabung di clan mana pun.')
            }
            if (c.leader === sender) return say(`❌ Ketua tidak bisa keluar. Hapus clan dengan *${P}clan-delete*.`)
            c.members = c.members.filter(x => x !== sender)
            cgSetClanId(sender, null)
            return say(`👋 Kamu telah keluar dari clan *${c.name}*.`)
        }

        case 'delete': {
            const c = need(mine(), 'dihapus')
            if (!c) return
            const t = s.current && s.tournaments[s.current]
            if (t && t.participants.includes(c.id) && t.status === 'pending') t.participants = t.participants.filter(k => k !== c.id)
            for (const jid of c.members) cgSetClanId(jid, null)
            delete s.clans[c.id]
            return say(`🗑️ Clan *${c.name}* telah dihapus.`)
        }

        case 'member': {
            const c = text ? cgFind(s, text) : (cgOfMember(s, sender) || null)
            if (!c) return say(text ? '❌ Clan yang kamu cari tidak ditemukan.' : `Sebutkan nama clan: *${P}clan-member <nama>*`)
            return say(`*Anggota Clan ${c.name}* (${c.members.length}):\n\n` + c.members.map((x, i) => `${i + 1}. ${tag(x)}${x === c.leader ? ' 👑' : ''}`).join('\n'))
        }

        case 'missions': {
            const c = need(cgOfMember(s, sender), 'melihat misi')
            if (!c) return
            cgSetMissions(c)
            const { daily, weekly } = c.missions
            return say(
                `*Misi Clan ${c.name}:*\n\n` +
                `📅 Harian: ${daily.description}\nProgres: ${daily.progress}/${daily.target}\nHadiah: ${daily.reward} poin\n\n` +
                `🗓️ Mingguan: ${weekly.description}\nProgres: ${weekly.progress}/${weekly.target}\nHadiah: ${weekly.reward} poin\n\n` +
                `Poin clan: ${c.points || 0}`
            )
        }

        case 'task': {
            const c = need(cgOfMember(s, sender), 'melihat task')
            if (!c) return
            const note = cgCheckTask(c)
            const t = c.clanTasks
            return say(`*Task Clan ${c.name}:*\n\nTask: ${t.description}\nProgres: ${Math.min(t.progress, t.target)}/${t.target}\nHadiah: ${t.reward} poin` + (note ? `\n\n${note}` : ''))
        }

        case 'upgrade': {
            const c = need(mine(), 'di-upgrade')
            if (!c) return
            const next = c.level + 1
            const cost = cgLevelCost[next]
            if (!cost) return say(`✅ Clanmu sudah level maksimal (${CG_MAX_LEVEL}) untuk upgrade manual.`)
            const u = A.botUser()
            if ((Number(u.money) || 0) < cost) return say(`❌ Uang tidak cukup. Butuh *${fmt(cost)}* untuk naik ke level ${next}, kamu punya *${fmt(u.money)}*.`)
            u.money -= cost
            c.level = next
            A.saveBot()
            const note = cgCheckTask(c)
            return say(`⬆️ Clan *${c.name}* naik ke level *${c.level}*!\nBiaya: ${fmt(cost)} | Sisa uang: ${fmt(u.money)}` + (note ? `\n\n${note}` : ''))
        }

        case 'tournament': return cgTournament(A, s, text, { tag, say, P })

        default:
            return say(`*🛡️ CLAN GAME*\n\n• ${P}clan-create <nama>\n• ${P}clan-join <nama>\n• ${P}clan-approve [all|nomor]\n• ${P}clan-war\n• ${P}clan-list\n• ${P}clan-leave\n• ${P}clan-delete\n• ${P}clan-member [nama]\n• ${P}clan-missions\n• ${P}clan-task\n• ${P}clan-upgrade\n• ${P}clan-tournament <create|join|start|status>`)
    }
}

// turnamen antar-clan (sistem gugur). Seluruh bagan disimulasikan saat start, lalu hasilnya diumumkan bertahap.
async function cgTournament(A, s, text, { tag, say, P }) {
    const { m, sender, isOwner, isAdmins, Bot } = A
    const [action = '', ...rest] = text.split(/\s+/)
    const name = rest.join(' ').trim()
    const cur = () => s.current && s.tournaments[s.current]
    const nameOf = (k) => s.clans[k]?.name || k
    const staff = isOwner || isAdmins

    switch (action.toLowerCase()) {
        case 'create': {
            if (!staff) return say('❌ Hanya admin grup / owner bot yang bisa membuat turnamen.')
            if (!name) return say(`Contoh: *${P}clan-tournament create Piala Naga*`)
            if (cur()) return say('❌ Masih ada turnamen yang berjalan. Tunggu sampai selesai.')
            if (s.tournaments[name]) return say('❌ Turnamen dengan nama itu sudah ada.')
            s.tournaments[name] = { name, participants: [], status: 'pending', matches: [], createdAt: Date.now() }
            s.current = name
            return say(`🏆 Turnamen *${name}* berhasil dibuat!\nKetua clan daftar dengan *${P}clan-tournament join*.`)
        }

        case 'join': {
            const t = cur()
            if (!t) return say('❌ Tidak ada turnamen yang sedang dibuka.')
            if (t.status !== 'pending') return say('❌ Turnamen sudah dimulai, pendaftaran ditutup.')
            const c = cgOfOwner(s, sender)
            if (!c) return say('❌ Hanya ketua clan yang bisa mendaftarkan clannya.')
            if (t.participants.includes(c.id)) return say('❌ Clanmu sudah terdaftar di turnamen ini.')
            t.participants.push(c.id)
            return say(`✅ Clan *${c.name}* terdaftar di turnamen *${t.name}*. (${t.participants.length} peserta)`)
        }

        case 'start': {
            if (!staff) return say('❌ Hanya admin grup / owner bot yang bisa memulai turnamen.')
            const t = cur()
            if (!t) return say('❌ Tidak ada turnamen yang sedang dibuka.')
            if (t.status !== 'pending') return say('❌ Turnamen sudah dimulai atau selesai.')
            t.participants = t.participants.filter(k => s.clans[k])
            if (t.participants.length < 2) return say('❌ Minimal 2 clan untuk memulai turnamen.')

            // simulasikan seluruh bagan; peserta ganjil mendapat bye
            let alive = shuffle([...t.participants])
            const lines = []
            let round = 1
            while (alive.length > 1) {
                const next = []
                for (let i = 0; i < alive.length; i += 2) {
                    if (!alive[i + 1]) { next.push(alive[i]); lines.push(`Ronde ${round}: *${nameOf(alive[i])}* lolos otomatis (bye).`); continue }
                    const a = s.clans[alive[i]], b = s.clans[alive[i + 1]]
                    const pa = cgPower(a), pb = cgPower(b)
                    const win = pa === pb ? (Math.random() < 0.5 ? alive[i] : alive[i + 1]) : (pa > pb ? alive[i] : alive[i + 1])
                    t.matches.push({ round, clan1: alive[i], clan2: alive[i + 1], winner: win, status: 'completed' })
                    next.push(win)
                    lines.push(`Ronde ${round}: *${a.name}* 🆚 *${b.name}* → 🏆 *${nameOf(win)}*`)
                }
                alive = next
                round++
            }
            const champ = s.clans[alive[0]]
            champ.points = (champ.points || 0) + 1000
            champ.level += 5
            champ.wins += 1
            cgCheckTask(champ)
            t.status = 'completed'
            t.winner = alive[0]
            s.current = null
            const chat = m.chat
            await say(`🏆 Turnamen *${t.name}* dimulai dengan ${t.participants.length} clan!`)
            ;(async () => {
                for (const l of lines) { await delay(5000); await Bot.sendMessage(chat, { text: l }).catch(() => {}) }
                await delay(5000)
                await Bot.sendMessage(chat, { text: `🎉 Turnamen *${t.name}* selesai!\nJuara: *${champ.name}* — dapat +1000 poin dan naik 5 level (sekarang level ${champ.level}).` }).catch(() => {})
            })()
            return
        }

        case 'status': {
            const t = cur()
            if (!t) return say('❌ Tidak ada turnamen yang sedang dibuka.')
            return say(
                `*Status Turnamen ${t.name}:*\n\nStatus: ${t.status}\nPeserta (${t.participants.length}): ${t.participants.map(nameOf).join(', ') || '-'}`
            )
        }

        default:
            return say(`Perintah turnamen tidak valid. Gunakan: *${P}clan-tournament create <nama> | join | start | status*`)
    }
}

// ───────── uno (dipindah dari script Kaguya) ─────────
// Data per grup tersimpan di database game: game().uno[chat] (lewat readUnoGameData / writeUnoGameData).
// Command: uno, uno-info, uno-join, uno-start, uno-stop, uno-hand, uno-card, uno-play, uno-pass, uno-color
// (uno-draw tetap ada sebagai sub-command: `.uno draw`)
const UNO_COLORS = ['red', 'yellow', 'green', 'blue']
function unoDeck() {
    const deck = []
    UNO_COLORS.forEach(color => {
        for (let v = 1; v <= 12; v++) {
            deck.push({ color, value: String(v) })
            if (v !== 1) deck.push({ color, value: String(v) })
        }
    })
    for (const value of ['wild13', 'wild14']) { deck.push({ color: 'black', value }); deck.push({ color: 'black', value }) }
    return shuffle(deck)
}
const unoOk = (cur, c) => c.color === 'black' || cur.color === c.color || cur.value === c.value
const unoName = (c) => `${c.color} ${c.value}`
const unoImg = (c) => `https://raw.githubusercontent.com/abhisheks008/UNO/main/images/${c.color === 'black' ? '' : c.color}${c.value}.png`
const unoNext = (g) => (g.currentPlayer + g.direction + g.players.length) % g.players.length

export async function unoRun(A, sub) {
    const { m, reply, sender, prefix, isOwner, isAdmins, Bot, botname } = A
    const P = prefix || '.'
    const say = (t) => reply(t)
    if (!m.isGroup) return say('Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const games = readUnoGameData()
    const arg = A.args.join(' ')
    const save = () => writeUnoGameData(games)
    const tag = (jid) => `@${String(jid).split('@')[0]}`

    if (sub === 'info') {
        return say(`
📘 *Aturan & Cara Bermain UNO*

1. Bergabung
   • \`${P}uno\` → buat permainan di grup
   • \`${P}uno-join\` → bergabung
   • \`${P}uno-start\` → mulai (minimal 2 pemain)

2. Ambil kartu
   • \`${P}uno draw\` → ambil kartu dari deck. Kalau ada penalti (+2 / +4), kamu menarik sesuai jumlahnya.

3. Mainkan kartu
   • \`${P}uno-play <nomor_kartu>\` → kartu harus sama warna atau angka dengan kartu di meja, atau pakai kartu hitam.
   • Kartu spesial:
     - \`10\`: pemain berikutnya dilewati
     - \`11\`: arah giliran dibalik
     - \`12\`: pemain berikutnya ambil 2 kartu
     - \`wild13\`: pilih warna baru (\`${P}uno-color <red|yellow|green|blue>\`)
     - \`wild14\`: pilih warna baru + pemain berikutnya ambil 4 kartu (hanya jika tidak ada kartu lain yang cocok)

4. Lewati giliran: \`${P}uno-pass\`
5. Lihat kartu sendiri: \`${P}uno-hand\` (dikirim ke chat pribadi)
6. Lihat gambar kartu: \`${P}uno-card <nomor_kartu>\`
7. Pemenang: pemain pertama yang kartunya habis.
8. Berhenti: \`${P}uno-stop\` (semua pemain setuju, atau admin/owner langsung)
`.trim())
    }

    if (!games[chat]) {
        if (sub !== 'create') return say(`❌ Belum ada permainan UNO di grup ini. Ketik *${P}uno* untuk membuatnya.`)
        games[chat] = {
            players: [], deck: unoDeck(), discardPile: [], currentPlayer: 0, direction: 1, currentCard: null,
            drawStack: 0, stopVotes: [], awaitingColorChoice: false
        }
        save()
        return say(`🃏 Permainan UNO dimulai! Ketik *${P}uno-join* untuk bergabung.\nPanduan: *${P}uno-info*`)
    }

    const g = games[chat]
    if (!Array.isArray(g.stopVotes)) g.stopVotes = []
    const me = () => g.players.find(p => p.id === sender)
    const turn = () => g.players[g.currentPlayer]
    const reshuffle = () => {
        if (!g.deck.length) {
            const keep = g.discardPile.pop()
            g.deck = shuffle(g.discardPile)
            g.discardPile = keep ? [keep] : []
        }
    }
    const take = (p, n) => { for (let i = 0; i < n; i++) { reshuffle(); if (!g.deck.length) break; p.hand.push(g.deck.pop()) } }
    const status = async () => {
        const hands = g.players.map((p, i) => `${i}: ${tag(p.id)} (${p.hand.length} kartu)`).join('\n')
        await Bot.sendMessage(chat, {
            text: `*Permainan UNO*\n\nKartu saat ini: ${unoName(g.currentCard)}\n` +
                (g.drawStack ? `⚠️ Penalti menumpuk: +${g.drawStack} (mainkan +2/+4 atau ketik ${P}uno draw)\n` : '') +
                `Giliran: ${tag(turn().id)}\n\nJumlah kartu pemain:\n${hands}`,
            mentions: g.players.map(p => p.id)
        })
        await Bot.sendMessage(chat, { image: { url: unoImg(g.currentCard) }, caption: `Kartu saat ini: ${unoName(g.currentCard)}` }).catch(() => {})
    }
    const advance = () => { g.currentPlayer = unoNext(g) }
    const started = !!g.currentCard
    if (sub === 'create') return started ? status() : say(`🃏 Permainan UNO sudah dibuat. Ketik *${P}uno-join* untuk bergabung, lalu *${P}uno-start*.`)
    if (['play', 'draw', 'pass', 'color', 'card'].includes(sub) && !started) return say(`Permainan belum dimulai. Ketik *${P}uno-start* setelah minimal 2 pemain bergabung.`)
    if (['play', 'draw', 'pass'].includes(sub) && g.awaitingColorChoice) return say(`Pilih warna dulu dengan *${P}uno-color <red|yellow|green|blue>*.`)

    switch (sub) {
        case 'join': {
            if (me()) return say('Kamu sudah bergabung ke permainan.')
            if (started) return say('Permainan sudah berjalan, tunggu ronde berikutnya.')
            g.players.push({ id: sender, hand: [] })
            save()
            return say(`Kamu berhasil bergabung ke permainan UNO! (${g.players.length} pemain)`)
        }

        case 'start': {
            if (started) return say('Permainan sudah dimulai.')
            if (g.players.length < 2) return say('Minimal 2 pemain dibutuhkan untuk memulai permainan.')
            g.deck = shuffle(g.deck)
            g.players.forEach(p => { p.hand = []; take(p, 7) })
            // kartu pembuka tidak boleh kartu hitam
            let first = g.deck.pop()
            while (first.color === 'black') { g.deck.unshift(first); first = g.deck.pop() }
            g.currentCard = first
            g.discardPile.push(first)
            save()
            return status()
        }

        case 'stop': {
            if (isAdmins || isOwner) { delete games[chat]; save(); return say('Permainan UNO dihentikan oleh admin/owner.') }
            if (!me()) return say('Kamu belum bergabung ke permainan.')
            if (!g.stopVotes.includes(sender)) g.stopVotes.push(sender)
            if (g.stopVotes.length >= g.players.length) { delete games[chat]; save(); return say('Permainan UNO dihentikan dengan persetujuan semua pemain.') }
            save()
            return say(`Permintaan berhenti diterima. Masih dibutuhkan ${g.players.length - g.stopVotes.length} pemain untuk setuju.`)
        }

        case 'hand': {
            const p = me()
            if (!p) return say('Kamu belum bergabung ke permainan.')
            const hand = p.hand.map((c, i) => `${i}: ${unoName(c)}`).join('\n') || '(kosong)'
            try { await Bot.sendMessage(sender, { text: `*Permainan Uno ${botname}*\n\nKartu milikmu:\n${hand}` }) } catch { return say('❌ Gagal mengirim ke chat pribadi. Chat bot dulu, lalu coba lagi.') }
            return say('Kartu kamu sudah dikirim via chat pribadi!')
        }

        case 'card': {
            const p = me()
            if (!p) return say('Kamu belum bergabung ke permainan.')
            const i = parseInt(arg, 10)
            if (isNaN(i) || i < 0 || i >= p.hand.length) return say('Nomor kartu tidak valid.')
            const c = p.hand[i]
            try { await Bot.sendMessage(sender, { image: { url: unoImg(c) }, caption: unoName(c) }) } catch { return say('❌ Gagal mengirim ke chat pribadi. Chat bot dulu, lalu coba lagi.') }
            return say('Gambar kartu sudah dikirim via chat pribadi!')
        }

        case 'draw': {
            const p = turn()
            if (p.id !== sender) return say('Sekarang bukan giliranmu!')
            if (g.drawStack > 0) {
                const n = g.drawStack
                take(p, n)
                g.drawStack = 0
                await say(`Kamu mengambil ${n} kartu karena penalti.`)
            } else {
                take(p, 1)
                const c = p.hand[p.hand.length - 1]
                await say(`Kamu mengambil 1 kartu: ${c ? unoName(c) : '(deck habis)'}`)
            }
            advance()
            save()
            return status()
        }

        case 'play': {
            const p = turn()
            if (p.id !== sender) return say('Sekarang bukan giliranmu!')
            const i = parseInt(arg, 10)
            if (isNaN(i) || i < 0 || i >= p.hand.length) return say('Nomor kartu tidak valid.')
            const c = p.hand[i]
            if (!unoOk(g.currentCard, c)) return say('Kartu itu tidak bisa dimainkan.')
            if (g.drawStack > 0 && !['12', 'wild14'].includes(c.value)) return say(`Ada penalti +${g.drawStack}. Tumpuk dengan kartu +2/+4, atau ketik *${P}uno draw*.`)
            if (c.value === 'wild14' && p.hand.some((x, k) => k !== i && x.color !== 'black' && unoOk(g.currentCard, x))) {
                return say('Kartu Wild +4 hanya bisa dimainkan jika tidak ada kartu lain yang cocok.')
            }
            p.hand.splice(i, 1)
            g.currentCard = c
            g.discardPile.push(c)
            if (p.hand.length === 0) { delete games[chat]; save(); return say(`🎉 Pemain ${tag(sender)} menang!`) }

            if (c.value === '12') g.drawStack += 2
            else if (c.value === 'wild14') { g.drawStack += 4; g.awaitingColorChoice = true }
            else if (c.value === 'wild13') g.awaitingColorChoice = true
            else if (c.value === '11') g.direction *= -1
            else if (c.value === '10') advance() // lewati pemain berikutnya

            if (g.awaitingColorChoice) {
                save()
                return say(`Kamu memainkan kartu wild. Pilih warna dengan *${P}uno-color <red|yellow|green|blue>*.`)
            }
            advance()
            save()
            return status()
        }

        case 'pass': {
            if (turn().id !== sender) return say('Sekarang bukan giliranmu!')
            if (g.drawStack > 0) return say(`Ada penalti +${g.drawStack}. Ketik *${P}uno draw* untuk mengambilnya.`)
            advance()
            save()
            return status()
        }

        case 'color': {
            if (!g.awaitingColorChoice || turn().id !== sender) return say('Tidak ada pilihan warna yang perlu dipilih saat ini.')
            const color = arg.trim().toLowerCase()
            if (!UNO_COLORS.includes(color)) return say('Warna tidak valid. Pilih salah satu: red, yellow, green, blue.')
            g.currentCard = { ...g.currentCard, color }
            g.awaitingColorChoice = false
            advance()
            save()
            return status()
        }

        default:
            return say(`Perintah tidak dikenali. Gunakan *${P}uno-info* untuk melihat panduan.`)
    }
}

// ───────── judi bola (dipindah dari script Kaguya: .judi) ─────────
// Data room di game().judibola[chat]. Taruhan 10 limit per pemain, pemenang (pemilih klub yang menang) dapat 200 limit.
const JB_CLUBS = ['Real Madrid', 'Manchester United', 'Inter Milan', 'Barcelona', 'Liverpool', 'Paris Saint-Germain', 'Chelsea', 'Juventus', 'Borussia Dortmund', 'Atletico Madrid', 'RB Leipzig', 'Porto', 'Arsenal', 'Shakhtar Donetsk', 'Red Bull Salzburg', 'AC Milan', 'Braga', 'PSV Eindhoven', 'Lazio', 'Red Star Belgrade', 'FC Copenhagen']
const JB_STAKE = 10, JB_PRIZE = 200, JB_DELAY = 25000
const jbRooms = () => (game().judibola ||= {})
const jbTimers = new Map()

async function jbFinish(sock, chat) {
    const room = jbRooms()[chat]
    if (!room || room.status !== 'running') return
    const count = { 1: 0, 2: 0 }
    Object.values(room.votes).forEach(v => { if (count[v] !== undefined) count[v]++ })
    const win = count[1] === count[2] ? String(1 + Math.floor(Math.random() * 2)) : (count[1] > count[2] ? '1' : '2')
    const club = room.clubs[win - 1]
    const winners = room.players.filter(p => room.votes[p.id] === win)
    for (const p of winners) { const u = ensureUser({ sender: p.id, pushName: p.name }); u.limit = (Number(u.limit) || 0) + JB_PRIZE }
    delete jbRooms()[chat]
    jbTimers.delete(chat)
    saveSoon()
    try { saveDB(global.db) } catch { }
    await sock.sendMessage(chat, {
        text: `⚽ Pertandingan selesai!\nPemenang: *${club}* (${count[1]} vs ${count[2]} suara)\n\nPemain yang memilih ${club}:\n${winners.map(w => `• ${w.name}`).join('\n')}\n\nSelamat! Masing-masing mendapat *${JB_PRIZE} limit*.`
    }).catch(() => {})
}

export async function judiBolaRun(A) {
    const { m, reply, sender, prefix, isOwner, isAdmins, Bot } = A
    const P = prefix || '.'
    const say = (t) => reply(t)
    if (!m.isGroup) return say('❌ Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const rooms = jbRooms()
    const room = rooms[chat]
    const sub = String(A.args[0] || 'help').toLowerCase()

    // bot sempat restart saat pertandingan berjalan: selesaikan sekarang
    if (room?.status === 'running' && !jbTimers.has(chat)) {
        if (Date.now() >= (room.endAt || 0)) { await jbFinish(Bot, chat); return say('Pertandingan sebelumnya baru saja diselesaikan. Ketik ulang perintahmu.') }
        jbTimers.set(chat, setTimeout(() => jbFinish(Bot, chat), Math.max(1000, room.endAt - Date.now())))
    }

    switch (sub) {
        case 'help': case 'menu':
            return say(
                `*❏ JUDI BOLA⚽*\n\n` +
                `• ${P}judibola create (buat room)\n• ${P}judibola join (ikut, taruhan ${JB_STAKE} limit)\n• ${P}judibola player (daftar pemain)\n` +
                `• ${P}judibola mulai (mulai game)\n• ${P}judibola vote 1/2 (pilih klub)\n• ${P}judibola delete (hapus room, taruhan dikembalikan)\n\n` +
                `Tebak pemenang pertandingan, contoh: 1 Braga vs 2 Lazio.\nMinimal 2 pemain.\n\nTaruhan: ${JB_STAKE} Limit\nHadiah: ${JB_PRIZE} Limit`
            )

        case 'create':
            if (room) return say('Room sudah ada.')
            rooms[chat] = { status: 'open', owner: sender, players: [], clubs: [], votes: {} }
            return say(`Room berhasil dibuat. Pemain sekarang bisa bergabung dengan *${P}judibola join*.`)

        case 'join': {
            if (!room) return say(`Belum ada room. Ketik *${P}judibola create* untuk membuatnya.`)
            if (room.status !== 'open') return say('Game sudah dimulai. Tidak bisa bergabung sekarang.')
            if (room.players.some(p => p.id === sender)) return say('Anda sudah bergabung di room.')
            const u = A.botUser()
            const cost = isOwner ? 0 : JB_STAKE
            if ((Number(u.limit) || 0) < cost) return say(`❌ Limit tidak cukup. Taruhan ${JB_STAKE} limit.`)
            u.limit -= cost
            A.saveBot()
            room.players.push({ id: sender, name: A.pushname, paid: cost })
            return say(`Anda berhasil bergabung. Taruhan ${cost} limit terpasang. (${room.players.length} pemain)`)
        }

        case 'player':
            if (!room) return say(`Belum ada room. Ketik *${P}judibola create* untuk membuatnya.`)
            return say(`Pemain yang bergabung:\n${room.players.map(p => `• ${p.name} (@${p.id.split('@')[0]})`).join('\n') || '(belum ada)'}`)

        case 'mulai': {
            if (!room) return say(`Belum ada room. Ketik *${P}judibola create* untuk membuatnya.`)
            if (room.status !== 'open') return say('Game sudah dimulai.')
            if (room.players.length < 2) return say('Minimal 2 pemain untuk memulai game.')
            room.clubs = shuffle([...JB_CLUBS]).slice(0, 2)
            room.status = 'voting'
            return say(`Game dimulai! Pertandingan: *1 ${room.clubs[0]}* vs *2 ${room.clubs[1]}*.\nSilakan pilih dengan *${P}judibola vote 1* atau *${P}judibola vote 2*.`)
        }

        case 'vote': {
            if (!room) return say(`Belum ada room. Ketik *${P}judibola create* untuk membuatnya.`)
            if (room.status === 'open') return say(`Game belum dimulai. Ketik *${P}judibola mulai*.`)
            if (room.status === 'running') return say('Pertandingan sedang berjalan.')
            const v = String(A.args[1] || '')
            if (!['1', '2'].includes(v)) return say(`Pilihan tidak valid. Gunakan *${P}judibola vote 1* atau *2*.`)
            if (!room.players.some(p => p.id === sender)) return say('Anda belum bergabung dalam room.')
            room.votes[sender] = v
            await say(`Anda memilih klub nomor ${v} (${room.clubs[v - 1]}).`)
            if (Object.keys(room.votes).length === room.players.length) {
                room.status = 'running'
                room.endAt = Date.now() + JB_DELAY * 2
                await say('Semua pemain telah vote. Pertandingan akan segera dimulai...')
                setTimeout(() => Bot.sendMessage(chat, { text: 'Pertandingan telah dimulai. Mohon tunggu sampai pertandingan selesai...' }).catch(() => {}), JB_DELAY)
                jbTimers.set(chat, setTimeout(() => jbFinish(Bot, chat), JB_DELAY * 2))
            }
            return
        }

        case 'delete': {
            if (!room) return say('Belum ada room yang dibuat.')
            if (room.status === 'running') return say('Pertandingan sedang berjalan, tunggu sampai selesai.')
            if (room.owner !== sender && !isAdmins && !isOwner) return say('❌ Hanya pembuat room / admin yang bisa menghapus room.')
            for (const p of room.players) if (p.paid) { const u = ensureUser({ sender: p.id, pushName: p.name }); u.limit = (Number(u.limit) || 0) + p.paid }
            delete rooms[chat]
            A.saveBot()
            return say('Room telah dihapus. Taruhan dikembalikan ke semua pemain.')
        }

        default:
            return say(`Perintah tidak dikenal. Ketik *${P}judibola* untuk melihat daftar perintah.`)
    }
}

// ───────── tebakld: leaderboard tebak-tebakan ─────────
// Skor = jumlah jawaban benar di semua game tebak-tebakan (disimpan di user.gameWins oleh mesin game).
export async function tebakLeaderboardRun(A) {
    const top = Object.entries(rpgStore().users || {})
        .map(([jid, u]) => [jid, Number(u?.gameWins) || 0])
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    if (!top.length) return A.reply('📊 Leaderboard masih kosong.')
    return A.reply('📊 *Leaderboard Tebak-Tebakan*\n\n' + top.map(([jid, n], i) => `${i + 1}. @${jid.split('@')[0]} - ${n} poin`).join('\n'))
}

// ───────── konteks command game ─────────
const mentionsOf = (teks, sender) => String(teks).includes('@')
    ? [...String(teks).matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
    : [sender]

// `Bot` = sock bot, dengan groupMetadata & user.jid yang sudah disesuaikan
function makeBot(sock) {
    const overrides = {
        groupMetadata: async (jid) => {
            const meta = await getMeta(sock, jid).catch(() => null)
            if (!meta) return { id: jid, participants: [] }
            return { ...meta, participants: (meta.participants || []).map(p => ({ ...p, id: p.phoneNumber || p.id })) }
        },
        get user() {
            const u = sock.user || {}
            const jid = u.jid || (sock.decodeJid ? sock.decodeJid(u.id) : String(u.id || '').replace(/:\d+@/, '@'))
            return { ...u, jid }
        }
    }
    return new Proxy(sock, {
        get(target, prop) {
            if (prop in overrides) return overrides[prop]
            const v = Reflect.get(target, prop, target)
            return typeof v === 'function' ? v.bind(target) : v
        }
    })
}

export async function buildContext(sock, m, ctx) {
    const pm = await wrapMessage(sock, m)
    const sender = pm.sender
    const Bot = makeBot(sock)
    const prefix = ctx.prefix || '.'
    const args = String(ctx.text || '').trim().split(/ +/).filter(Boolean)
    const text = args.join(' ')

    // balasan: kutip pesan, mention otomatis dari teks "@nomor"
    const reply = async (teks, extra, more) => {
        const opts = [extra, more].find(v => v && typeof v === 'object' && Array.isArray(v.mentions))
        return sock.sendMessage(m.chat, {
            text: String(teks ?? ''),
            mentions: opts ? opts.mentions : mentionsOf(teks, sender)
        }, { quoted: pm })
    }

    const botname = global.namebot || 'Bot'
    return {
        Bot, m: pm, reply, text, args, sender, prefix, command: ctx.command,
        pushname: m.pushName && m.pushName !== 'Unknown' ? m.pushName : 'No Name',
        isOwner: !!ctx.isOwner,
        isAdmins: !!ctx.isAdmin,
        isBan: false, // user yang di-ban sudah disaring handler.js sebelum plugin jalan
        botname,
        xtele: global.linkSaluran || '',
        kaguya: `${prefix}${ctx.command}`,
        packname: global.stickerPack?.packname || botname,
        author: global.stickerPack?.author || global.ownername || 'Owner',
        XRO: async () => reply(global.mess?.owner || 'Fitur ini khusus owner.'),
        XRG: async () => reply(global.mess?.group || 'Fitur ini khusus grup.'),
        XRB: async () => {},
        XReaction: async () => {
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {})
        },
        // data user bawaan bot (limit, dst) untuk fitur yang memakainya
        botUser: () => ensureUser(pm),
        botStore: rpgStore,
        saveBot: () => { try { saveDB(global.db) } catch {} },
        // tambah EXP ke akun user (data yang sama dengan semua fitur lain) + cek naik level
        giveExp: async (amount) => {
            const u = database.getUser(sender)
            if (!u) return null
            try { return await addExpWithLevelCheck(sock, pm, database, u, Number(amount) || 0) }
            catch { u.exp = (Number(u.exp) || 0) + (Number(amount) || 0); return null }
        },
        // data & helper RPG
        rpgDb, saveRpg, rpgGuildDb, saveGuild, initRpgUser, ensureBankFields, bankCfg, pushLog,
        todayKey, isGuildLeaderOrOfficer, readUnoGameData, writeUnoGameData,
        readGapleGameData, writeGapleGameData,
        fmt, hms, msToTime, pickRandom, randomNumber, shuffle, delay, loadGenshin
    }
}

// ───────── pembungkus command game ─────────
/**
 * Bungkus satu command game/RPG jadi plugin handler ini.
 * @param command  nama command (string / array)
 * @param run      async (A) => ..., A = konteks dari buildContext()
 * @param opts     { tags, desc, owner, premium, group, admin, private }
 */
export function rpgCmd(command, run, opts = {}) {
    const names = [].concat(command).map(String)

    const plugin = async (m, ctx) => {
        if (!ctx.command) return false
        const A = await buildContext(ctx.sock, m, ctx)
        try {
            return await run(A)
        } finally {
            saveSoon() // perubahan data game (rpgDb, market, party, dst) ikut tersimpan ke database
        }
    }

    plugin.command = names
    plugin.tags = [opts.tags || 'rpg']
    plugin.help = names
    plugin.description = opts.desc
    plugin.owner = !!opts.owner
    plugin.premium = !!opts.premium
    plugin.group = !!opts.group
    plugin.admin = !!opts.admin
    plugin.private = !!opts.private
    return plugin
}
