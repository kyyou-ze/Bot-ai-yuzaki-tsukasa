// Helper Termai API (dipakai plugins/ai/termai-*.js)
// Konfigurasi: global.termai di config.js ({ url, key }) atau env TERMAI_KEY.

import axios from 'axios'
import FormData from 'form-data'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'

const CDN_KEY = 'AIzaBj7z2z3xBjsk' // key upload c.termai.cc (bawaan framework asal)

export const cfg = () => {
  const url = (global.termai?.url || 'https://api.termai.cc').replace(/\/+$/, '')
  const key = process.env.TERMAI_KEY || global.termai?.key || ''
  if (!key || key === 'ISI-APIKEY-TERMAI') throw new Error('API key Termai belum diisi. Owner: isi global.termai.key di config.js lalu restart bot.')
  return { url, key }
}

const errMsg = (e) => {
  const d = e?.response?.data
  if (d && typeof d !== 'object') return String(d).slice(0, 200)
  return d?.msg || d?.message || d?.error || e?.message || String(e)
}

// GET/POST ke Termai, kembalikan JSON
export async function tJson(path, { params = {}, data, method } = {}) {
  const { url, key } = cfg()
  try {
    const r = await axios({
      url: url + path,
      method: method || (data === undefined ? 'GET' : 'POST'),
      params: { ...params, key },
      data,
      timeout: 180_000,
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      maxBodyLength: Infinity
    })
    return r.data
  } catch (e) { throw new Error(errMsg(e)) }
}

// GET yang mengembalikan gambar (buffer). Kalau server membalas JSON/teks, lempar error berisi pesannya.
export async function tImage(path, { params = {}, data, method } = {}) {
  const { url, key } = cfg()
  try {
    const r = await axios({
      url: url + path,
      method: method || (data === undefined ? 'GET' : 'POST'),
      params: { ...params, key },
      data,
      responseType: 'arraybuffer',
      timeout: 180_000,
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      maxBodyLength: Infinity
    })
    const buf = Buffer.from(r.data)
    const type = await fileTypeFromBuffer(buf)
    if (!type?.mime?.startsWith('image/')) {
      let msg = ''
      try { const j = JSON.parse(buf.toString('utf8')); msg = j.msg || j.message || j.error || '' } catch {}
      throw new Error(msg || 'Server tidak mengembalikan gambar.')
    }
    return buf
  } catch (e) { throw new Error(errMsg(e)) }
}

// perkecil gambar (lebar maks 1024, jpeg) supaya request ringan
export const minimizeImage = (buf, width = 1024) =>
  sharp(buf, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()

// webp (stiker statis) -> png
export const webpToPng = (buf) => sharp(buf, { failOn: 'none' }).png().toBuffer()

// upload buffer -> URL publik (untuk endpoint yang butuh ?url=)
export async function uploadCdn(buf) {
  const type = await fileTypeFromBuffer(buf)
  const form = new FormData()
  form.append('file', buf, { filename: 'file.' + (type?.ext || 'bin') })
  try {
    const { data } = await axios.post(`https://c.termai.cc/api/upload?key=${CDN_KEY}`, form, { headers: form.getHeaders(), maxBodyLength: Infinity, timeout: 60_000 })
    if (!data?.path) throw new Error('Upload gagal')
    return data.path
  } catch (e) { throw new Error('Upload gambar gagal: ' + errMsg(e)) }
}

// GET yang mengembalikan audio (buffer). Kalau server membalas JSON/teks, lempar error berisi pesannya.
export async function tAudio(path, { params = {} } = {}) {
  const { url, key } = cfg()
  try {
    const r = await axios({
      url: url + path, method: 'GET', params: { ...params, key },
      responseType: 'arraybuffer', timeout: 180_000, maxBodyLength: Infinity
    })
    const buf = Buffer.from(r.data)
    const type = await fileTypeFromBuffer(buf)
    if (!type?.mime?.startsWith('audio/')) {
      let msg = ''
      try { const j = JSON.parse(buf.toString('utf8')); msg = j.msg || j.message || j.error || '' } catch {}
      throw new Error(msg || 'Server tidak mengembalikan audio.')
    }
    return { buffer: buf, mime: type.mime, ext: type.ext }
  } catch (e) { throw new Error(errMsg(e)) }
}

// pesan status yang di-edit terus (progress)
export function statusMsg(sock, m) {
  let key = null
  return async (text) => {
    try {
      if (!key) key = (await sock.sendMessage(m.chat, { text }, { quoted: m }))?.key
      else await sock.sendMessage(m.chat, { text, edit: key })
    } catch {}
  }
}

export const progressBar = (percent, length = 10) => {
  const p = Math.min(100, Math.max(0, parseFloat(percent) || 0))
  const f = Math.round((p / 100) * length)
  return '█'.repeat(f) + '░'.repeat(length - f)
}

// baca Server-Sent Events; onEvent(data) mengembalikan true kalau sudah selesai
export async function sse({ path, params = {}, data, headers = {}, timeout = 600_000 }, onEvent) {
  const { url, key } = cfg()
  const r = await axios({
    url: url + path, method: 'POST', params: { ...params, key }, data, headers,
    responseType: 'stream', timeout, maxBodyLength: Infinity
  }).catch(e => { throw new Error(errMsg(e)) })
  await new Promise((resolve, reject) => {
    let buf = '', done = false
    const finish = (err) => { if (done) return; done = true; r.data.destroy(); err ? reject(err) : resolve() }
    const timer = setTimeout(() => finish(new Error('Timeout menunggu hasil.')), timeout)
    r.data.on('data', async (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n'); buf = lines.pop()
      for (const line of lines) {
        const mm = line.match(/^data: (.+)/)
        if (!mm) continue
        let d; try { d = JSON.parse(mm[1]) } catch { continue }
        try { if (await onEvent(d)) { clearTimeout(timer); return finish() } } catch (e) { clearTimeout(timer); return finish(e) }
      }
    })
    r.data.on('end', () => { clearTimeout(timer); finish() })
    r.data.on('error', (e) => { clearTimeout(timer); finish(e) })
  })
}

// ───────── fitur ─────────
export async function gpt(prompt) {
  const r = await tJson('/api/chat/gpt', { data: { messages: [{ role: 'user', content: String(prompt) }] } })
  return r?.response || r?.result || r?.msg || ''
}

export async function deepseek(prompt) {
  const r = await tJson('/api/chat/deepseek', { data: { messages: [{ role: 'user', content: String(prompt) }] } })
  return r?.response || r?.result || r?.msg || ''
}

export async function bard(query) {
  const r = await tJson('/api/chat/bard', { params: { query } })
  return r?.chatUi || r?.response || r?.msg || ''
}

// edit gambar dengan prompt (lewat Termai)
export const imageEdit = (buf, prompt) => tImage('/api/img2img/edit', { data: { image: buf, prompt } })

// text-to-speech ElevenLabs (lewat Termai) -> { buffer, mime, ext }
export const elevenlabs = (text, { voice = 'bella', speed = 1.0, pitch = 0, format = 'mp3' } = {}) =>
  tAudio('/api/text2speech/elevenlabs', { params: { text, voice, speed: String(speed), pitch: String(pitch), format } })
