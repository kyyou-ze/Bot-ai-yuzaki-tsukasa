/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Tools — ubah website jadi aplikasi Android (APK WebView)
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  .webtoapk https://example.com Toko Saya
 *          .webtoapk https://example.com Toko Saya | com.toko.saya
 *          (reply / kirim gambar bareng command → dipakai sebagai ikon aplikasi)
 *
 * Layanan : webappcreator.amethystlab.org (build di cloud, ±1–5 menit)
 * Butuh   : Node.js 18+ (fetch / FormData / Blob bawaan)
 */

import { reactTo } from '../../lib/core/file.js'

// ════════════════════════════════════════════════════════════
// KONFIGURASI
// ════════════════════════════════════════════════════════════
const BASE_URL = 'https://webappcreator.amethystlab.org'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
const BUILD_TIMEOUT_MS = 300_000     // request build (gradle di cloud 75–180 detik)
const POLL_TIMEOUT_MS = 600_000      // total tunggu kalau build masuk antrian
const POLL_INTERVAL_MS = 5_000
const MAX_APK_BYTES = 100 * 1024 * 1024
const MAX_ICON_BYTES = 5 * 1024 * 1024

// PNG 1x1 sebagai ikon cadangan
const DEFAULT_ICON = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082',
  'hex'
)

const activeChats = new Set()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ════════════════════════════════════════════════════════════
// CLIENT WEBAPPCREATOR
// ════════════════════════════════════════════════════════════
function absUrl(u) {
  return u.startsWith('http') ? u : `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

async function getBuildStatus(projectId) {
  const id = String(projectId).trim()
  const res = await fetch(`${BASE_URL}/api/build-status/${encodeURIComponent(id)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })

  if (res.status === 404) {
    // record antrian bisa sudah kedaluwarsa padahal APK sudah jadi
    try {
      const head = await fetch(`${BASE_URL}/download/${encodeURIComponent(id)}.apk`, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15_000),
      })
      if (head.ok) return { projectId: id, status: 'completed', downloadUrl: `${BASE_URL}/download/${id}.apk` }
    } catch { /* lanjut */ }
    throw new Error(`Build "${id}" tidak ditemukan (HTTP 404)`)
  }
  if (!res.ok) throw new Error(`Gagal cek status build: HTTP ${res.status}`)

  const data = await res.json()
  if (data.status === 'completed') data.downloadUrl = `${BASE_URL}/download/${id}.apk`
  return data
}

async function buildApk({ websiteUrl, appName, packageName, icon, iconName, iconType }) {
  const pkg = packageName || `com.${appName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'web'}.app`

  const form = new FormData()
  form.append('websiteUrl', websiteUrl)
  form.append('appName', appName)
  form.append('packageName', pkg)
  form.append('versionName', '1.0.0')
  form.append('versionCode', '1')
  form.append('icon', new Blob([icon], { type: iconType }), iconName)

  const res = await fetch(`${BASE_URL}/api/build-apk`, {
    method: 'POST',
    headers: { 'User-Agent': UA, Origin: BASE_URL, Referer: `${BASE_URL}/` },
    body: form,
    signal: AbortSignal.timeout(BUILD_TIMEOUT_MS),
  })

  const raw = await res.text()
  let data
  try { data = JSON.parse(raw) } catch { throw new Error(`Server membalas non-JSON: ${raw.slice(0, 120)}`) }
  if (!res.ok) throw new Error(`Build ditolak: ${data.error || raw.slice(0, 120)}`)

  if (!data.projectId && data.downloadUrl) {
    const m = data.downloadUrl.match(/\/download\/([a-zA-Z0-9\-_]+)\.apk/)
    if (m) data.projectId = m[1]
  }
  if (data.downloadUrl) {
    data.downloadUrl = absUrl(data.downloadUrl)
    if (!data.status) data.status = 'completed'
  }
  return { ...data, packageName: pkg }
}

async function waitForBuild(first) {
  if (first.downloadUrl || first.status === 'completed') return first
  if (!first.projectId) throw new Error('Server tidak mengembalikan projectId / link download')

  const t0 = Date.now()
  while (Date.now() - t0 < POLL_TIMEOUT_MS) {
    const st = await getBuildStatus(first.projectId)
    if (st.status === 'completed' || st.downloadUrl) return st
    if (st.status === 'failed' || st.error) throw new Error(`Kompilasi APK gagal: ${st.error || 'unknown'}`)
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`Build kelamaan (>${Math.round(POLL_TIMEOUT_MS / 1000)} detik)`)
}

