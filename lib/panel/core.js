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

// Inti fitur panel Pterodactyl: API, paket, dan peran penjual.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import axios from 'axios'
import { resolveIds, phoneOf, userOf, digits } from '../core/data.js'


export const ROLES = ['reseller', 'admin', 'pt', 'owner']   // rendah -> tinggi
export const ROLE_LABEL = { reseller: 'Reseller Panel', admin: 'Admin Panel', pt: 'PT Panel', owner: 'Owner Panel' }
const RANK = { reseller: 1, admin: 2, pt: 3, owner: 4, bot: 5 }

// ───────── peran penjual ─────────
function readRoles() {
    const data = (global.db.panelRole ||= {}) // database/tools.json
    for (const r of ROLES) if (!Array.isArray(data[r])) data[r] = []
    return data
}

function writeRoles(data) {
    global.db.panelRole = data // assign ke proxy -> otomatis tersimpan
}

/** Peran tertinggi milik jid. Owner bot -> 'bot'. Mengembalikan null kalau bukan penjual. */
export async function roleOf(sock, jid, isOwner, meta = null) {
    if (isOwner) return 'bot'
    const ids = await resolveIds(sock, jid, meta)
    const data = readRoles()
    for (const r of [...ROLES].reverse()) {
        if (data[r].some(n => ids.includes(String(n)))) return r
    }
    return null
}

export const rankOf = (role) => RANK[role] || 0
export const roleName = (role) => (role === 'bot' ? 'Owner Bot' : ROLE_LABEL[role] || 'Pengguna')
export const listRole = (role) => readRoles()[role] || []

export function addRole(role, number) {
    const data = readRoles()
    const n = digits(number)
    if (data[role].includes(n)) return false
    data[role].push(n)
    writeRoles(data)
    return true
}

export function delRole(role, numbers) {
    const data = readRoles()
    const drop = [].concat(numbers).map(digits)
    const before = data[role].length
    data[role] = data[role].filter(n => !drop.includes(String(n)))
    writeRoles(data)
    return data[role].length !== before
}

/** Nomor telepon (atau ID WhatsApp kalau nomor tidak bisa dibaca) dari satu jid. */
export async function numberOf(sock, jid, meta = null) {
    return (await phoneOf(sock, jid, meta)) || digits(userOf(jid))
}

export const toPN = (number) => `${digits(number)}@s.whatsapp.net`

// ───────── konfigurasi server ─────────
const P = () => global.panel || {}
const bad = (v) => !v || /^ISI_|^-$/.test(String(v).trim())

export function cfg(n = 1) {
    const p = P()
    const s = n === 2 ? '2' : ''
    const c = {
        n,
        domain: String(p['domain' + s] || '').replace(/\/+$/, ''),
        plta: p['plta' + s],
        pltc: p['pltc' + s],
        egg: Number(p['egg' + s] || p.egg || 15),
        nest: Number(p['nest' + s] || p.nest || 5),
        node: Number(p['node' + s] || p.node || 1),
        location: Number(p['location' + s] || p.location || 1),
        docker: p['docker' + s] || p.docker || 'ghcr.io/parkervcp/yolks:nodejs_22'
    }
    c.ready = /^https?:\/\//.test(c.domain) && !bad(c.plta)
    c.readyClient = !bad(c.pltc)
    return c
}

export const notReadyMsg = (n = 1) => {
    const s = n === 2 ? '2' : ''
    return `Server ${n} belum diatur. Isi *global.panel.domain${s}* dan *plta${s}* di config.js lalu restart bot.`
}

// ───────── HTTP ─────────
// kind: 'app' (PLTA) | 'client' (PLTC). Hasil: { ok, status, data, ms }. Error jaringan tidak dilempar.
export async function call(c, kind, method, url, body, query) {
    const t0 = Date.now()
    try {
        const r = await axios({
            method,
            url: c.domain + url,
            data: body,
            params: query,
            timeout: 30000,
            maxRedirects: c.noRedirect ? 0 : 5, // panel milik user: jangan ikuti redirect (cegah dialihkan ke alamat internal)
            validateStatus: () => true,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + (kind === 'client' ? c.pltc : c.plta)
            }
        })
        return { ok: r.status >= 200 && r.status < 300, status: r.status, data: r.data, ms: Date.now() - t0 }
    } catch (e) {
        return { ok: false, status: 0, data: null, ms: Date.now() - t0, netError: e.code === 'ECONNABORTED' ? 'waktu habis (timeout)' : (e.code || e.message) }
    }
}

/** Pesan error dari balasan Pterodactyl, dibuat enak dibaca. */
export function why(r) {
    if (!r) return 'tidak diketahui'
    if (r.netError) return 'tidak bisa terhubung ke panel: ' + r.netError
    const e = r.data?.errors?.[0]
    if (e) return [e.detail || e.code, e.meta?.source_field ? `(kolom: ${e.meta.source_field})` : ''].filter(Boolean).join(' ')
    if (r.status === 401 || r.status === 403) return 'apikey PLTA/PLTC ditolak panel'
    if (r.status === 404) return 'data tidak ditemukan'
    return 'HTTP ' + r.status
}

