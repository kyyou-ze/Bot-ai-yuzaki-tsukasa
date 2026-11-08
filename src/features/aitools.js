'use strict';

const log = require('../logger');
const wa = require('../wa');
const { UA, fetchWithTimeout } = require('../util');
const { sanitizeMood } = require('./stickerreply');

const ACTION_RE = /\[\[\s*(search|sticker|react|image|remind)\s*:\s*([^\]]*?)\s*\]\]/gi;
const LEFT_TAG_RE = /\[\[\s*[a-z_-]+\s*:[^\]]*\]\]/gi;

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const IMAGE_CUE =
  /\b(gambar|gambar\w*|foto|ilustrasi|lukis|lukisan|image|wallpaper|poster|desain|render|fanart)\b/i;
const REMIND_CUE = /\b(ingat|ingatkan|ingetin|pengingat|remind|reminder)\b/i;
const TIME_RE =
  /^(\d+\s*(s|dtk|detik|m|mnt|menit|j|jam|h|hr|d|hari)\b|besok\b|jam\s*\d)/i;

const MAX_SEARCH_CHARS = 2200;
const MAX_IMAGE_PROMPT = 400;
const MAX_REMIND_CHARS = 300;

function firstGrapheme(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const next = segmenter.segment(text)[Symbol.iterator]().next();
    return next && next.value ? next.value.segment : '';
  } catch {
    return Array.from(text)[0] || '';
  }
}

function toolsPrompt(maxActions, allowSearch) {
  const lines = [
    '## TOOLS',
    'Kamu boleh memakai tools berikut. Tag tool TIDAK boleh terlihat oleh user.',
    '',
    'Aksi setelah balasan (taruh di baris sendiri di AKHIR balasan):',
    '[[sticker:mood]] — kirim 1 sticker dari pack. Mood: lucu, sedih, marah, love, ngantuk, hai, kaget, lain.',
    '[[react:emoji]] — beri reaksi ke pesan user (1 emoji).',
    '[[image:prompt]] — buat gambar AI. HANYA jika user meminta gambar/foto/ilustrasi.',
    '[[remind:waktu teks]] — buat pengingat. HANYA jika user minta diingatkan. Contoh: [[remind:10m minum air]]',
  ];

  if (allowSearch) {
    lines.push(
      '',
      'Pencarian web (untuk info terbaru yang kamu belum yakini):',
      'Balas HANYA dengan satu baris [[search:query]] tanpa teks lain.',
      'Setelah hasil pencarian diberikan, jawab user seperti biasa.'
    );
  } else {
    lines.push('', 'Pencarian sudah dilakukan. Jangan meminta search lagi.');
  }

  lines.push(
    '',
    'Aturan:',
    `- Maksimal ${maxActions} aksi setelah balasan. Cukup satu aksi per jenis.`,
    '- Aksi hanya jika benar-benar membantu, jangan setiap pesan.',
    '- Jangan pernah menulis atau menjelaskan tag tool ke user.',
    '- Jika ragu, jangan memakai aksi.'
  );
  return lines.join('\n');
}

/**
 * Pisahkan teks balasan dari tag aksi. Tag yang tidak dikenal juga dibuang
 * supaya tidak bocor ke chat.
 */
function parseActions(raw, maxActions) {
  const source = String(raw || '');
  const limit = Math.max(1, Math.min(5, Number(maxActions) || 2));
  const actions = [];
  ACTION_RE.lastIndex = 0;
  let match;
  while ((match = ACTION_RE.exec(source)) !== null) {
    if (actions.length >= limit) break;
    const type = String(match[1] || '').toLowerCase();
    const arg = String(match[2] || '').trim();
    if (!arg) continue;
    actions.push({ type, arg });
  }
  const text = source
    .replace(ACTION_RE, '')
    .replace(LEFT_TAG_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, actions };
}

async function wikipediaLookup(query) {
  for (const lang of ['id', 'en']) {
    try {
      const base = `https://${lang}.wikipedia.org`;
      const searchUrl =
        `${base}/w/api.php?action=query&list=search&format=json&srlimit=1&origin=*` +
        `&srsearch=${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(searchUrl, { headers: { 'User-Agent': UA } }, 12000);
      if (!res.ok) continue;
      const json = await res.json();
      const hit =
        json && json.query && Array.isArray(json.query.search) ? json.query.search[0] : null;
      if (!hit || !hit.title) continue;

      const sumUrl = `${base}/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
      const sumRes = await fetchWithTimeout(sumUrl, { headers: { 'User-Agent': UA } }, 12000);
      if (!sumRes.ok) continue;
      const sum = await sumRes.json();
      const extract = String(sum.extract || '').trim();
      if (!extract) continue;
      const page =
        (sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) ||
        `${base}/wiki/${encodeURIComponent(hit.title)}`;
      return `${extract}\nSumber: ${page}`;
    } catch (err) {
      log.warn(`[AITOOLS] wikipedia ${lang} gagal: ${err.message}`);
    }
  }
  return '';
}

