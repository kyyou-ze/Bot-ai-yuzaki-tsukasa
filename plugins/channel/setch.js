/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — atur saluran tujuan bawaan + helper bersama plugin channel
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  .setch https://whatsapp.com/channel/0029VaXXXXXXXXXX   |   .setch off   |   .setch
 *
 * File ini juga menjadi helper untuk plugin channel lain (swch, playch, chname, dll),
 * jadi tidak perlu menambah file baru di lib/.
 */

import { saveDB } from '../../lib/core/system.js'

// ───────── helper bersama (di-import plugin channel lain) ─────────
export class ChannelError extends Error {}

// Tautan: https://whatsapp.com/channel/<kode>[/<id pesan>]  |  ID: 1203630xxxxx@newsletter
export function parseRef(input) {
    const s = String(input || '').trim()
    let m = s.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)(?:\/(\d+))?/i)
    if (m) return { type: 'invite', code: m[1], serverId: m[2] || null }
    m = s.match(/^(\d{8,25})@newsletter$/i)
    if (m) return { type: 'jid', jid: `${m[1]}@newsletter` }
    return null
}

// Pastikan Baileys punya fungsinya (kalau tidak, beri pesan jelas, bukan crash)
export function need(sock, ...fns) {
    const missing = fns.filter((f) => typeof sock[f] !== 'function')
    if (missing.length) throw new ChannelError(`Versi Baileys di bot ini belum punya fitur saluran (${missing.join(', ')}). Update paket baileys dulu.`)
}

const textOf = (v) => (v && typeof v === 'object' ? v.text ?? '' : v ?? '')

export function normalize(md) {
    const vm = md.viewer_metadata || {}
    return {
        id: md.id,
        name: String(textOf(md.name) || textOf(md.thread_metadata?.name) || '-'),
        desc: String(textOf(md.description) || textOf(md.thread_metadata?.description) || ''),
        invite: md.invite || md.thread_metadata?.invite || '',
        subs: Number(md.subscribers ?? md.thread_metadata?.subscribers_count ?? 0) || 0,
        verified: /verified/i.test(String(md.verification || md.thread_metadata?.verification || '')),
        created: Number(md.creation_time ?? md.thread_metadata?.creation_time ?? 0) || 0,
        role: String(vm.role || vm.view_role || '').toUpperCase(),
        state: String(md.state?.type ?? md.state ?? '')
    }
}

export async function metadata(sock, ref) {
    need(sock, 'newsletterMetadata')
    const md = ref.type === 'jid' ? await sock.newsletterMetadata('jid', ref.jid) : await sock.newsletterMetadata('invite', ref.code)
    if (!md || !md.id) throw new ChannelError('Saluran tidak ditemukan. Periksa link atau ID-nya.')
    return normalize(md)
}

export const isAdminRole = (role) => role === 'OWNER' || role === 'ADMIN'
export const link = (invite) => (invite ? `https://whatsapp.com/channel/${invite}` : '')

// saluran bawaan disimpan di global.db (ikut tersimpan oleh saveDB)
export const getCurrent = () => global.db?.channelKit?.current || null
export function setCurrent(c) {
    global.db.channelKit ||= {}
    global.db.channelKit.current = c
    try { saveDB(global.db) } catch {}
}

// Kata pertama = link/ID saluran → jadi tujuan; kalau tidak, pakai saluran bawaan (.setch)
export async function pickTarget(sock, rawText, prefix = '.') {
    const raw = String(rawText || '')
    const m = raw.match(/^\s*(\S+)\s*([\s\S]*)$/)
    if (m && parseRef(m[1])) {
        const ref = parseRef(m[1])
        const md = await metadata(sock, ref)
        return { id: md.id, name: md.name, role: md.role, rest: m[2].trim(), serverId: ref.serverId, md }
    }
    const cur = getCurrent()
    if (!cur) throw new ChannelError(`Belum ada saluran tujuan. Atur dulu dengan: ${prefix}setch <link saluran>\n(atau tulis link saluran di awal perintah ini)`)
    return { id: cur.id, name: cur.name, role: cur.role || '', rest: raw.trim(), serverId: null, md: null }
}

// Bot sudah pasti bukan admin? (peran tidak diketahui = coba saja)
export function assertCanPost(t) {
    if (t.role && !isAdminRole(t.role)) throw new ChannelError(`Akun bot hanya "${t.role.toLowerCase()}" di saluran *${t.name}*, bukan admin/pemilik, jadi tidak bisa memposting.\nJadikan nomor bot admin saluran, lalu ulangi .setch.`)
}

export function explain(err) {
    const m = String((err && (err.message || err)) || 'error tidak diketahui')
    if (err instanceof ChannelError) return m
    if (/not-authorized|forbidden|\b40[13]\b|unauthorized/i.test(m)) return 'Akun bot tidak punya izin di saluran ini (harus pemilik/admin saluran).'
    if (/\b404\b|not-found|item-not-found/i.test(m)) return 'Saluran atau pesan tidak ditemukan. Periksa link/ID-nya.'
    if (/time(d)? ?out/i.test(m)) return 'WhatsApp tidak merespons (timeout). Coba lagi sebentar lagi.'
    return m
}

// ───────── perintah .setch ─────────
let handler = async (m, { sock, text, prefix, reply }) => {
    const p = prefix || '.'
    const arg = String(text || '').trim()
    const cur = getCurrent()

    if (!arg) {
        return reply(
            `📌 *SALURAN TUJUAN*\n\n` +
            (cur ? `Nama : ${cur.name}\nID : ${cur.id}\nPeran bot : ${cur.role ? cur.role.toLowerCase() : 'tidak diketahui'}` : 'Belum diatur') +
            `\n\n📖 *CARA PAKAI*\n${p}setch <link saluran>\n${p}setch off  (hapus)\nSetelah itu: ${p}swch, ${p}playch, ${p}chname, dll\n\n💡 Nomor bot harus jadi admin/pemilik saluran supaya bisa memposting.`
        )
    }
    if (['off', 'hapus', 'reset'].includes(arg.toLowerCase())) {
        setCurrent(null)
        return reply('Saluran bawaan dihapus.')
    }

    const ref = parseRef(arg)
    if (!ref) return reply(`Itu bukan link/ID saluran.\nContoh: ${p}setch https://whatsapp.com/channel/0029VaXXXXXXXXXX`)
    try {
        const md = await metadata(sock, ref)
        setCurrent({ id: md.id, name: md.name, role: md.role })
        const warn = md.role && !isAdminRole(md.role) ? `\n⚠️ Akun bot hanya "${md.role.toLowerCase()}" di saluran ini. Jadikan admin dulu supaya bisa memposting.` : ''
        return reply(`✅ Saluran bawaan: *${md.name}*\nPengikut: ${md.subs.toLocaleString('id-ID')}${md.role ? `\nPeran bot: ${md.role.toLowerCase()}` : ''}${warn}`)
    } catch (err) {
        console.log('[CH] setch:', err.message)
        return reply(`❌ ${explain(err)}`)
    }
}

handler.command = ['setch']
handler.help = ['setch <link saluran> | off']
handler.tags = ['channel']
handler.owner = true

export default handler
