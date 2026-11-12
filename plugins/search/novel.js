// ───────── novel (Indowebnovel) ─────────
// Scraper indowebnovel.id dibungkus jadi command bot: cari, lihat daftar chapter,
// baca chapter langsung di chat, lanjut/balik chapter via reply angka atau kata kunci.

import axios from 'axios'
import * as cheerio from 'cheerio'
import { te, getDatabase, wrapPlugin } from '../../lib/engine/plugins.js'

const _novel = (() => {
const pluginConfig = {
    name: "novel",
    alias: ["webnovel", "indowebnovel"],
    category: "search",
    description: "Cari & baca web novel dari Indowebnovel langsung di chat",
    usage: ".novel <judul> / .novel latest",
    example: ".novel shadow slave",
    cooldown: 8,
    energi: 1,
};

const BASE_URL = 'https://indowebnovel.id';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  },
});

const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 menit
const MAX_LIST = 10;        // hasil pencarian / latest yang ditampilkan
const MAX_CHAPTERS = 15;    // chapter terakhir yang ditampilkan per halaman
const CHUNK_SIZE = 3500;    // potongan isi chapter per pesan

// ───────── helper ─────────

function formatUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function cleanSlug(str) {
  if (!str) return '';
  return str
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/^series\//, '')
    .trim();
}

// ───────── scraper inti ─────────

async function getLatest(page = 1) {
  const endpoint = page > 1 ? `/page/${page}/` : '/';
  const { data } = await client.get(endpoint);
  const $ = cheerio.load(data);

  const results = [];
  $('.flexbox3-item').each((_, el) => {
    const item = $(el);
    const title = item.find('.title a').text().trim();
    const seriesUrl = item.find('.title a').attr('href') || '';
    const img = item.find('.flexbox3-thumb img').attr('src') || '';

    const chapters = [];
    item.find('.chapter li').each((__, chEl) => {
      const chA = $(chEl).find('a');
      const chTitle = chA.text().replace(/\s+/g, ' ').trim();
      const chUrl = chA.attr('href') || '';
      const date = $(chEl).find('.date').text().trim();
      if (chUrl) chapters.push({ title: chTitle, url: formatUrl(chUrl), slug: cleanSlug(chUrl), date });
    });

    if (seriesUrl) {
      results.push({
        title,
        url: formatUrl(seriesUrl),
        slug: cleanSlug(seriesUrl),
        thumbnail: formatUrl(img),
        latestChapters: chapters,
      });
    }
  });

  return results;
}

async function searchNovel(query, page = 1) {
  const endpoint = page > 1
    ? `/page/${page}/?s=${encodeURIComponent(query)}`
    : `/?s=${encodeURIComponent(query)}`;
  const { data } = await client.get(endpoint);
  const $ = cheerio.load(data);

  const results = [];
  $('.flexbox2-item').each((_, el) => {
    const item = $(el);
    const title =
      item.find('.flexbox2-title span').first().text().trim() ||
      item.find('a').attr('title')?.trim() ||
      '';
    const seriesUrl = item.find('a').first().attr('href') || '';
    const img = item.find('.flexbox2-thumb img').attr('src') || '';
    const type = item.find('.type').text().trim();
    const rating = item.find('.score').text().replace(/[^\d.]/g, '').trim();
    const synopsis = item.find('.synops p').text().trim();

    const genres = [];
    item.find('.genres a').each((__, g) => {
      const gName = $(g).text().trim();
      if (gName) genres.push(gName);
    });

    if (seriesUrl) {
      results.push({
        title,
        url: formatUrl(seriesUrl),
        slug: cleanSlug(seriesUrl),
        thumbnail: formatUrl(img),
        type,
        rating: rating || null,
        synopsis,
        genres,
      });
    }
  });

  return results;
}

async function getDetail(slugOrUrl) {
  const slug = cleanSlug(slugOrUrl);
  const { data } = await client.get(`/series/${slug}/`);
  const $ = cheerio.load(data);

  const title =
    $('.series-title h2').text().trim() ||
    $('h1.entry-title').text().trim() ||
    $('.series-title').text().trim() ||
    slug;
  const thumbnail = $('.series-thumb img').attr('src') || $('.flexbox-thumb img').attr('src') || '';
  const synopsis = $('.series-synops, .synops').text().trim();

  const metadata = {};
  $('.series-infolist li').each((_, el) => {
    const key = $(el).find('b').text().replace(/[:\s]+/g, ' ').trim().toLowerCase();
    const clone = $(el).clone();
    clone.find('b').remove();
    const val = clone.text().trim();
    if (key && val) metadata[key.replace(/\s+/g, '_')] = val;
  });

  const genres = [];
  $('.series-genres a').each((_, el) => {
    const g = $(el).text().trim();
    if (g) genres.push(g);
  });

  const chapters = [];
  $('ul.series-chapterlists li').each((_, el) => {
    const item = $(el);
    const chA = item.find('a').clone();
    const date = item.find('.date').text().trim();
    chA.find('.date').remove();
    const chTitle = chA.text().replace(/\s+/g, ' ').trim();
    const chUrl = item.find('a').attr('href') || '';
    if (chUrl) chapters.push({ title: chTitle, url: formatUrl(chUrl), slug: cleanSlug(chUrl), date });
  });

  return { title, thumbnail: formatUrl(thumbnail), synopsis, metadata, genres, chapters };
}