class AiToolsFeature {
  constructor(cfg, deps) {
    const conf = cfg || {};
    this.enabled = conf.aiToolsEnabled !== false;
    this.imageEnabled = conf.aiToolsImage !== false;
    this.searchEnabled = conf.aiToolsSearch !== false;
    this.maxActions = Math.max(1, Math.min(5, Number(conf.aiToolsMax) || 2));
    this.stickerReply = (deps && deps.stickerReply) || null;
    this.imggen = (deps && deps.imggen) || null;
    this.groupTools = (deps && deps.groupTools) || null;
  }

  systemPrompt(options) {
    if (!this.enabled) return '';
    const allowSearch = !options || options.allowSearch !== false;
    return toolsPrompt(this.maxActions, allowSearch && this.searchEnabled);
  }

  parse(raw) {
    return parseActions(raw, this.maxActions);
  }

  /** Ambil permintaan search pertama (dipakai router untuk two-phase reply). */
  searchRequest(actions) {
    if (!this.searchEnabled) return null;
    const found = (actions || []).find((a) => a.type === 'search');
    if (!found) return null;
    const query = String(found.arg || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    return query ? { arg: query } : null;
  }

  async searchWeb(query) {
    if (!this.searchEnabled) return '';
    const q = String(query || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (!q) return '';

    const chunks = [];
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
        q
      )}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 15000);
      if (res.ok) {
        const json = await res.json();
        const abstract = String(json.AbstractText || '').trim();
        if (abstract) {
          chunks.push(
            abstract + (json.AbstractURL ? `\nSumber: ${json.AbstractURL}` : '')
          );
        }
        const topics = [];
        const walk = (list) => {
          for (const item of Array.isArray(list) ? list : []) {
            if (!item) continue;
            if (Array.isArray(item.Topics)) walk(item.Topics);
            else if (item.Text) topics.push(item);
          }
        };
        walk(json.RelatedTopics);
        for (const item of topics.slice(0, 4)) {
          const text = String(item.Text || '').trim();
          if (!text) continue;
          chunks.push(`- ${text}${item.FirstURL ? ` (${item.FirstURL})` : ''}`);
        }
      }
    } catch (err) {
      log.warn(`[AITOOLS] duckduckgo gagal: ${err.message}`);
    }

    if (chunks.length === 0) {
      const wiki = await wikipediaLookup(q);
      if (wiki) chunks.push(wiki);
    }

    return chunks.join('\n').slice(0, MAX_SEARCH_CHARS).trim();
  }

  async sendSticker(chat, m, mood) {
    if (!this.stickerReply) return false;
    const rows = await this.stickerReply.moods();
    if (rows.length === 0) return false;
    const wanted = sanitizeMood(mood);
    const target = wanted && rows.some((row) => row.mood === wanted) ? wanted : '';
    return this.stickerReply.sendRandom(chat, m, target);
  }

  async run(chat, m, actions, userText) {
    if (!this.enabled || !Array.isArray(actions) || actions.length === 0) return;
    const text = String(userText || '');
    const seen = new Set();

    for (const action of actions) {
      const type = String(action && action.type ? action.type : '').toLowerCase();
      if (!type || type === 'search' || seen.has(type)) continue;

      try {
        if (type === 'sticker') {
          seen.add(type);
          await this.sendSticker(chat, m, action.arg);
        } else if (type === 'react') {
          seen.add(type);
          const emoji = firstGrapheme(action.arg);
          if (emoji && EMOJI_RE.test(emoji)) {
            await wa.react(chat, m.key, emoji);
          }
        } else if (type === 'image') {
          seen.add(type);
          if (!this.imageEnabled || !this.imggen) continue;
          if (!this.imggen.keys || this.imggen.keys.length === 0) continue;
          if (!IMAGE_CUE.test(text)) continue;
          const prompt = String(action.arg || '').slice(0, MAX_IMAGE_PROMPT).trim();
          if (!prompt) continue;
          // Kirim di background supaya balasan teks tidak tertahan.
          this.imggen
            .callGemini(prompt)
            .then((buf) =>
              wa.sendImage(chat, buf, `🎨 ${prompt.slice(0, 120)}`, m, 'image/jpeg')
            )
            .catch((err) => log.error(`[AITOOLS] image gagal: ${err.message}`));
        } else if (type === 'remind') {
          seen.add(type);
          if (!this.groupTools) continue;
          if (!REMIND_CUE.test(text)) continue;
          const arg = String(action.arg || '').slice(0, MAX_REMIND_CHARS).trim();
          if (!arg || !TIME_RE.test(arg)) continue;
          await this.groupTools.handleReminder(null, m, arg);
        }
      } catch (err) {
        log.error(`[AITOOLS] aksi ${type} gagal: ${err.message}`);
      }
    }
  }
}

module.exports = { AiToolsFeature, parseActions, toolsPrompt };