// ───────── paket ─────────
const plans = () => P().plans || {}
export const planKeys = () => Object.keys(plans()).map(k => String(k).toLowerCase())
export const planTitle = (key) => (/^unli/.test(key) ? 'UNLIMITED' : String(key).toUpperCase())
export const cpuLabel = (v) => (!v ? 'Unlimited' : v + '%')

// 1050 MB / 2070 MB (angka sedikit dilebihkan) tampil sebagai 1 GB / 2 GB
export function mbLabel(v) {
    if (!v) return 'Unlimited'
    if (v < 1000) return v + ' MB'
    const g = v / 1000
    const r = Math.round(g * 2) / 2
    return (Math.abs(g - r) <= 0.15 ? String(r) : g.toFixed(1)) + ' GB'
}

export function planOf(key) {
    const k = String(key).toLowerCase()
    const p = plans()[k]
    return p ? { key: k, ram: Number(p.ram) || 0, disk: Number(p.disk) || 0, cpu: Number(p.cpu) || 0 } : null
}

// ───────── toko ─────────
export function store() {
    const s = P().store || {}
    return {
        name: s.name || `${global.namebot || 'Kaguya'} Panel`,
        web: s.web || '',
        contact: s.contact || '',
        expired: s.expired || '1 bulan',
        garansi: s.garansi || '15 hari',
        email: s.email || 'panel.local',
        terms: Array.isArray(s.terms) ? s.terms : []
    }
}

// ───────── operasi panel ─────────
export const validUser = (u) => /^[A-Za-z0-9][A-Za-z0-9_.-]{1,30}[A-Za-z0-9]$/.test(String(u || ''))
const makePassword = (u) => u + crypto.randomBytes(3).toString('hex').slice(0, 5)

const STARTUP = 'if [[ -d .git ]] && [[ ${AUTO_UPDATE} == "1" ]]; then git pull; fi; ' +
    'if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; ' +
    'if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; ' +
    'if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/${CMD_RUN}'

export async function createUser(c, { username, admin = false, lastName }) {
    const password = makePassword(username)
    const r = await call(c, 'app', 'POST', '/api/application/users', {
        email: `${String(username).toLowerCase()}@${store().email}`,
        username,
        first_name: username,
        last_name: lastName || (admin ? 'Admin' : username),
        language: 'en',
        ...(admin ? { root_admin: true } : {}),
        password
    })
    if (!r.ok) return { ok: false, error: why(r), r }
    return { ok: true, user: r.data.attributes, password, r }
}

export async function createServer(c, { name, userId, plan, description }) {
    const r = await call(c, 'app', 'POST', '/api/application/servers', {
        name,
        description: description || `${store().name} • ${new Date().toISOString().slice(0, 10)}`,
        user: userId,
        egg: c.egg,
        node: c.node,
        docker_image: c.docker,
        startup: STARTUP,
        environment: { INST: 'npm', USER_UPLOAD: '0', AUTO_UPDATE: '0', CMD_RUN: 'npm start' },
        limits: { memory: plan.ram, swap: 0, disk: plan.disk, io: 500, cpu: plan.cpu },
        feature_limits: { databases: 5, backups: 5, allocations: 1 },
        deploy: { locations: [c.location], dedicated_ip: false, port_range: [] }
    })
    if (!r.ok) return { ok: false, error: why(r), r }
    return { ok: true, server: r.data.attributes, r }
}

export const deleteUser = (c, id) => call(c, 'app', 'DELETE', '/api/application/users/' + id)
export const deleteServer = (c, id) => call(c, 'app', 'DELETE', '/api/application/servers/' + id)
export const suspend = (c, id, on = true) => call(c, 'app', 'POST', `/api/application/servers/${id}/${on ? 'suspend' : 'unsuspend'}`)
export const listUsers = (c, page = 1) => call(c, 'app', 'GET', '/api/application/users', null, { page })
export const listServers = (c, page = 1) => call(c, 'app', 'GET', '/api/application/servers', null, { page })

export async function powerState(c, uuid) {
    if (!c.readyClient) return null
    const r = await call(c, 'client', 'GET', `/api/client/servers/${String(uuid).split('-')[0]}/resources`)
    return r.ok ? r.data?.attributes?.current_state || null : null
}

/** Ringkasan untuk dasbor: latensi, jumlah user/server, kapasitas node. */
export async function overview(c) {
    const [u, s, nd] = await Promise.all([
        call(c, 'app', 'GET', '/api/application/users', null, { per_page: 1 }),
        call(c, 'app', 'GET', '/api/application/servers', null, { per_page: 1 }),
        call(c, 'app', 'GET', '/api/application/nodes/' + c.node)
    ])
    const out = {
        online: u.ok,
        ms: u.ms,
        error: u.ok ? null : why(u),
        users: u.ok ? u.data.meta.pagination.count : null,
        servers: s.ok ? s.data.meta.pagination.count : null,
        node: null
    }
    if (nd.ok && nd.data?.attributes) {
        const a = nd.data.attributes
        const al = a.allocated_resources || {}
        out.node = { name: a.name, memory: a.memory, disk: a.disk, memAlloc: al.memory, diskAlloc: al.disk }
    }
    return out
}