async function getChapter(slugOrUrl) {
  const slug = cleanSlug(slugOrUrl);
  const { data } = await client.get(`/${slug}/`);
  const $ = cheerio.load(data);

  const title = ($('h2.title-chapter, h1.entry-title, .title-chapter').first().text() || slug)
    .replace(/\s+/g, ' ')
    .trim();

  const container = $('div.content').first();
  container.find('.ads, script, style, .reader-settings, .title-chapter').remove();

  const paragraphs = [];
  container.find('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) paragraphs.push(text);
  });

  return { title, slug, content: paragraphs.join('\n\n') };
}

// ───────── tampilan ─────────

function listTxt(header, items, mapper) {
  let txt = `${header}\n\n`;
  items.forEach((it, i) => { txt += `*${i + 1}.* ${mapper(it)}\n`; });
  txt += `\n> 💡 Balas dengan *angka* untuk memilih, atau ketik \`batal\` untuk keluar.`;
  return txt;
}

function chapterListTxt(detail) {
  const total = detail.chapters.length;
  const shown = detail.chapters.slice(0, MAX_CHAPTERS);

  let txt = `📖 *${detail.title}*\n\n`;
  if (detail.genres?.length) txt += `🏷️ *Genre:* ${detail.genres.join(', ')}\n`;
  if (detail.metadata?.status) txt += `📌 *Status:* ${detail.metadata.status}\n`;
  txt += `📚 *Total Chapter:* ${total}\n`;
  if (detail.synopsis) txt += `\n_${detail.synopsis.slice(0, 400)}${detail.synopsis.length > 400 ? '...' : ''}_\n`;
  txt += `\n╭─「 📑 Chapter terbaru 」\n`;
  shown.forEach((ch, i) => { txt += `┃ *${i + 1}.* ${ch.title}\n`; });
  txt += `╰────────────\n\n`;
  txt += `> 💡 Balas *angka* untuk baca chapter itu, atau \`batal\` untuk keluar.`;
  return txt;
}

async function sendChapterContent(m, chapter) {
  const header = `📖 *${chapter.title}*\n\n`;
  const full = header + (chapter.content || '_Isi chapter tidak ditemukan (mungkin halaman berbayar / dilindungi)._');

  if (full.length <= CHUNK_SIZE) {
    await m.reply(full);
  } else {
    let rest = full;
    while (rest.length > 0) {
      let cut = rest.slice(0, CHUNK_SIZE);
      if (rest.length > CHUNK_SIZE) {
        const lastBreak = cut.lastIndexOf('\n\n');
        if (lastBreak > CHUNK_SIZE * 0.5) cut = cut.slice(0, lastBreak);
      }
      await m.reply(cut);
      rest = rest.slice(cut.length).trimStart();
      if (rest.length > 0) await new Promise(r => setTimeout(r, 600));
    }
  }

  await m.reply(
    `> 📘 Ketik \`lanjut\` untuk chapter berikutnya, \`balik\` untuk chapter sebelumnya, atau \`batal\` untuk keluar.`
  );
}

// ───────── handler utama ─────────

