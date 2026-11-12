/**
 * shazam.js — Single-file Node.js ESM Shazam recognizer
 * Zero Shazam packages. Hanya butuh: ffmpeg di PATH.
 *
 * Command: .shazam (reply audio / VN / video)
 */

import { spawn } from 'node:child_process';
import { access, writeFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js';

const SAMPLE_RATE = 16000;
const DEFAULT_WINDOW = 12;
const MIN_WINDOW = 3;
const DATA_URI_PREFIX = 'data:audio/vnd.shazam.sig;base64,';

// ─── ffmpeg helpers ───────────────────────────────────────────────────────────

function ffmpegBin() {
  return process.env.SHAZAM_FFMPEG || 'ffmpeg';
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffmpeg ${code}: ${err.slice(-300)}`));
      else resolve(Buffer.concat(out));
    });
    p.on('error', (e) => reject(new Error(`ffmpeg not found: ${e.message}`)));
  });
}

async function decodePcm(path, offset = 0, duration = DEFAULT_WINDOW) {
  const dur = Math.min(Math.max(duration, MIN_WINDOW), 30);
  const buf = await run(ffmpegBin(), [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(offset),
    '-t', String(dur),
    '-i', path,
    '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE),
    '-acodec', 'pcm_s16le', 'pipe:1',
  ]);
  if (buf.length < SAMPLE_RATE * MIN_WINDOW * 2) {
    throw new Error('audio terlalu pendek setelah decode (≥3 detik)');
  }
  return buf;
}

async function probeDuration(path) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegBin(), ['-hide_banner', '-i', path, '-f', 'null', '-'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve(m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null);
    });
    p.on('error', () => resolve(null));
  });
}

// ─── FFT (radix-2, pure JS) ───────────────────────────────────────────────────

function fftMag(reIn) {
  const n = reIn.length;
  const re = Float64Array.from(reIn);
  const im = new Float64Array(n);

  // bit reverse
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const t = re[i]; re[i] = re[j]; re[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe0 = Math.cos(ang), wIm0 = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0;
      for (let j = 0; j < half; j++) {
        const k = i + j;
        const tRe = uRe * re[k + half] - uIm * im[k + half];
        const tIm = uRe * im[k + half] + uIm * re[k + half];
        re[k + half] = re[k] - tRe;
        im[k + half] = im[k] - tIm;
        re[k] += tRe;
        im[k] += tIm;
        const nRe = uRe * wRe0 - uIm * wIm0;
        uIm = uRe * wIm0 + uIm * wRe0;
        uRe = nRe;
      }
    }
  }

  const mag = new Float64Array((n >> 1) + 1);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

// ─── Signature generator (format sesuai client Shazam) ────────────────────────

const HANNING = (() => {
  const h = new Float64Array(2048);
  for (let i = 0; i < 2048; i++) h[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 2047);
  return h;
})();

class SignatureGenerator {
  constructor() {
    this.reset();
  }

  reset() {
    this.ring = new Float64Array(2048);
    this.ringPos = 0;
    this.numberSamples = 0;
    this.ffts = Array.from({ length: 256 }, () => new Float64Array(1025));
    this.fftPos = 0;
    this.spread = Array.from({ length: 256 }, () => new Float64Array(1025));
    this.spreadPos = 0;
    this.written = 0;
    // band → list of [fftPass, magnitude, correctedBin]
    this.peaks = { 0: [], 1: [], 2: [], 3: [] };
  }

  feed(pcmBuf) {
    const samples = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, pcmBuf.byteLength / 2);
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.ringPos] = samples[i] / 32768;
      this.ringPos = (this.ringPos + 1) % 2048;
      this.numberSamples++;
      if (this.numberSamples % 128 === 0) {
        this.doFft();
        this.doSpread();
        this.written++;
        if (this.written >= 46) this.doPeaks();
      }
    }
  }

  doFft() {
    const re = new Float64Array(2048);
    for (let i = 0; i < 2048; i++) {
      re[i] = this.ring[(this.ringPos + i) % 2048] * HANNING[i];
    }
    this.ffts[this.fftPos] = fftMag(re);
    this.fftPos = (this.fftPos + 1) % 256;
  }

  doSpread() {
    const last = this.ffts[(this.fftPos - 1 + 256) % 256];
    const s = new Float64Array(1025);
    for (let i = 0; i < 1022; i++) s[i] = Math.max(last[i], last[i + 1], last[i + 2]);
    s[1022] = last[1022]; s[1023] = last[1023]; s[1024] = last[1024];

    const p = this.spreadPos;
    this.spread[p] = s;
    for (const off of [1, 3, 6]) {
      const t = (p - off + 256) % 256;
      for (let i = 0; i < 1025; i++) this.spread[t][i] = Math.max(this.spread[t][i], s[i]);
    }
    this.spreadPos = (p + 1) % 256;
  }

  doPeaks() {
    const fft46 = this.ffts[(this.fftPos - 46 + 256) % 256];
    const s49 = this.spread[(this.spreadPos - 49 + 256) % 256];
    const fftNum = this.written - 46;
    const neigh = [-10, -7, -4, -3, 1, 2, 5, 8];
    const otherOffs = [-53, -45, ...range(165, 201, 7), ...range(214, 250, 7)];

    for (let bin = 10; bin < 1015; bin++) {
      const v = fft46[bin];
      if (v < 1 / 64 || v < s49[bin - 1]) continue;

      let maxN = 0;
      for (const o of neigh) {
        const idx = bin + o;
        if (idx >= 0 && idx < 1025) maxN = Math.max(maxN, s49[idx]);
      }
      if (v <= maxN) continue;

      let other = maxN;
      for (const o of otherOffs) {
        other = Math.max(other, this.spread[(this.spreadPos + o + 256) % 256][bin - 1] || 0);
      }
      if (v <= other) continue;

      const mag = Math.log(Math.max(1 / 64, v)) * 1477.3 + 6144;
      const before = Math.log(Math.max(1 / 64, fft46[bin - 1] || 0)) * 1477.3 + 6144;
      const after = Math.log(Math.max(1 / 64, fft46[bin + 1] || 0)) * 1477.3 + 6144;
      const var1 = mag * 2 - before - after;
      if (var1 <= 0) continue;

      const corrected = Math.round(bin * 64 + ((after - before) * 32) / var1) & 0xffff;
      const freq = corrected * (SAMPLE_RATE / 2 / 1024 / 64);

      let band = -1;
      if (freq >= 250 && freq < 520) band = 0;
      else if (freq < 1450) band = 1;
      else if (freq < 3500) band = 2;
      else if (freq <= 5500) band = 3;
      if (band < 0) continue;

      this.peaks[band].push([fftNum, Math.round(mag) & 0xffff, corrected]);
    }
  }

  get sampleMs() {
    return Math.round((this.numberSamples / SAMPLE_RATE) * 1000);
  }

  encodeUri() {
    // binary packing (delta-encoded FFT passes) — format yang dipakai client
    const writeU32 = (n) => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(n >>> 0, 0);
      return [...b];
    };
    const writeI32 = (n) => {
      const b = Buffer.alloc(4);
      b.writeInt32LE(n | 0, 0);
      return [...b];
    };
    const writeI16 = (n) => {
      // force into signed 16-bit range
      let v = (n | 0) & 0xffff;
      if (v >= 0x8000) v -= 0x10000;
      const b = Buffer.alloc(2);
      b.writeInt16LE(v, 0);
      return [...b];
    };

    let contents = [];
    for (const band of [0, 1, 2, 3]) {
      const peaks = this.peaks[band];
      if (!peaks.length) continue;

      let peaksBuf = [];
      let fftPass = 0;
      for (const [fp, mag, bin] of peaks) {
        if (fp < fftPass) continue;
        if (fp - fftPass >= 0xff) {
          peaksBuf.push(0xff, ...writeI32(fp));
          fftPass = fp;
        }
        peaksBuf.push(fp - fftPass);
        peaksBuf.push(...writeI16((mag - 1) & 0xffff));
        peaksBuf.push(...writeI16((bin - 1) & 0xffff));
        fftPass = fp;
      }

      contents.push(...writeI32(0x60030040 + band));
      contents.push(...writeI32(peaksBuf.length));
      contents = contents.concat(peaksBuf);
      const pad = (4 - (peaksBuf.length % 4)) % 4;
      if (pad) contents.push(...Array(pad).fill(0));
    }

    // header
    const header = {
      magic1: 0xcafe2580,
      crc32: 0,
      sizeMinusHeader: contents.length + 8,
      magic2: 0x94119c00,
      shiftedSampleRateId: 3 << 27, // 16 kHz
      numberSamplesPlusDividedSampleRate: Math.round(this.numberSamples + SAMPLE_RATE * 0.24),
      fixedValue: (15 << 19) + 0x40000,
    };

    let buf = [];
    buf.push(...writeU32(header.magic1));
    buf.push(...writeU32(0)); // crc placeholder
    buf.push(...writeU32(header.sizeMinusHeader));
    buf.push(...writeU32(header.magic2));
    buf.push(...writeU32(0), ...writeU32(0), ...writeU32(0));
    buf.push(...writeU32(header.shiftedSampleRateId));
    buf.push(...writeU32(0), ...writeU32(0));
    buf.push(...writeU32(header.numberSamplesPlusDividedSampleRate));
    buf.push(...writeU32(header.fixedValue));

    buf.push(...writeI32(0x40000000));
    buf.push(...writeI32(contents.length + 8));
    buf = buf.concat(contents);

    // CRC-32 of everything after first 8 bytes
    const crc = crc32(buf.slice(8));
    const crcBytes = writeU32(crc);
    buf[4] = crcBytes[0];
    buf[5] = crcBytes[1];
    buf[6] = crcBytes[2];
    buf[7] = crcBytes[3];

    return DATA_URI_PREFIX + Buffer.from(buf).toString('base64');
  }
}

function range(a, b, step = 1) {
  const r = [];
  for (let i = a; i < b; i += step) r.push(i);
  return r;
}

function crc32(arr) {
  let c = ~0;
  for (let i = 0; i < arr.length; i++) {
    c ^= arr[i] & 0xff;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function makeSignature(pcm) {
  const gen = new SignatureGenerator();
  gen.feed(pcm);
  return { uri: gen.encodeUri(), sampleMs: gen.sampleMs };
}

// ─── Shazam API ───────────────────────────────────────────────────────────────

async function tag(uri, sampleMs, opts = {}) {
  const language = opts.language || 'en-US';
  const country = opts.country || 'US';
  const timezone = opts.timezone || 'Asia/Jakarta';
  const lang = language.split('-')[0].toLowerCase();

  const u1 = randomUUID().toUpperCase();
  const u2 = randomUUID().toUpperCase();
  const url =
    `https://amp.shazam.com/discovery/v5/${lang}/${country}/iphone/-/tag/${u1}/${u2}` +
    `?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&video=v0`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shazam-Platform': 'IPHONE',
      'X-Shazam-AppVersion': '14.1.0',
      Accept: '*/*',
      'Accept-Language': language,
      'Content-Type': 'application/json',
      'User-Agent': 'Shazam/3685 CFNetwork/1197 Darwin/20.0.0',
    },
    body: JSON.stringify({
      timezone,
      signature: { uri, samplems: sampleMs },
      timestamp: Date.now(),
      context: {},
      geolocation: {},
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Shazam HTTP ${res.status}: ${t.slice(0, 180)}`);
  }
  return res.json();
}

// ─── Recognize ────────────────────────────────────────────────────────────────

async function recognize(input, opts = {}) {
  const {
    offset = 0,
    duration = DEFAULT_WINDOW,
    language = 'en-US',
    country = 'US',
    timezone = 'Asia/Jakarta',
    windows = 3,
  } = opts;

  let path = input;
  let tmp = null;
  const isUrl = /^https?:\/\//i.test(input);

  try {
    if (isUrl) {
      const res = await fetch(input, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      tmp = join(tmpdir(), `shazam-${Date.now()}.bin`);
      await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
      path = tmp;
    } else {
      await access(input, constants.R_OK);
    }

    const total = await probeDuration(path);
    const attempts = [];
    let result = null;

    const starts = [];
    if (total && total > 3 * duration) {
      starts.push(Math.max(0, total / 2 - duration / 2));
    }
    let cur = offset;
    while (starts.length < windows) {
      if (!starts.includes(cur) && (total == null || cur < total - MIN_WINDOW)) starts.push(cur);
      cur += duration;
      if (total != null && cur >= total) break;
    }
    if (!starts.length) starts.push(0);

    for (const start of starts) {
      try {
        const pcm = await decodePcm(path, start, duration);
        const { uri, sampleMs } = makeSignature(pcm);
        const body = await tag(uri, sampleMs, { language, country, timezone });
        const matched = Array.isArray(body.matches) && body.matches.length > 0;
        attempts.push({
          offset_seconds: +start.toFixed(3),
          duration_seconds: +(sampleMs / 1000).toFixed(3),
          is_matched: matched,
        });
        if (matched) {
          result = body;
          break;
        }
      } catch (e) {
        attempts.push({ offset_seconds: +start.toFixed(3), error: e.message });
      }
    }

    const out = {
      is_matched: !!(result?.matches?.length),
      source: isUrl ? input : path,
      audio: { duration_seconds: total != null ? +total.toFixed(3) : null },
      attempts,
      matches: result?.matches || null,
      track: result?.track || null,
    };

    if (out.track) {
      const t = out.track;
      out.summary = {
        title: t.title || null,
        artist: t.subtitle || null,
        key: t.key || null,
        isrc: t.isrc || null,
        genre: t.genres?.primary || null,
        cover: t.images?.coverarthq || t.images?.coverart || null,
        apple_music:
          t.hub?.options?.[0]?.actions?.find((a) => a.type === 'uri')?.uri ||
          t.hub?.actions?.find((a) => a.type === 'uri')?.uri ||
          null,
        preview:
          t.hub?.actions?.find((a) => a.type === 'uri' && a.uri?.includes('preview'))?.uri || null,
      };
    }
    return out;
  } finally {
    if (tmp) unlink(tmp).catch(() => {});
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const _shazam = (() => {
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || q.mimetype || q.mediaType || '';
  const urlInput = String(text || '').trim().match(/https?:\/\/\S+/i)?.[0];

  if (!urlInput && !/audio|video/.test(mime) && !/audio|video/i.test(String(q.mtype || ''))) {
    return m.reply(`🎵 *Shazam*\n\nReply audio / VN / video dengan *${usedPrefix || '.'}${command}*\natau kirim link: ${usedPrefix || '.'}${command} https://.../lagu.mp3`);
  }

  await m.react('🎧');

  let filePath = null;
  let created = false;
  try {
    let target = urlInput;

    if (!target) {
      const media = typeof q.download === 'function' ? await q.download().catch(() => null) : null;
      if (typeof media === 'string') {
        filePath = media;
      } else if (Buffer.isBuffer(media)) {
        filePath = join(tmpdir(), `shazam-${Date.now()}-${Math.floor(Math.random() * 1e5)}.bin`);
        await writeFile(filePath, media);
        created = true;
      } else {
        await m.react('❌');
        return m.reply('❌ Gagal mengunduh media. Reply audio/VN/video-nya.');
      }
      target = filePath;
    }

    const res = await recognize(target, { language: 'id-ID', country: 'ID' });

    if (!res.is_matched || !res.summary) {
      await m.react('❌');
      return m.reply('❌ Lagu tidak ditemukan. Coba potongan audio yang lebih jelas (min. 3 detik, tanpa banyak noise).');
    }

    const s = res.summary;
    let caption = `🎵 *Shazam*\n\n` +
      `🎼 *Judul:* ${s.title || '-'}\n` +
      `🎤 *Artis:* ${s.artist || '-'}\n` +
      `🎧 *Genre:* ${s.genre || '-'}`;
    if (s.isrc) caption += `\n🔖 *ISRC:* ${s.isrc}`;
    if (s.apple_music) caption += `\n🍎 *Apple Music:* ${s.apple_music}`;
    if (s.preview) caption += `\n▶️ *Preview:* ${s.preview}`;

    if (s.cover) {
      await conn.sendMessage(m.chat, { image: { url: s.cover }, caption }, { quoted: m });
    } else {
      await m.reply(caption);
    }
    await m.react('✅');
  } catch (e) {
    console.log(e);
    await m.react('❌');
    m.reply(`❌ Gagal: ${e?.message || e}`);
  } finally {
    if (created && filePath) unlink(filePath).catch(() => {});
  }
}

handler.help = ['shazam'];
handler.tags = ['tools'];
handler.command = ['shazam'];
handler.limit = true;

const __plugin = wrapClassic(handler)

  return __plugin
})()

_shazam.tags = ['tools']   // kategori menu

// satu command = nama file
export default oneCommand(_shazam, 'shazam')