async function downloadApk(url) {
  const res = await fetch(absUrl(url), {
    headers: { 'User-Agent': UA, Referer: `${BASE_URL}/` },
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok) throw new Error(`Gagal unduh APK: HTTP ${res.status}`)
  const len = Number(res.headers.get('content-length') || 0)
  if (len > MAX_APK_BYTES) throw new Error('APK terlalu besar untuk dikirim (>100MB)')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error('File APK kosong / rusak')
  return buf
}

// ════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════
function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: 'image/png', ext: 'png' }
  if (buf[0] === 0xff && buf[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' }
  return null
}

// "https://x.com Nama App | com.paket.app"
function parseInput(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const [left, pkgPart] = raw.split('|').map((s) => s.trim())
  const m = left.match(/^(\S+)\s+(.+)$/)
  if (!m) return { url: left, name: '', pkg: pkgPart || '' }
  return { url: m[1], name: m[2].trim(), pkg: pkgPart || '' }
}

const normalizeUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

// ════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════
let handler = async (m, { sock, text, prefix, command, reply }) => {
  const p = prefix || '.'
  const cmd = command || 'webtoapk'
  const input = parseInput(text)

  if (!input || !input.url || !input.name) {
    return reply(
      '📱 *WEBSITE KE APK*\n\n' +
      'Ubah website jadi aplikasi Android (WebView).\n\n' +
      '*Cara pakai:*\n' +
      `> ${p}${cmd} <url> <nama aplikasi>\n` +
      `> ${p}${cmd} <url> <nama aplikasi> | <package>\n\n` +
      '*Contoh:*\n' +
      `> ${p}${cmd} https://example.com Toko Saya\n` +
      `> ${p}${cmd} https://example.com Toko Saya | com.toko.saya\n\n` +
      '*Info:*\n' +
      '> Reply / kirim gambar bareng command buat ikon aplikasi (opsional)\n' +
      '> Proses build ±1–5 menit'
    )
  }

  let websiteUrl
  try {
    websiteUrl = new URL(normalizeUrl(input.url)).toString()
  } catch {
    return reply('❌ URL website tidak valid.')
  }

  const appName = input.name.slice(0, 40)
  let packageName = input.pkg || undefined
  if (packageName && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
    return reply('❌ Nama package tidak valid.\n\n> Contoh: com.toko.saya')
  }

  if (activeChats.has(m.chat)) return reply('⏳ Masih ada proses build di chat ini, tunggu selesai dulu ya.')
  activeChats.add(m.chat)
  await reactTo(sock, m, '⏳')

  try {
    // ── ikon: dari gambar yang di-reply / dikirim langsung ──
    let icon = DEFAULT_ICON
    let iconInfo = { type: 'image/png', ext: 'png' }
    const imgSrc = (m.quoted?.mtype === 'imageMessage' && m.quoted.download) ? m.quoted
      : (m.mtype === 'imageMessage' && m.download) ? m : null
    if (imgSrc) {
      try {
        const buf = await imgSrc.download()
        const info = sniffImage(buf)
        if (info && buf.length <= MAX_ICON_BYTES) { icon = buf; iconInfo = info }
      } catch { /* pakai ikon default */ }
    }

    await reply(
      `🔨 *Build dimulai*\n\n` +
      `> Nama   : ${appName}\n` +
      `> Website: ${websiteUrl}\n` +
      `> Package: ${packageName || 'otomatis'}\n` +
      `> Ikon   : ${imgSrc && icon !== DEFAULT_ICON ? 'custom' : 'default'}\n\n` +
      'Lagi dikompilasi di server cloud, tunggu 1–5 menit ya...'
    )

    // ── build + tunggu ──
    const first = await buildApk({
      websiteUrl,
      appName,
      packageName,
      icon,
      iconName: `icon.${iconInfo.ext}`,
      iconType: iconInfo.type,
    })
    const done = await waitForBuild(first)

    // ── unduh + kirim ──
    const apk = await downloadApk(done.downloadUrl)
    const safeName = appName.replace(/[\\/:*?"<>|]/g, '').trim() || 'app'

    await sock.sendMessage(m.chat, {
      document: apk,
      mimetype: 'application/vnd.android.package-archive',
      fileName: `${safeName}.apk`,
      caption:
        `✅ *APK berhasil dibuat*\n\n` +
        `> Nama   : ${appName}\n` +
        `> Package: ${first.packageName}\n` +
        `> Ukuran : ${(apk.length / 1024 / 1024).toFixed(2)} MB`,
    }, { quoted: m })

    await reactTo(sock, m, '✅')
  } catch (err) {
    console.error('[WEBTOAPK ERROR]', err)
    await reactTo(sock, m, '❌')
    const msg = err?.name === 'TimeoutError' || /aborted|timeout/i.test(String(err?.message))
      ? 'Server build kelamaan merespons (timeout). Coba lagi nanti.'
      : (err?.message || 'Gagal membuat APK.')
    return reply(`❌ *Gagal membuat APK*\n\n> ${msg}`)
  } finally {
    activeChats.delete(m.chat)
  }
}

handler.command = ['webtoapk', 'web2apk']
handler.help = ['webtoapk <url> <nama app> [| package]']
handler.tags = ['tools']
handler.limit = true

export default handler