async function handler(m, { text }) {
  const db = getDatabase();
  const user = db.getUser(m.sender);

  const q = (text || '').trim();

  if (!q) {
    return m.reply(
      `📖 *ɴᴏᴠᴇʟ — ɪɴᴅᴏᴡᴇʙɴᴏᴠᴇʟ*\n\n` +
      `> Cari & baca web novel langsung di chat!\n\n` +
      `╭┈┈⬡「 📘 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
      `┃ • ${m.prefix}novel <judul> — cari novel\n` +
      `┃ • ${m.prefix}novel latest — update terbaru\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> *Contoh:* ${m.prefix}novel shadow slave`
    );
  }

  await m.react('🕕');

  try {
    if (/^latest|terbaru$/i.test(q)) {
      const results = await getLatest(1);
      if (!results.length) {
        await m.react('❌');
        return m.reply('❌ Tidak ada update terbaru saat ini.');
      }
      const sliced = results.slice(0, MAX_LIST);

      user.novel_session = {
        type: 'results',
        mode: 'latest',
        items: sliced.map(r => ({ title: r.title, slug: r.slug })),
        time: Date.now(),
      };
      db.save();

      await m.react('✅');
      return m.reply(listTxt(
        '📖 *UPDATE TERBARU INDOWEBNOVEL*',
        sliced,
        r => `${r.title}${r.latestChapters[0] ? ` — ${r.latestChapters[0].title}` : ''}`
      ));
    }

    const results = await searchNovel(q, 1);
    if (!results.length) {
      await m.react('❌');
      return m.reply(`❌ Novel "${q}" tidak ditemukan. Coba kata kunci lain.`);
    }
    const sliced = results.slice(0, MAX_LIST);

    user.novel_session = {
      type: 'results',
      mode: 'search',
      items: sliced.map(r => ({ title: r.title, slug: r.slug })),
      time: Date.now(),
    };
    db.save();

    await m.react('✅');
    await m.reply(listTxt(
      `📖 *HASIL PENCARIAN: ${q.toUpperCase()}*`,
      sliced,
      r => `${r.title}${r.type ? ` (${r.type})` : ''}${r.rating ? ` ⭐${r.rating}` : ''}`
    ));
  } catch (err) {
    console.error('[Novel] Error:', err.message);
    await m.react('☢');
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

// ───────── handler jawaban (pilih angka / lanjut / balik / batal) ─────────

async function novelAnswerHandler(m, sock) {
  if (!m.body || m.isCommand) return false;

  const db = getDatabase();
  const user = db.getUser(m.sender);
  if (!user || !user.novel_session) return false;

  const session = user.novel_session;
  if (Date.now() - session.time > SESSION_TIMEOUT) {
    delete user.novel_session;
    db.save();
    await m.reply('⏰ Sesi pencarian novel sudah kedaluwarsa. Silakan ulangi perintah.');
    return true;
  }

  const text = m.body.trim().toLowerCase();

  if (text === 'batal' || text === 'cancel') {
    delete user.novel_session;
    db.save();
    await m.reply('🚪 Sesi novel dibatalkan.');
    return true;
  }

  // ── tahap 1: pilih dari daftar hasil pencarian / latest ──
  if (session.type === 'results') {
    const choice = parseInt(text);
    if (isNaN(choice) || choice < 1 || choice > session.items.length) return false;

    const picked = session.items[choice - 1];
    await m.react('🕕');
    try {
      const detail = await getDetail(picked.slug);
      user.novel_session = {
        type: 'chapters',
        seriesTitle: detail.title,
        chapters: detail.chapters, // urutan sesuai web (biasanya terbaru dulu)
        time: Date.now(),
      };
      db.save();

      await m.react('✅');
      await m.reply(chapterListTxt(detail));
    } catch (err) {
      console.error('[Novel] Detail error:', err.message);
      await m.react('☢');
      await m.reply('❌ Gagal mengambil detail novel. Coba lagi nanti.');
    }
    return true;
  }

  // ── tahap 2: pilih chapter dari daftar ──
  if (session.type === 'chapters') {
    const choice = parseInt(text);
    if (isNaN(choice) || choice < 1 || choice > Math.min(session.chapters.length, MAX_CHAPTERS)) return false;

    const index = choice - 1; // index di array chapters (0 = terbaru biasanya)
    await m.react('🕕');
    try {
      const target = session.chapters[index];
      const chapter = await getChapter(target.slug);

      user.novel_session = {
        type: 'reading',
        seriesTitle: session.seriesTitle,
        chapters: session.chapters,
        index,
        time: Date.now(),
      };
      db.save();

      await m.react('✅');
      await sendChapterContent(m, chapter);
    } catch (err) {
      console.error('[Novel] Chapter error:', err.message);
      await m.react('☢');
      await m.reply('❌ Gagal mengambil isi chapter. Coba lagi nanti.');
    }
    return true;
  }

  // ── tahap 3: sedang membaca -> lanjut / balik chapter ──
  if (session.type === 'reading') {
    const isNext = /^(lanjut|next|lanjutkan)$/i.test(text);
    const isPrev = /^(balik|back|sebelumnya|prev)$/i.test(text);
    if (!isNext && !isPrev) return false;

    // chapters[0] = terbaru -> "lanjut" (maju cerita) = index berkurang, "balik" = index bertambah
    const newIndex = isNext ? session.index - 1 : session.index + 1;
    if (newIndex < 0 || newIndex >= session.chapters.length) {
      await m.reply(isNext ? '📘 Sudah di chapter paling baru.' : '📘 Sudah di chapter paling awal yang tersedia.');
      return true;
    }

    await m.react('🕕');
    try {
      const target = session.chapters[newIndex];
      const chapter = await getChapter(target.slug);

      session.index = newIndex;
      session.time = Date.now();
      user.novel_session = session;
      db.save();

      await m.react('✅');
      await sendChapterContent(m, chapter);
    } catch (err) {
      console.error('[Novel] Navigasi chapter error:', err.message);
      await m.react('☢');
      await m.reply('❌ Gagal mengambil chapter. Coba lagi nanti.');
    }
    return true;
  }

  return false;
}

const __plugin = wrapPlugin(pluginConfig, handler, { answerHandler: novelAnswerHandler })

  return __plugin
})()

export default _novel
