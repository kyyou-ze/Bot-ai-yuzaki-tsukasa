'use strict';

const wa = require('../wa');
const llm = require('../llm');
const { fetchWithTimeout, trimWords } = require('../util');

// ---------------- Vision ----------------
class VisionFeature {
  constructor(reTrigger, owner) {
    this.reTrigger = reTrigger;
    this.owner = owner;
  }

  async handle(sock, m, content, caption) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;

    let img = content.imageMessage;
    let quoted = null;
    if (!img) {
      quoted = wa.quotedContent(wa.contextInfoOf(content));
      img = quoted && quoted.imageMessage;
    }
    if (!img) return false;
    if (!this.reTrigger.test(caption || wa.extractText(content))) return false;

    let blob = null;
    try {
      blob = quoted
        ? await wa.downloadQuoted(quoted, chat, sender)
        : await wa.downloadMedia({ key: m.key, message: content });
    } catch (err) {
      console.error('[VISION] download error:', err.message);
    }
    if (!blob) {
      await wa.sendText(chat, 'Maaf, gagal mengunduh gambar 😔', m).catch(() => {});
      return true;
    }

    let prompt = String(caption || wa.extractText(content) || '').trim();
    prompt = prompt.replace(this.reTrigger, '').trim();
    if (!prompt) prompt = 'Tolong jelaskan gambar ini secara ringkas.';

    const system = 'Kamu Tsukasa — analis visual cerdas & hangat. Jawab ringkas, akurat, Bahasa Indonesia.';
    const reply = await llm.askVision(system, prompt, blob, img.mimetype);
    const isOwner = this.owner.isOwner(sender, chat);
    const out = this.owner.decorate(isOwner, reply);
    await wa.sendText(chat, out.text, m, out.mentions).catch(() => {});
    return true;
  }
}

// ---------------- VN (voice note) ----------------
const reMentionVN = /\b(tsukasa|tsukasa-chan|sukasa|tukasa)\b/i;
const reAskVN = /\b(vn|voice\s*note|pesan\s*suara)\b/i;

class VnFeature {
  constructor(reTrigger, owner) {
    this.reTrigger = reTrigger;
    this.owner = owner;
  }

  async handle(sock, m, content, isOwner) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;
    const text = wa.extractText(content);

    let aud = content.audioMessage;
    let quoted = null;
    if (!aud) {
      quoted = wa.quotedContent(wa.contextInfoOf(content));
      aud = quoted && quoted.audioMessage;
      if (aud && !reMentionVN.test(text)) return false;
    }

    if (!aud) {
      if (reMentionVN.test(text) && reAskVN.test(text)) {
        await wa.sendText(
          chat,
          'Kirim/Reply **voice note**-nya ya, nanti Tsukasa transkrip dan jawab ✨',
          m
        ).catch(() => {});
      }
      return false;
    }

    let blob = null;
    try {
      blob = quoted
        ? await wa.downloadQuoted(quoted, chat, sender)
        : await wa.downloadMedia({ key: m.key, message: content });
    } catch (err) {
      console.error('[VN] download error:', err.message);
    }
    if (!blob) {
      await wa.sendText(chat, 'Maaf, gagal mengambil voice note 😔', m).catch(() => {});
      return true;
    }

    const tx = await llm.transcribe(blob, aud.mimetype);
    if (!tx || !tx.trim()) return true;

    // Samakan dengan versi Go: VN yang dikirim langsung selalu dijawab.
    // VN hasil quote hanya diproses bila pengguna menyebut "Tsukasa".
    if (!content.audioMessage && !reMentionVN.test(text)) return true;

    let clean = tx.replace(reMentionVN, '').trim();
    if (!clean) clean = tx;

    const reply = await llm.askText(
      'Perankan "Tsukasa", asisten AI cerdas, hangat, dan ramah. Bahasa Indonesia, ringkas, sopan.',
      clean
    );
    if (!reply || !reply.trim()) {
      await wa.sendText(chat, 'Maaf, aku belum bisa menjawab voice note itu. Coba lagi ya 🙏', m).catch(
        () => {}
      );
      return true;
    }
    const out = this.owner.decorate(isOwner, reply);
    await wa.sendText(chat, out.text, m, out.mentions).catch(() => {});
    return true;
  }
}

