// DETEKTOR HASHTAG TIKTOK (ALYA MD)
// Command: tthashtag, detecthashtag, hastag, tthastag
// - <link tiktok> : tampilkan hashtag dari video
// - on [tag...]   : aktifkan deteksi untuk grup ini
// - off           : nonaktifkan deteksi untuk grup ini

import { createRequire } from 'node:module'
import { saveDB } from '../../lib/core/system.js'

const require = createRequire(import.meta.url)
let api = null

function tiktokApi() {
  if (!api) api = require('../../src/tiktokapi.js')
  return api
}

const HASHTAG_RE = /#[\w\u0590-\u05ff]+/g

const tagsOf = (text) => String(text || '').match(HASHTAG_RE) || []

let handler = async (m, { text, command, jid, prefix, reply }) => {
  const p = prefix || '.'
  const cmd = `${p}${command}`
  const body = String(text || '').trim()
  const first = (body.split(/\s+/)[0] || '').toLowerCase()

  // Deteksi dari link TikTok.
  if (/tiktok\.com|https?:\/\//i.test(body)) {
    try {
      await m.react?.('🔍')
    } catch {}
    try {
      const data = await tiktokApi().tikwm(body)
      const caption = data?.title || data?.desc || ''
      const tags = tagsOf(caption)
      const lines = [
        '🏷️ *HASHTAG DETECTOR TIKTOK*',
        '',
        `👤 *Author*: @${data?.author?.unique_id || '-'}`,
        `📝 *Deskripsi*: ${caption || '-'}`,
        '',
        `📌 *Hashtag Terdeteksi* (${tags.length}):`,
      ]
      if (tags.length) lines.push(...tags.map((t) => `👉 ${t}`))
      else lines.push('_(Tidak ditemukan hashtag pada video ini)_')
      return reply(lines.join('\n'))
    } catch (err) {
      return reply(`❌ Gagal mendeteksi hashtag dari link: ${err.message}`)
    }
  }

  const groups = (global.db.groups ||= {})
  const group = (groups[jid] ||= {})

  if (['on', 'enable', 'aktif', 'aktifkan', '1'].includes(first)) {
    const tags = tagsOf(body.slice(first.length))
    group.detectHashtag = true
    group.requiredHashtags = tags
    try {
      saveDB(global.db)
    } catch {}

    const head = `✅ *Pendeteksi Hashtag TikTok Diaktifkan!*\n\n`
    if (tags.length) {
      return reply(
        head +
          `🎯 *Target Hashtag*: ${tags.join(', ')}\n\n` +
          '_Setiap video baru tetap dinotifikasi, bot juga menandai apakah caption memakai hashtag target._'
      )
    }
    return reply(
      head +
        '🌐 *Mode*: Semua Video\n\n' +
        '_Setiap video baru akan diperiksa dan daftar hashtag-nya dicantumkan di notifikasi._'
    )
  }

  if (['off', 'disable', 'nonaktif', 'matikan', '0'].includes(first)) {
    group.detectHashtag = false
    try {
      saveDB(global.db)
    } catch {}
    return reply(
      '❌ *Pendeteksi Hashtag TikTok Dinonaktifkan.*\n\n' +
        '_Notifikasi video baru tetap dikirim tanpa status hashtag._'
    )
  }

  const status = group.detectHashtag ? 'Aktif ✅' : 'Nonaktif ❌'
  const target = group.requiredHashtags?.length
    ? group.requiredHashtags.join(', ')
    : 'Semua Hashtag (tanpa target khusus)'

  return reply(
    [
      '🏷️ *PENGATURAN HASHTAG TIKTOK*',
      '',
      `📊 *Status Grup Ini*: ${status}`,
      `🎯 *Target Hashtag*: ${target}`,
      '',
      '*Cara Penggunaan:*',
      `👉 *${cmd} on*`,
      '   _Aktifkan deteksi hashtag untuk grup ini._',
      '',
      `👉 *${cmd} on #preset #alightmotion*`,
      '   _Aktifkan & tandai kecocokan hashtag target di notifikasi._',
      '',
      `👉 *${cmd} off*`,
      '   _Nonaktifkan deteksi hashtag di grup ini._',
      '',
      `👉 *${cmd} <link tiktok>*`,
      '   _Periksa hashtag dari video TikTok tertentu._',
    ].join('\n')
  )
}

handler.command = ['tthashtag', 'detecthashtag', 'hastag', 'tthastag']
handler.help = ['tthashtag <on|off|link>']
handler.tags = ['group']
handler.group = true
handler.admin = true
handler.description = 'Deteksi dan atur hashtag TikTok untuk notifikasi grup'

export default handler
