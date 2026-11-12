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

// Catat traffic nomor kosong (nokos) per negara + riwayat nomor/OTP per user.

import { docStore } from '../core/system.js'

// ───────── pencatat traffic nokos per negara (dipakai plugins/gacha-nokos/*) ─────────
// Data disimpan di global.db.nokosTraffic -> database/tools.json
//   countries[key] = { name, req, ok, reg, otp, jamSum, jamN, last, days: { 'YYYY-MM-DD': { req, ok, otp } } }

const store = docStore('nokosTraffic', { countries: {} })
const KEEP_DAYS = 7
const keyOf = (name) => String(name || '').trim().toLowerCase()
const dayOf = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10) // WIB

function bucket(name) {
    const db = store.get()
    if (!db.countries) db.countries = {}
    const k = keyOf(name)
    if (!k) return null
    const c = (db.countries[k] ||= { name: String(name).trim(), req: 0, ok: 0, reg: 0, otp: 0, jamSum: 0, jamN: 0, last: 0, days: {} })
    const d = dayOf()
    const day = (c.days[d] ||= { req: 0, ok: 0, otp: 0 })
    const old = Object.keys(c.days).sort().slice(0, -KEEP_DAYS)
    for (const o of old) delete c.days[o]
    return { c, day }
}

// 1x percobaan minta nomor; ok = server memberi nomor
export function trackRequest(country, ok) {
    const b = bucket(country); if (!b) return
    b.c.req++; b.day.req++
    if (ok) { b.c.ok++; b.day.ok++ }
    b.c.last = Date.now()
    store.save()
}

// hasil cek nomor: terdaftar di WA? + skor anti-jam (opsional)
export function trackNumber(country, { registered = false, jam = null } = {}) {
    const b = bucket(country); if (!b) return
    if (registered) b.c.reg++
    if (typeof jam === 'number') { b.c.jamSum += jam; b.c.jamN++ }
    store.save()
}

// OTP benar-benar masuk ke nomor negara tsb
export function trackOtp(country) {
    const b = bucket(country); if (!b) return
    b.c.otp++; b.day.otp++
    b.c.last = Date.now()
    store.save()
}

export function getHistory(country) {
    const c = store.get().countries?.[keyOf(country)]
    if (!c) return null
    const d = c.days?.[dayOf()] || { req: 0, ok: 0, otp: 0 }
    return {
        name: c.name, req: c.req, ok: c.ok, reg: c.reg, otp: c.otp,
        okRate: c.req ? c.ok / c.req : null,
        otpRate: c.ok ? Math.min(1, c.otp / c.ok) : null,
        regRate: c.ok ? Math.min(1, c.reg / c.ok) : null,
        jam: c.jamN ? Math.round(c.jamSum / c.jamN) : null,
        today: d, last: c.last
    }
}

// skor 0-100 per negara: stok (45) + OTP masuk (30) + sukses dapat nomor (25)
// stock = jumlah nomor di server, maxStock = stok terbesar di semua negara
export function scoreCountry(c, maxStock) {
    const stock = Number(c.count ?? c.available ?? 0) || 0
    const h = getHistory(c.name || c.code)
    const apiOtp = Number(c.otp_count ?? c.otp ?? c.traffic ?? 0) || 0
    const stockPart = maxStock > 0 ? Math.log1p(stock) / Math.log1p(maxStock) : 0
    const otpPart = h?.otpRate ?? (apiOtp > 0 ? Math.min(1, apiOtp / 50) : 0.5)
    const okPart = h?.okRate ?? 0.5
    return Math.round(stockPart * 45 + otpPart * 30 + okPart * 25)
}

export const gradeOf = (score) => score >= 70 ? '🟢 Ramai' : score >= 45 ? '🟡 Sedang' : '🔴 Sepi'

// urutkan negara dari yang paling bagus; stok 0 dibuang
export function rankCountries(countries) {
    const list = (countries || []).filter(c => (c.name || c.code) && (c.count === undefined || Number(c.count) > 0))
    const maxStock = Math.max(0, ...list.map(c => Number(c.count) || 0))
    return list
        .map(c => ({ ...c, name: c.name || c.code, score: scoreCountry(c, maxStock), history: getHistory(c.name || c.code) }))
        .sort((a, b) => b.score - a.score || (b.count || 0) - (a.count || 0))
}

// acak berbobot: negara dengan skor tinggi lebih sering terpilih
export function pickWeighted(countries) {
    const ranked = rankCountries(countries)
    if (!ranked.length) return null
    const weights = ranked.map(c => 1 + (c.score * c.score) / 100)
    let r = Math.random() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < ranked.length; i++) { r -= weights[i]; if (r <= 0) return ranked[i] }
    return ranked[0]
}

export const pickBest = (countries) => rankCountries(countries)[0] || null

// ───────── riwayat nomor & OTP per user (dipakai .nokosriwayat) ─────────
// users[jid] = { list: [{ num, country, at, otp, otpAt }] }  (terbaru di depan)
const userStore = docStore('nokosUser', { users: {} })
const USER_KEEP_ITEMS = 30
const USER_KEEP_MS = 14 * 24 * 3600e3

// user baru saja mendapat nomor
export function trackUserNumber(sender, number, country) {
    const num = String(number || '').replace(/\D/g, '')
    if (!sender || !num) return
    const db = userStore.get()
    if (!db.users) db.users = {}
    const u = (db.users[sender] ||= { list: [] })
    u.list.unshift({ num, country: String(country || '?'), at: Date.now(), otp: false, otpAt: 0 })
    if (u.list.length > USER_KEEP_ITEMS) u.list.length = USER_KEEP_ITEMS
    userStore.save()
}

// OTP masuk ke nomor tertentu -> tandai di riwayat pemilik terbaru nomor itu
export function trackUserOtp(number) {
    const num = String(number || '').replace(/\D/g, '')
    if (!num) return
    let best = null
    for (const u of Object.values(userStore.get().users || {})) {
        for (const it of u.list || []) {
            if (it.num === num && (!best || it.at > best.at)) best = it
        }
    }
    if (best && !best.otp) { best.otp = true; best.otpAt = Date.now(); userStore.save() }
}

export function getUserHistory(sender) {
    const raw = userStore.get().users?.[sender]?.list || []
    const list = raw.filter(x => Date.now() - x.at < USER_KEEP_MS)
    const otp = list.filter(x => x.otp).length
    const byCountry = {}
    for (const x of list) {
        const c = (byCountry[x.country] ||= { n: 0, otp: 0 })
        c.n++
        if (x.otp) c.otp++
    }
    return { list, total: list.length, otp, rate: list.length ? otp / list.length : null, byCountry }
}