// ---------------- TTS (ElevenLabs) ----------------
class TtsFeature {
  constructor(reTrigger) {
    this.reTrigger = reTrigger;
    this.reCmd = /\b(vn|voice\s*note|kirim(?:kan)?\s*vn|ucapkan|bacakan|katakan)\b/i;
    this.key = String(process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || '').trim();
    this.voice = String(process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_VOICE_ID || '').trim();
    this.model = String(process.env.ELEVEN_MODEL_ID || 'eleven_multilingual_v2').trim();
    this.outFmt = String(process.env.ELEVEN_OUTPUT_FORMAT || 'mp3_44100_192').trim();
    this.latency = Math.min(
      4,
      Math.max(0, parseInt(process.env.ELEVEN_OPTIMIZE_LATENCY || '0', 10) || 0)
    );
    this.maxWords = Math.max(1, parseInt(process.env.VN_MAX_WORDS || '80', 10) || 80);
    this.stability = Number(process.env.ELEVEN_STABILITY || '0.45') || 0.45;
    this.similarity = Number(process.env.ELEVEN_SIMILARITY || '0.9') || 0.9;
    this.style = Number(process.env.ELEVEN_STYLE || '0.5') || 0.5;
    this.speakerBoost = String(process.env.ELEVEN_SPEAKER_BOOST || 'true').toLowerCase() !== 'false';
    this.rateHint = String(process.env.ELEVEN_RATE_HINT || 'normal').trim().toLowerCase();
    this.enabled = Boolean(this.key && this.voice);
    if (this.enabled) {
      console.log(
        `[TTS] Enabled voiceID=${this.voice} model=${this.model} fmt=${this.outFmt} latency=${this.latency}`
      );
    }
  }

  applyRateHint(s) {
    const rate = this.rateHint;
    if (rate === 'slow') {
      let out = String(s);
      if (!/[.!?]$/.test(out)) out += '.';
      return out.replace(/,/g, ',  ');
    }
    if (rate === 'fast') {
      return String(s).replace(/…/g, '').replace(/, /g, ' ');
    }
    return s;
  }

  outputMime() {
    const fmt = String(this.outFmt || '').toLowerCase();
    if (fmt.startsWith('ogg') || fmt.startsWith('opus')) return 'audio/ogg';
    if (fmt.startsWith('pcm')) return 'audio/wav';
    return 'audio/mpeg';
  }

  async handle(sock, m, content, text) {
    if (!this.reTrigger.test(text)) return false;
    const after = String(text).replace(this.reTrigger, '').trim();
    if (!after) return false;
    if (!this.reCmd.test(after)) return false;

    const chat = m.key.remoteJid;
    if (!this.enabled) {
      await wa.sendText(
        chat,
        'Fitur VN belum dikonfigurasi. Set **ELEVEN_API_KEY/ELEVENLABS_API_KEY** dan **ELEVEN_VOICE_ID/ELEVENLABS_VOICE_ID** di `.env`, lalu restart bot ✨',
        m
      ).catch(() => {});
      return true;
    }

    let intent = after.replace(this.reCmd, '').trim();
    if (!intent) {
      const q = wa.quotedContent(wa.contextInfoOf(content));
      if (q) intent = wa.extractText(q).trim();
    }
    if (!intent) {
      await wa.sendText(
        chat,
        'Tulis: *tsukasa vn <teks>* atau reply pesan lalu ketik *tsukasa vn* ya ✨',
        m
      ).catch(() => {});
      return true;
    }

    const sys = `Kamu copywriter ramah untuk voice note WhatsApp.\nTulis SATU kalimat (maks ${this.maxWords} kata), alami, hangat, jelas, tidak bertele-tele, langsung ke inti.\nJangan menyebut kata "voice note".`;
    let script = String((await llm.askText(sys, intent)) || '').trim() || intent;
    script = trimWords(script, this.maxWords);
    script = this.applyRateHint(script);

    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        this.voice
      )}?output_format=${encodeURIComponent(this.outFmt)}&optimize_streaming_latency=${this.latency}`;
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: this.outputMime(),
            'xi-api-key': this.key,
          },
          body: JSON.stringify({
            text: script,
            model_id: this.model,
            voice_settings: {
              stability: this.stability,
              similarity_boost: this.similarity,
              style: this.style,
              use_speaker_boost: this.speakerBoost,
            },
          }),
        },
        60000
      );
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error('[TTS] elevenlabs error:', res.status, err.slice(0, 150));
        await wa.sendText(chat, 'TTS gagal. Pastikan kredensial ElevenLabs & voice ID benar.', m).catch(
          () => {}
        );
        return true;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await wa.sendAudio(chat, buf, this.outputMime(), true, m);
    } catch (err) {
      console.error('[TTS] gagal:', err.message);
      await wa.sendText(chat, 'TTS gagal. Coba lagi ya.', m).catch(() => {});
    }
    return true;
  }
}

// ---------------- Image generation ----------------
class ImgGenFeature {
  constructor(cfg) {
    this.reImg = /(tsukasa\s+buatin\s+gambar|!gambar)/i;
    this.keys = [];
    for (const k of [process.env.GEMINI_API_KEY, process.env.GEMINI_IMG_KEYS, ...(cfg.geminiKeys || [])]) {
      if (!k) continue;
      String(k)
        .split(',')
        .forEach((p) => {
          const s = p.trim();
          if (s && !this.keys.includes(s)) this.keys.push(s);
        });
    }
    this.idx = 0;
  }

  extractPrompt(text) {
    return String(text || '').replace(this.reImg, '').trim();
  }

  async callGemini(prompt) {
    const models = [
      'gemini-2.0-flash-preview-image-generation',
      'gemini-2.0-flash-exp-image-generation',
    ];
    for (let a = 0; a < this.keys.length; a++) {
      const key = this.keys[this.idx];
      this.idx = (this.idx + 1) % this.keys.length;
      for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          key
        )}`;
        try {
          const res = await fetchWithTimeout(
            url,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate a high-quality image: ${prompt}` }] }],
                generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
              }),
            },
            90000
          );
          if (!res.ok) {
            const err = await res.text().catch(() => '');
            console.error('[IMGGEN]', model, res.status, err.slice(0, 80));
            continue;
          }
          const json = await res.json();
          const candidates = json.candidates || [];
          for (const c of candidates) {
            const parts = c.content && c.content.parts ? c.content.parts : [];
            for (const p of parts) {
              const inline = p.inlineData || p.inline_data;
              if (inline && inline.data) {
                return Buffer.from(inline.data, 'base64');
              }
            }
          }
        } catch (err) {
          console.error('[IMGGEN] error:', err.message);
        }
      }
    }
    throw new Error('Gagal generate gambar. Semua API key limit atau error.');
  }

  async handle(sock, m, content, text) {
    if (!this.reImg.test(text)) return false;
    const prompt = this.extractPrompt(text);
    const chat = m.key.remoteJid;
    if (!prompt) {
      await wa.sendText(chat, 'Prompt gambar kosong. Contoh: tsukasa buatin gambar kucing lucu', m).catch(
        () => {}
      );
      return true;
    }
    if (this.keys.length === 0) {
      await wa.sendText(chat, 'Fitur buatin gambar belum dikonfigurasi (GEMINI_API_KEY).', m).catch(
        () => {}
      );
      return true;
    }
    this.callGemini(prompt)
      .then((buf) => wa.sendImage(chat, buf, `🎨 Generated: ${prompt}`, m, 'image/jpeg'))
      .catch((err) => wa.sendText(chat, `❌ ${err.message}`, m).catch(() => {}));
    return true;
  }
}

// ---------------- Hijabin ----------------
class HijabinFeature {
  constructor(cfg) {
    this.re = /\b(hijab(in|kan)?|kerudung(i|kan)?|berhijabkan)\b/i;
    this.apiUrl = String(process.env.HIJABIN_API_URL || '').trim();
    this.apiKey = String(process.env.HIJABIN_API_KEY || '').trim();
    this.gemKeys = [];
    for (const k of [process.env.GEMINI_IMG_KEYS, process.env.GEMINI_KEYS, ...(cfg.geminiKeys || [])]) {
      if (!k) continue;
      String(k)
        .split(',')
        .forEach((p) => {
          const s = p.trim();
          if (s && !this.gemKeys.includes(s)) this.gemKeys.push(s);
        });
    }
    this.idx = 0;
  }

  async handle(sock, m, content, text) {
    if (!this.re.test(text)) return false;
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;

    let img = content.imageMessage;
    let quoted = null;
    if (!img) {
      quoted = wa.quotedContent(wa.contextInfoOf(content));
      img = quoted && quoted.imageMessage;
    }
    if (!img) return false;

    const mt = String(img.mimetype || '').toLowerCase();
    if (!/^image\/(jpe?g|png)$/.test(mt)) {
      await wa.sendText(
        chat,
        'Format tidak didukung. Kirim/reply **jpeg/jpg/png** ya ✨',
        m
      ).catch(() => {});
      return true;
    }

    let blob = null;
    try {
      blob = quoted
        ? await wa.downloadQuoted(quoted, chat, sender)
        : await wa.downloadMedia({ key: m.key, message: content });
    } catch (err) {
      console.error('[HIJABIN] download error:', err.message);
    }
    if (!blob) {
      await wa.sendText(chat, 'Gagal mengunduh gambar 😔', m).catch(() => {});
      return true;
    }

    try {
      const out = await this.process(blob, mt);
      await wa.sendImage(chat, out, '*Selamat, gambar sudah berhijab.*', m);
    } catch (err) {
      console.error('[HIJABIN] gagal:', err.message);
      if (err.message === 'NOT_CONFIGURED') {
        await wa.sendText(
          chat,
          'Fitur hijabin belum dikonfigurasi. Set **HIJABIN_API_URL** (dan KEY jika perlu) *atau* **GEMINI_API_KEY/GEMINI_KEYS** di `.env`.',
          m
        ).catch(() => {});
      } else {
        await wa.sendText(chat, 'Gagal memproses hijabin. Coba lagi ya ✨', m).catch(() => {});
      }
    }
    return true;
  }

  async process(blob, mt) {
    if (this.apiUrl) {
      try {
        const b64 = blob.toString('base64');
        const res = await fetchWithTimeout(
          this.apiUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            },
            body: JSON.stringify({ image: `data:${mt};base64,${b64}` }),
          },
          60000
        );
        if (res.ok) {
          const ct = (res.headers.get('content-type') || '').split(';')[0];
          if (ct.startsWith('image/')) return Buffer.from(await res.arrayBuffer());
          const json = await res.json().catch(() => ({}));
          const raw =
            (typeof json.image === 'string' && json.image) ||
            (typeof json.image_base64 === 'string' && json.image_base64) ||
            '';
          if (raw) {
            if (raw.startsWith('data:')) {
              const comma = raw.indexOf(',');
              if (comma >= 0) return Buffer.from(raw.slice(comma + 1), 'base64');
            }
            if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
              try {
                const buf = Buffer.from(raw, 'base64');
                if (buf.length > 0) return buf;
              } catch {
                /* lanjut ke URL */
              }
            }
            const r2 = await fetchWithTimeout(raw, {}, 60000).catch(() => null);
            if (r2 && r2.ok) return Buffer.from(await r2.arrayBuffer());
          }
          if (typeof json.url === 'string' && json.url) {
            const r2 = await fetchWithTimeout(json.url, {}, 60000).catch(() => null);
            if (r2 && r2.ok) return Buffer.from(await r2.arrayBuffer());
          }
        }
      } catch {
        /* coba cara Gemini */
      }
    }

    if (this.gemKeys.length > 0) {
      const models = [
        'gemini-2.0-flash-exp-image-generation',
        'gemini-2.0-flash-preview-image-generation',
      ];
      const prompt =
        'Tambahkan hijab yang menutupi rambut, leher, dan dada dengan sempurna pada wanita dalam gambar ini. Hijab harus natural dan sesuai warna pakaian. Pertahankan ekspresi wajah asli, jangan ada rambut terlihat keluar.';
      const b64 = blob.toString('base64');
      for (let a = 0; a < this.gemKeys.length; a++) {
        const key = this.gemKeys[this.idx];
        this.idx = (this.idx + 1) % this.gemKeys.length;
        for (const model of models) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
              key
            )}`;
            const res = await fetchWithTimeout(
              url,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: prompt },
                        { inlineData: { mimeType: mt, data: b64 } },
                      ],
                    },
                  ],
                  generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
                }),
              },
              90000
            );
            if (!res.ok) continue;
            const json = await res.json();
            const candidates = json.candidates || [];
            for (const c of candidates) {
              const parts = c.content && c.content.parts ? c.content.parts : [];
              for (const p of parts) {
                const inline = p.inlineData || p.inline_data;
                if (inline && inline.data) {
                  return Buffer.from(inline.data, 'base64');
                }
              }
            }
          } catch {
            /* lanjut model/key berikutnya */
          }
        }
      }
      throw new Error('Gagal memproses hijabin');
    }

    throw new Error('NOT_CONFIGURED');
  }
}

module.exports = { VisionFeature, VnFeature, TtsFeature, ImgGenFeature, HijabinFeature };
