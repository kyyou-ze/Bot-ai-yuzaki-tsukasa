'use strict';

/**
 * Bridge plugin Kaguya untuk bot Tsukasa.
 *
 * File plugin Kaguya yang sudah dipindah ke ./plugins dimuat secara lazy
 * (hanya saat command-nya dipakai). Metadata menu dibaca dari source file
 * sekali saja, jadi tidak perlu meng-import 1500 plugin saat startup.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const LIB_DIR = path.join(ROOT, 'lib');

let configured = null;
let runtimePromise = null;
let catalogCache = null;
const moduleCache = new Map();

const CATEGORY_META = {
  anime: { icon: '🍥', label: 'Anime' },
  asisten: { icon: '🧰', label: 'Asisten' },
  audio: { icon: '🎧', label: 'Audio' },
  bajaklaut: { icon: '🏴‍☠️', label: 'Bajak Laut' },
  blackjack: { icon: '🃏', label: 'Blackjack' },
  canvas: { icon: '🎨', label: 'Canvas' },
  catur: { icon: '♟️', label: 'Catur' },
  cek: { icon: '🔎', label: 'Cek' },
  ceme: { icon: '🎴', label: 'Ceme' },
  channel: { icon: '📡', label: 'Channel' },
  clan: { icon: '🛡️', label: 'Clan' },
  convert: { icon: '🔄', label: 'Convert' },
  crypto: { icon: '🪙', label: 'Crypto' },
  dam: { icon: '⚪', label: 'Dam' },
  download: { icon: '📥', label: 'Download' },
  economy: { icon: '💰', label: 'Ekonomi' },
  ephoto: { icon: '🖼️', label: 'Ephoto' },
  esport: { icon: '🏆', label: 'Esport' },
  freefire: { icon: '🔥', label: 'Free Fire' },
  fun: { icon: '🎉', label: 'Fun' },
  game: { icon: '🎮', label: 'Game' },
  gaple: { icon: '🀄', label: 'Gaple' },
  genshin: { icon: '🌌', label: 'Genshin' },
  group: { icon: '👥', label: 'Grup' },
  'honkai-starrail': { icon: '🚄', label: 'Honkai Star Rail' },
  jpm: { icon: '📨', label: 'JPM' },
  kampus: { icon: '🎓', label: 'Kampus' },
  koboy: { icon: '🤠', label: 'Koboy' },
  ludo: { icon: '🎲', label: 'Ludo' },
  mafia: { icon: '🕵️', label: 'Mafia' },
  mafiakota: { icon: '🏙️', label: 'Mafia Kota' },
  main: { icon: '🧩', label: 'Main' },
  menfess: { icon: '💌', label: 'Menfess' },
  minecraft: { icon: '⛏️', label: 'Minecraft' },
  mobilelegends: { icon: '⚔️', label: 'Mobile Legends' },
  monopoli: { icon: '🏦', label: 'Monopoli' },
  ninja: { icon: '🥷', label: 'Ninja' },
  othello: { icon: '⚫', label: 'Othello' },
  owner: { icon: '👑', label: 'Owner' },
  poker: { icon: '♠️', label: 'Poker' },
  primbon: { icon: '🔮', label: 'Primbon' },
  quotes: { icon: '💬', label: 'Quotes' },
  relationship: { icon: '💞', label: 'Relationship' },
  rich: { icon: '✨', label: 'Rich' },
  rpg: { icon: '🗺️', label: 'RPG' },
  search: { icon: '🔍', label: 'Search' },
  'sewa-bot': { icon: '🧾', label: 'Sewa Bot' },
  stalker: { icon: '🕵️', label: 'Stalker' },
  sticker: { icon: '🖼️', label: 'Sticker' },
  store: { icon: '🛒', label: 'Store' },
  tebak: { icon: '❓', label: 'Tebak-tebakan' },
  tools: { icon: '🔧', label: 'Tools' },
  tycoon: { icon: '🏭', label: 'Tycoon' },
  ulartangga: { icon: '🪜', label: 'Ular Tangga' },
  undercover: { icon: '🎭', label: 'Undercover' },
  uno: { icon: '🎴', label: 'UNO' },
  user: { icon: '👤', label: 'User' },
  valorant: { icon: '🎯', label: 'Valorant' },
  'wuwa-wiki': { icon: '📖', label: 'WuWa Wiki' },
  zenless: { icon: '🌆', label: 'Zenless Zone Zero' },
  zombie: { icon: '🧟', label: 'Zombie' },
};

const SMALL_CAPS = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

function smallCaps(value) {
  return String(value || '').replace(/[a-zA-Z]/g, (ch) => SMALL_CAPS[ch.toLowerCase()] || ch);
}

function categoryMeta(key) {
  const meta = CATEGORY_META[key] || {};
  return {
    key,
    icon: meta.icon || '📦',
    label: meta.label || key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

function cleanCommand(value) {
  const cmd = String(value || '').trim().toLowerCase().replace(/^[.\/!]+/, '');
  if (!cmd || cmd.length > 32) return '';
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(cmd)) return '';
  if (['command', 'text', 'string', 'number', 'undefined', 'null'].includes(cmd)) return '';
  return cmd;
}

function quotedList(block) {
  const out = [];
  const re = /['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(String(block || '')))) {
    const cmd = cleanCommand(m[1]);
    if (cmd) out.push(cmd);
  }
  return out;
}

function readCommandMetadata(source, folder) {
  const commands = new Set();
  const help = [];
  let description = '';

  const add = (list) => list.forEach((cmd) => commands.add(cmd));

  for (const m of source.matchAll(/(?:handler|plugin)\.command\s*=\s*(\[[\s\S]{0,900}?\]|'[^']*'|"[^"]*"|`[^`]*`)/g)) {
    add(quotedList(m[1]));
  }
  for (const m of source.matchAll(/oneCommand\s*\([^,]{0,240},\s*['"]([^'"]+)['"]/g)) {
    add([m[1]]);
  }
  for (const m of source.matchAll(/\bcmd\s*\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g)) {
    add([m[1]]);
  }
  for (const m of source.matchAll(/\bcmds\s*:\s*(\[[\s\S]{0,900}?\])/g)) {
    add(quotedList(m[1]));
  }
  // Pola plugin RPG / wrapPlugin dengan pluginConfig.
  const head = source.slice(0, 5000);
  for (const m of head.matchAll(/\bname\s*:\s*['"]([^'"]+)['"]/g)) {
    if (/rpgPlugin|wrapPlugin|pluginConfig|customPrefix/.test(source)) add([m[1]]);
  }
  for (const m of head.matchAll(/\balias\s*:\s*(\[[\s\S]{0,500}?\])/g)) {
    if (/rpgPlugin|wrapPlugin|pluginConfig|customPrefix/.test(source)) add(quotedList(m[1]));
  }

  for (const m of source.matchAll(/(?:handler|plugin)\.help\s*=\s*(\[[\s\S]{0,1200}?\])/g)) {
    const re = /['"`]([^'"`]+)['"`]/g;
    let h;
    while ((h = re.exec(m[1]))) help.push(String(h[1]).trim());
  }
  for (const m of source.matchAll(/\busage\s*:\s*['"]([^'"]+)['"]/g)) help.push(String(m[1]).trim());
  for (const m of source.matchAll(/\bdescription\s*:\s*['"]([^'"]{3,180})['"]/g)) {
    if (!description) description = String(m[1]).trim();
  }
  for (const m of source.matchAll(/(?:handler|plugin)\.description\s*=\s*['"]([^'"]{3,180})['"]/g)) {
    if (!description) description = String(m[1]).trim();
  }

  return {
    commands: [...commands],
    help: [...new Set(help)].slice(0, 8),
    description,
    folder,
    // Plugin pasif (tanpa command) dipanggil untuk pesan biasa, mis. jawaban
    // game, captcha, menfess, autodl. Deteksi cukup dari adanya customPrefix;
    // regex aslinya dibaca dari module saat dispatch agar tidak salah parsing.
    passive: /(?:handler|plugin)\.customPrefix\s*=|customPrefix\s*:/.test(source),
  };
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function buildCatalog() {
  const files = walk(PLUGINS_DIR);
  const categories = new Map();
  const byCommand = new Map();
  const entries = [];
  const passives = [];

  for (const file of files) {
    let source = '';
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(PLUGINS_DIR, file).split(path.sep);
    const folder = rel[0];
    const meta = readCommandMetadata(source, folder);
    if (!meta.commands.length && !meta.passive) continue;

    const entry = {
      file,
      rel: rel.join('/'),
      folder,
      commands: meta.commands,
      help: meta.help,
      description: meta.description,
      passive: meta.passive,
      owner: /\b(?:handler|plugin)\.owner\s*=\s*true|\bisOwner\s*:\s*true/.test(source),
      premium: /\b(?:handler|plugin)\.premium\s*=\s*true|\bisPremium\s*:\s*true/.test(source),
      admin: /\b(?:handler|plugin)\.admin\s*=\s*true|\bisAdmin\s*:\s*true/.test(source),
      group: /\b(?:handler|plugin)\.group\s*=\s*true|\bisGroup\s*:\s*true/.test(source),
      private: /\b(?:handler|plugin)\.private\s*=\s*true|\bisPrivate\s*:\s*true/.test(source),
    };
    entries.push(entry);
    if (entry.passive) passives.push(entry);

    // File yang hanya berisi plugin pasif tidak punya command, jadi tidak
    // dimasukkan ke katalog command/kategori.
    if (!meta.commands.length) continue;

    if (!categories.has(folder)) {
      categories.set(folder, { ...categoryMeta(folder), commands: new Set(), files: 0 });
    }
    const cat = categories.get(folder);
    cat.files += 1;
    for (const cmd of entry.commands) {
      cat.commands.add(cmd);
      const list = byCommand.get(cmd) || [];
      list.push(entry);
      byCommand.set(cmd, list);
    }
  }

  const list = [...categories.values()]
    .map((cat) => ({ ...cat, commands: [...cat.commands].sort(), count: cat.commands.size }))
    .filter((cat) => cat.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));

  return { categories: list, byCommand, entries, passives, scannedAt: Date.now() };
}

function getCatalog() {
  if (!catalogCache) catalogCache = buildCatalog();
  return catalogCache;
}

function setGlobals(cfg) {
  const g = global;
  g.prefix = ['.', '!', '/'];
  g.namebot = (cfg && cfg.botName) || 'Tsukasa';
  g.ownername = g.namebot;
  g.creator = g.namebot;
  g.nameSaluran = g.namebot;
  g.idSaluran = '';
  g.versi = '2.0.0';
  g.owners = [];
  g.mess = {
    wait: 'Tunggu sebentar ya...',
    owner: 'Perintah ini khusus owner.',
    admin: 'Perintah ini khusus admin grup.',
    premium: 'Perintah ini khusus premium.',
    group: 'Perintah ini hanya bisa dipakai di grup.',
    private: 'Perintah ini hanya bisa dipakai di chat pribadi.',
  };
  g.dbEngine = 'json';
  g.hanyaTerdaftar = false;
  g.wajibDaftar = false;
  g.bebasDaftar = [];
  g.public = true;
  g.publicTelegram = true;
  g.pconly = false;
  g.gconly = false;
  g.sewamode = false;
  g.grupbot = false;
  g.botMode = 'all';
  g.buttonMode = false;
  g.replyCardOn = false;
  g.multiplier = 38;
  g.fitur = g.fitur || {};
  g.thumb = g.thumb || {};
  g.prefix = Array.isArray(g.prefix) ? g.prefix : ['.'];
  g.isPublic = () => true;
}

async function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      setGlobals(configured);
      let kaguyaConfig = {};
      try {
        kaguyaConfig = await import(pathToFileURL(path.join(LIB_DIR, 'kaguya-config.js')).href);
      } catch (err) {
        console.error('[KAGUYA] config gagal dimuat:', err && err.message);
      }
      // Identitas tetap milik Tsukasa.
      setGlobals(configured);
      if (kaguyaConfig && kaguyaConfig.default) {
        // no-op, config hanya memasang global
      }

      try {
        const db = await import(pathToFileURL(path.join(LIB_DIR, 'db', 'database.js')).href);
        if (!global.db) db.initDatabase();
      } catch (err) {
        console.error('[KAGUYA] database gagal dimuat:', err && err.message);
        throw err;
      }

      const wa = await import(pathToFileURL(path.join(LIB_DIR, 'platform', 'wa.js')).href);
      const engine = await import(pathToFileURL(path.join(LIB_DIR, 'engine', 'plugins.js')).href);
      return { wa, engine };
    })().catch((err) => {
      runtimePromise = null;
      throw err;
    });
  }
  return runtimePromise;
}

function configure(cfg) {
  configured = cfg || {};
  setGlobals(configured);
}

async function attachSock(sock) {
  if (!sock) return;
  const runtime = await ensureRuntime();
  if (!sock.__tsukasaKaguyaHelpers) {
    try {
      runtime.wa.attachHelpers(sock);
      sock.__tsukasaKaguyaHelpers = true;
    } catch (err) {
      console.error('[KAGUYA] attachHelpers gagal:', err && err.message);
    }
  }
  global.sock = sock;
}

async function loadPlugin(entry) {
  if (!moduleCache.has(entry.file)) {
    moduleCache.set(
      entry.file,
      import(pathToFileURL(entry.file).href).then((mod) => mod.default || mod)
    );
  }
  return moduleCache.get(entry.file);
}

function prefixesFor(cfg) {
  return ['.', '!', '/'];
}

function hasCommand(command) {
  return getCatalog().byCommand.has(String(command || '').toLowerCase());
}

function commandEntries(command) {
  return getCatalog().byCommand.get(String(command || '').toLowerCase()) || [];
}

async function getGroupMeta(sock, chat) {
  if (!chat || !String(chat).endsWith('@g.us')) return null;
  try {
    return await sock.groupMetadata(chat);
  } catch {
    return null;
  }
}

async function dispatch({
  sock,
  raw,
  cfg,
  command,
  rest,
  prefix,
  chat,
  sender,
  isOwner,
  isAdmin,
  isPremium,
  reply,
}) {
  const cmd = String(command || '').toLowerCase();
  const entries = commandEntries(cmd);
  if (!entries.length) return false;

  await ensureRuntime();
  await attachSock(sock);

  let lastError = null;
  for (const entry of entries) {
    let plugin;
    try {
      plugin = await loadPlugin(entry);
    } catch (err) {
      lastError = err;
      continue;
    }
    if (typeof plugin !== 'function') continue;
    if (plugin.disabled || (Array.isArray(plugin.command) && !plugin.command.length)) continue;
    if (plugin.owner && !isOwner) {
      await reply('Perintah ini khusus owner.');
      return true;
    }
    if (plugin.premium && !isPremium && !isOwner) {
      await reply('Perintah ini khusus premium.');
      return true;
    }
    if (plugin.admin && !isAdmin && !isOwner) {
      await reply('Perintah ini khusus admin grup.');
      return true;
    }
    if (plugin.group && !String(chat).endsWith('@g.us')) {
      await reply('Perintah ini hanya bisa dipakai di grup.');
      return true;
    }
    if (plugin.private && String(chat).endsWith('@g.us')) {
      await reply('Perintah ini hanya bisa dipakai di chat pribadi.');
      return true;
    }

    const { wa } = await ensureRuntime();
    let m;
    try {
      m = wa.serialize(sock, raw);
    } catch (err) {
      lastError = err;
      continue;
    }
    if (!m) continue;

    const groupMetadata = await getGroupMeta(sock, chat);
    const text = String(rest || '');
    const args = text ? text.split(/\s+/).filter(Boolean) : [];
    const botIds = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);
    const botAdmin = Boolean(
      groupMetadata &&
        botIds.some((id) =>
          (groupMetadata.participants || []).some(
            (p) =>
              p.admin &&
              [p.id, p.phoneNumber, p.jid, p.lid]
                .filter(Boolean)
                .map((v) => String(v))
                .includes(String(id))
          )
        )
    );

    const ctx = {
      sock,
      conn: sock,
      m,
      text,
      body: text,
      args,
      prefix: prefix || '.',
      usedPrefix: prefix || '.',
      command: cmd,
      reply: (value, options) => m.reply(value, options),
      example: (usage) => m.reply(`Contoh: ${prefix || '.'}${cmd} ${usage || ''}`.trim()),
      sender: m.sender || sender,
      jid: chat,
      chat,
      isOwner: Boolean(isOwner),
      isAdmin: Boolean(isAdmin),
      isPremium: Boolean(isPremium || isOwner),
      isBotAdmin: botAdmin,
      isCmd: true,
      pushName: m.pushName,
      pushname: m.pushName,
      mentionedJid: m.mentionedJid || [],
      quoted: m.quoted || null,
      groupMetadata,
      participants:
        groupMetadata && Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants.map((p) => ({ ...p, id: p.phoneNumber || p.id }))
          : [],
      config: {},
    };

    try {
      await plugin(m, ctx);
      return true;
    } catch (err) {
      lastError = err;
      console.error(`[KAGUYA] ${entry.rel} (${cmd}) error:`, err && (err.stack || err.message || err));
      break;
    }
  }

  if (lastError) {
    const message = String(lastError.message || lastError).slice(0, 220);
    await reply(`⚠️ Plugin *${cmd}* gagal dijalankan.\n${message}`);
    return true;
  }
  return false;
}

/**
 * Jalankan plugin pasif Kaguya (customPrefix) untuk pesan biasa.
 *
 * Dipakai untuk fitur yang butuh balasan/quote: jawaban game (family100,
 * tebak-tebakan, adu, dll), captcha, menfess, autodl, JPM, dan sejenisnya.
 * Kalau salah satu plugin menangani pesan, router berhenti di sini sehingga
 * Tsukasa/AI tidak ikut membalas jawaban tersebut di mode all/reply.
 */
async function dispatchPassive({
  sock,
  raw,
  cfg,
  chat,
  sender,
  text,
  prefix,
  isOwner,
  isAdmin,
  isPremium,
  reply,
}) {
  const body = String(text || '').trim();
  if (!body) return false;

  const catalog = getCatalog();
  const candidates = Array.isArray(catalog.passives)
    ? [...catalog.passives].sort((a, b) => a.rel.localeCompare(b.rel))
    : [];
  if (!candidates.length) return false;

  let runtimeWa;
  try {
    const runtime = await ensureRuntime();
    runtimeWa = runtime.wa;
    await attachSock(sock);
  } catch (err) {
    console.error('[KAGUYA] passive runtime gagal:', err && (err.message || err));
    return false;
  }

  const matched = [];
  for (const entry of candidates) {
    let plugin;
    try {
      plugin = await loadPlugin(entry);
    } catch (err) {
      console.error(`[KAGUYA] passive ${entry.rel} gagal dimuat:`, err && (err.message || err));
      continue;
    }
    if (typeof plugin !== 'function' || plugin.disabled) continue;
    const re = plugin.customPrefix;
    if (!(re instanceof RegExp)) continue;
    let ok = false;
    try {
      ok = re.test(body);
    } catch {
      ok = false;
    }
    if (!ok) continue;
    matched.push({ entry, plugin });
  }
  if (!matched.length) return false;

  // Pola ber-anchor (^...$) didahulukan, sama seperti dispatcher Kaguya asli.
  matched.sort(
    (a, b) =>
      Number(b.plugin.customPrefix.source.startsWith('^')) -
      Number(a.plugin.customPrefix.source.startsWith('^'))
  );

  let m;
  try {
    m = runtimeWa.serialize(sock, raw);
  } catch (err) {
    console.error('[KAGUYA] passive serialize gagal:', err && (err.message || err));
    return false;
  }
  if (!m) return false;

  // Metadata grup hanya diambil kalau ada plugin pasif yang memang butuh
  // status admin, supaya pesan biasa tidak memicu request tambahan.
  const needsMeta = matched.some(({ plugin }) => plugin.admin);
  const groupMetadata = needsMeta ? await getGroupMeta(sock, chat) : null;
  const botIds = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);
  const botAdmin = Boolean(
    groupMetadata &&
      botIds.some((id) =>
        (groupMetadata.participants || []).some(
          (p) =>
            p.admin &&
            [p.id, p.phoneNumber, p.jid, p.lid]
              .filter(Boolean)
              .map((v) => String(v))
              .includes(String(id))
        )
      )
  );
  // Hitung status admin dari metadata yang sudah diambil supaya router tidak
  // perlu memanggil groupMetadata lagi untuk setiap pesan biasa.
  const senderUser = String(sender || '').split('@')[0].split(':')[0];
  const senderAdmin = Boolean(
    groupMetadata &&
      (groupMetadata.participants || []).some((p) => {
        if (!p.admin) return false;
        return [p.id, p.lid, p.phoneNumber, p.pn]
          .filter(Boolean)
          .some((v) => String(v).split('@')[0].split(':')[0] === senderUser);
      })
  );
  const adminCtx = Boolean(isAdmin || isOwner || senderAdmin);

  for (const { entry, plugin } of matched) {
    if (plugin.owner && !isOwner) continue;
    if (plugin.premium && !isPremium && !isOwner) continue;
    if (plugin.admin && !adminCtx) continue;
    if (plugin.group && !String(chat).endsWith('@g.us')) continue;
    if (plugin.private && String(chat).endsWith('@g.us')) continue;

    const usedPrefix = prefix || '.';
    const ctx = {
      sock,
      conn: sock,
      m,
      text: body,
      body,
      args: [],
      prefix: usedPrefix,
      usedPrefix,
      command: '',
      reply: (value, options) => m.reply(value, options),
      example: () => '',
      sender: m.sender || sender,
      jid: chat,
      chat,
      isOwner: Boolean(isOwner),
      isAdmin: adminCtx,
      isPremium: Boolean(isPremium || isOwner),
      isBotAdmin: botAdmin,
      isCmd: false,
      pushName: m.pushName,
      pushname: m.pushName,
      mentionedJid: m.mentionedJid || [],
      quoted: m.quoted || null,
      groupMetadata,
      participants:
        groupMetadata && Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants.map((p) => ({ ...p, id: p.phoneNumber || p.id }))
          : [],
      config: {},
    };

    try {
      const handled = await plugin(m, ctx);
      if (handled) return true;
    } catch (err) {
      console.error(
        `[KAGUYA] passive ${entry.rel} error:`,
        err && (err.stack || err.message || err)
      );
    }
  }

  return false;
}

function box(title, lines, footer) {
  const out = [`╭─「 ${smallCaps(title)} 」`];
  for (const line of lines) out.push(`│ ${line}`);
  out.push('╰─' + '─'.repeat(Math.max(6, Math.min(28, String(title).length + 8))));
  if (footer) out.push('', footer);
  return out.join('\n');
}

function normalizeBuiltins(builtinCategories) {
  return (Array.isArray(builtinCategories) ? builtinCategories : [])
    .filter((b) => b && Array.isArray(b.commands) && b.commands.length)
    .map((b) => ({
      key: String(b.key || '').toLowerCase(),
      label: b.label || b.key || 'Fitur',
      description: b.description || '',
      commands: [...new Set(b.commands.map((c) => String(c).toLowerCase()))].sort(),
    }));
}

// Kategori populer ditampilkan lebih dulu supaya menu terasa dikurasi,
// bukan sekadar daftar folder alfabetis.
const CATEGORY_ORDER = [
  'rpg', 'game', 'anime', 'tools', 'sticker', 'download', 'fun', 'search',
  'canvas', 'economy', 'group', 'owner', 'user', 'store', 'quotes',
];

// Pengelompokan tema agar menu utama tidak terasa seperti folder plugin
// yang ditempel mentah-mentah.
const CATEGORY_GROUPS = [
  {
    label: 'RPG & Game',
    keys: [
      'rpg', 'game', 'blackjack', 'catur', 'ceme', 'dam', 'gaple', 'ludo',
      'mafia', 'mafiakota', 'monopoli', 'othello', 'poker', 'tebak',
      'ulartangga', 'undercover', 'uno', 'zombie', 'koboy', 'ninja', 'minecraft',
    ],
  },
  {
    label: 'Anime & Fandom',
    keys: [
      'anime', 'genshin', 'honkai-starrail', 'mobilelegends', 'valorant',
      'wuwa-wiki', 'zenless', 'freefire', 'esport',
    ],
  },
  {
    label: 'Tools & Download',
    keys: [
      'tools', 'download', 'convert', 'audio', 'canvas', 'ephoto', 'search',
      'stalker', 'cek', 'crypto', 'primbon', 'quotes', 'sticker', 'asisten',
    ],
  },
  {
    label: 'Sosial & Komunitas',
    keys: [
      'group', 'menfess', 'relationship', 'jpm', 'channel', 'clan', 'kampus',
      'sewa-bot', 'store', 'economy', 'tycoon', 'rich', 'user', 'owner',
    ],
  },
];

const MENU_PAGE_SIZE = 40;

function orderedCategories(categories) {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.key);
    const ib = CATEGORY_ORDER.indexOf(b.key);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      if (ia !== ib) return ia - ib;
    }
    return a.label.localeCompare(b.label, 'id');
  });
}

function groupCategories(categories) {
  const ordered = orderedCategories(categories);
  const used = new Set();
  const groups = [];

  for (const group of CATEGORY_GROUPS) {
    const items = ordered.filter((cat) => group.keys.includes(cat.key));
    if (!items.length) continue;
    groups.push({ label: group.label, items });
    items.forEach((cat) => used.add(cat.key));
  }

  const rest = ordered.filter((cat) => !used.has(cat.key));
  if (rest.length) groups.push({ label: 'Lainnya', items: rest });
  return groups;
}

function oneLine(value, max = 78) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function totalCommands(categories, builtins) {
  const kaguya = categories.reduce((sum, cat) => sum + cat.count, 0);
  const builtin = builtins.reduce((sum, item) => sum + item.commands.length, 0);
  return kaguya + builtin;
}

function sampleCommands(commands, prefix, limit = 4) {
  const shown = commands.slice(0, limit).map((cmd) => `${prefix}${cmd}`);
  if (commands.length > limit) shown.push('…');
  return shown.join('  ');
}

function pageOf(list, page) {
  const pages = Math.max(1, Math.ceil(list.length / MENU_PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  const start = (current - 1) * MENU_PAGE_SIZE;
  return { pages, current, items: list.slice(start, start + MENU_PAGE_SIZE) };
}

function pageFooter(prefix, key, page, pages, total) {
  if (pages <= 1) return `${total} command`;
  const nav = [];
  if (page > 1) nav.push(`sebelumnya: ${prefix}menu ${key} ${page - 1}`);
  if (page < pages) nav.push(`berikutnya: ${prefix}menu ${key} ${page + 1}`);
  return `${total} command • halaman ${page}/${pages}${nav.length ? ` • ${nav.join(' • ')}` : ''}`;
}

function formatCategory(cat, prefix, page) {
  const catalog = getCatalog();
  const sliced = pageOf(cat.commands, page);
  const lines = sliced.items.map((cmd) => {
    const entry = (catalog.byCommand.get(cmd) || [])[0];
    const desc = entry && entry.description ? ` — ${oneLine(entry.description, 68)}` : '';
    return `• ${prefix}${cmd}${desc}`;
  });
  return box(
    `ᴍᴇɴᴜ ${cat.label}`,
    lines,
    pageFooter(prefix, cat.key, sliced.current, sliced.pages, cat.count)
  );
}

function formatBuiltinCategory(builtin, prefix, page) {
  const sliced = pageOf(builtin.commands, page);
  const lines = [];
  if (builtin.description) {
    lines.push(oneLine(builtin.description, 90));
    lines.push('');
  }
  lines.push(...sliced.items.map((cmd) => `• ${prefix}${cmd}`));
  return box(
    `ꜰɪᴛᴜʀ ${builtin.label}`,
    lines,
    pageFooter(prefix, `fitur ${builtin.key}`, sliced.current, sliced.pages, builtin.commands.length)
  );
}

function formatAllIndex(prefix, builtins, categories) {
  const lines = [];
  lines.push(
    `${builtins.length} fitur Tsukasa • ${categories.length} kategori Kaguya • ${totalCommands(
      categories,
      builtins
    )} command`
  );
  lines.push('');
  if (builtins.length) {
    lines.push('*Fitur Tsukasa*');
    for (const item of builtins) {
      lines.push(`${item.label} (${item.commands.length}) — ${prefix}menu fitur ${item.key}`);
      lines.push(sampleCommands(item.commands, prefix));
    }
  }
  if (categories.length) {
    lines.push('');
    lines.push('*Fitur Kaguya*');
    for (const group of groupCategories(categories)) {
      lines.push('');
      lines.push(`*${group.label}*`);
      for (const cat of group.items) {
        lines.push(`• ${cat.label} (${cat.count})`);
        lines.push(`  ${sampleCommands(cat.commands, prefix)}`);
      }
    }
  }
  return box(`ɪɴᴅᴇᴋs ${smallCaps('menu')}`, lines, [
    `${prefix}menu <kategori> — semua command kategori`,
    `${prefix}menu fitur <nama> — semua command fitur Tsukasa`,
    `${prefix}menu <kategori> <halaman> — halaman berikutnya`,
    `${prefix}menu cari <kata> — cari command dengan cepat`,
  ].join('\n'));
}

function formatSearch(query, prefix, builtins, categories) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  const nameHits = [];
  const descHits = [];
  const seen = new Set();
  const add = (bucket, line, key) => {
    if (seen.has(key) || nameHits.length + descHits.length >= 60) return;
    seen.add(key);
    bucket.push(line);
  };

  // Pass 1: cocokkan nama command dulu supaya hasil paling relevan muncul di atas.
  for (const item of builtins) {
    for (const cmd of item.commands) {
      if (cmd.includes(q)) add(nameHits, `• ${prefix}${cmd} — ${item.label}`, cmd);
    }
  }

  const catalog = getCatalog();
  for (const cat of categories) {
    for (const cmd of cat.commands) {
      if (cmd.includes(q)) add(nameHits, `• ${prefix}${cmd} — ${cat.label}`, cmd);
    }
  }

  // Pass 2: cocokkan deskripsi untuk melengkapi hasil.
  for (const cat of categories) {
    for (const cmd of cat.commands) {
      const entry = (catalog.byCommand.get(cmd) || [])[0];
      const desc = entry && entry.description ? entry.description.toLowerCase() : '';
      if (!desc.includes(q)) continue;
      const note = ` — ${oneLine(entry.description, 48)}`;
      add(descHits, `• ${prefix}${cmd} — ${cat.label}${note}`, cmd);
    }
  }

  const results = [...nameHits, ...descHits].slice(0, 30);
  if (!results.length) {
    return (
      `Tidak ada command yang cocok dengan *${query}*.\n` +
      `Coba kata lain, atau lihat ${prefix}menu all.`
    );
  }

  const total = nameHits.length + descHits.length;
  const footer =
    total > results.length
      ? `${total} hasil ditemukan • gunakan kata kunci lebih spesifik.`
      : `Gunakan ${prefix}help <command> untuk cara pakai.`;
  return box(`ᴄᴀʀɪ ${oneLine(query, 24)}`, results, footer);
}

function formatMenu({ category, isOwner, prefix, builtinCategories }) {
  const raw = String(category || '').trim();
  const key = raw.toLowerCase();
  const p = prefix || '.';
  const catalog = getCatalog();
  const builtins = normalizeBuiltins(builtinCategories);
  const categories = orderedCategories(catalog.categories);

  if (!raw) {
    const lines = [];
    lines.push(`Hai! Aku ${configured && configured.botName ? configured.botName : 'Tsukasa'} ✨`);
    lines.push('');
    lines.push(`╭─「 ${smallCaps('menu utama')} 」`);
    lines.push(`│ Bot    : ${configured && configured.botName ? configured.botName : 'Tsukasa'}`);
    lines.push('│ Prefix : . ! /');
    lines.push(
      `│ Total  : ${builtins.length + categories.length} kategori • ${totalCommands(
        categories,
        builtins
      )} command`
    );
    lines.push('│');
    if (builtins.length) {
      lines.push('│ *Fitur Tsukasa*');
      for (const item of builtins) {
        lines.push(`│ ${item.label} — ${item.commands.length} cmd`);
      }
    }
    if (categories.length) {
      lines.push('│');
      lines.push('│ *Fitur Kaguya*');
      for (const group of groupCategories(categories)) {
        const count = group.items.reduce((sum, cat) => sum + cat.count, 0);
        lines.push(`│ *${group.label}* — ${group.items.length} kategori · ${count} cmd`);
        lines.push(`│ ${group.items.map((cat) => cat.label).join(', ')}`);
      }
    }
    lines.push('╰──────────────────────');
    lines.push('');
    lines.push(`${p}menu <kategori> — daftar command`);
    lines.push(`${p}menu fitur <nama> — daftar command fitur Tsukasa`);
    lines.push(`${p}menu all — indeks semua kategori + contoh`);
    lines.push(`${p}menu cari <kata> — cari command`);
    lines.push(`${p}help — panduan & bantuan`);
    lines.push(isOwner ? 'Owner mode aktif' : 'User mode');
    return lines.join('\n');
  }

  if (key === 'all' || key === 'semua') {
    return formatAllIndex(p, builtins, categories);
  }

  if (key === 'cari' || key === 'search') {
    return `Gunakan ${p}menu cari <kata> untuk mencari command.`;
  }

  if (key === 'fitur' || key === 'feature') {
    if (!builtins.length) return 'Belum ada fitur Tsukasa yang aktif di chat ini.';
    return box(
      'ꜰɪᴛᴜʀ ᴛꜱᴜᴋᴀꜱᴀ',
      builtins.map(
        (item) => `• ${p}menu fitur ${item.key} — ${item.label} (${item.commands.length})`
      ),
      `${p}menu <kategori> — daftar fitur Kaguya`
    );
  }

  const search = key.match(/^(?:cari|search)\s+([\s\S]+)$/);
  if (search) return formatSearch(search[1], p, builtins, categories);

  let name = key;
  let page = 1;
  const paged = key.match(/^(.*\S)\s+(\d{1,3})$/);
  if (paged) {
    name = paged[1];
    page = Number(paged[2]) || 1;
  }

  // Namespace "fitur" memaksa pencarian ke fitur Tsukasa. Ini perlu karena
  // beberapa nama fitur sama dengan kategori Kaguya (sticker, anime, tools).
  const fiturMatch = name.match(/^(?:fitur|feature)\s+(.+)$/);
  if (fiturMatch) {
    const wanted = fiturMatch[1].trim().toLowerCase();
    const builtin = builtins.find(
      (item) => item.key === wanted || item.label.toLowerCase() === wanted
    );
    return builtin ? formatBuiltinCategory(builtin, p, page) : null;
  }

  const found = categories.find(
    (cat) => cat.key === name || cat.label.toLowerCase() === name
  );
  if (found) return formatCategory(found, p, page);

  const builtin = builtins.find(
    (item) => item.key === name || item.label.toLowerCase() === name
  );
  if (builtin) return formatBuiltinCategory(builtin, p, page);

  return null;
}

function formatHelp({ query, prefix, builtinCategories }) {
  const q = String(query || '').trim().toLowerCase().replace(/^[.\/!]+/, '');
  const catalog = getCatalog();
  const builtins = normalizeBuiltins(builtinCategories);
  const p = prefix || '.';

  if (!q) {
    return [
      `╭─「 ${smallCaps('bantuan')} 」`,
      `│ ${p}menu — katalog menu`,
      `│ ${p}menu <kategori> — command per kategori`,
      `│ ${p}menu fitur <nama> — command fitur Tsukasa`,
      `│ ${p}menu <kategori> <halaman> — halaman berikutnya`,
      `│ ${p}menu all — indeks semua kategori`,
      `│ ${p}menu cari <kata> — cari command`,
      `│ ${p}help <command> — cara pakai command`,
      `│ ${p}help <kategori> — daftar command kategori`,
      `│ ${p}help fitur <nama> — daftar command fitur Tsukasa`,
      `│`,
      `│ Command bisa memakai prefix . ! /`,
      `│ atau panggil dengan trigger "${configured && configured.trigger ? configured.trigger : 'tsukasa'}".`,
      `╰──────────────────────`,
      '',
      `Contoh: ${p}help rpg`,
      `Contoh: ${p}help fitur sticker`,
    ].join('\n');
  }

  const fiturQuery = q.match(/^(?:fitur|feature)\s+(.+)$/);
  if (fiturQuery) {
    const wanted = fiturQuery[1].trim().toLowerCase();
    const builtin = builtins.find(
      (b) => b.key === wanted || b.label.toLowerCase() === wanted
    );
    if (!builtin) {
      return `Fitur *${wanted}* tidak ditemukan.\nLihat daftar fitur dengan ${p}menu fitur.`;
    }
    const lines = [builtin.description, ''].filter(Boolean);
    lines.push(...builtin.commands.map((cmd) => `• ${p}${cmd}`));
    return box(
      `ʙᴀɴᴛᴜᴀɴ ${builtin.label}`,
      lines,
      `${p}menu fitur ${builtin.key} untuk katalog`
    );
  }

  // Untuk nama yang dipakai bersama (anime, sticker, tools), kategori Kaguya
  // dimenangkan lebih dulu. Fitur Tsukasa tetap bisa dibuka lewat
  // "help fitur <nama>".
  const cat = catalog.categories.find((c) => c.key === q || c.label.toLowerCase() === q);
  if (cat) {
    const lines = [];
    const seen = new Set();
    for (const cmd of cat.commands) {
      const entry = (catalog.byCommand.get(cmd) || [])[0];
      const raw = entry && entry.help && entry.help[0] ? entry.help[0] : cmd;
      const text = String(raw).trim();
      if (!text) continue;
      const usage = /^[.!/]/.test(text) ? text : `${p}${text}`;
      if (seen.has(usage)) continue;
      seen.add(usage);
      const desc = entry && entry.description ? ` — ${oneLine(entry.description, 70)}` : '';
      lines.push(`• ${usage}${desc}`);
      if (lines.length >= 60) break;
    }
    if (cat.commands.length > lines.length) {
      lines.push(`… dan ${cat.commands.length - lines.length} command lainnya`);
    }
    return box(`ʙᴀɴᴛᴜᴀɴ ${cat.label}`, lines, `${p}menu ${cat.key} untuk katalog`);
  }

  const builtinCat = builtins.find((b) => b.key === q || b.label.toLowerCase() === q);
  if (builtinCat) {
    const lines = [builtinCat.description, ''].filter(Boolean);
    lines.push(...builtinCat.commands.map((cmd) => `• ${p}${cmd}`));
    return box(
      `ʙᴀɴᴛᴜᴀɴ ${builtinCat.label}`,
      lines,
      `${p}menu fitur ${builtinCat.key} untuk katalog`
    );
  }

  const builtinCmd = builtins.find((b) => b.commands.includes(q));
  if (builtinCmd) {
    return box(`ʙᴀɴᴛᴜᴀɴ ${q}`, [
      builtinCmd.description,
      '',
      `Fitur : ${builtinCmd.label}`,
      `Pakai : ${p}${q}`,
      '',
      `Command lain di fitur ini:`,
      ...builtinCmd.commands.filter((cmd) => cmd !== q).slice(0, 12).map((cmd) => `• ${p}${cmd}`),
    ].filter(Boolean));
  }

  const entries = catalog.byCommand.get(q) || [];
  if (!entries.length) {
    return `Command *${q}* tidak ditemukan.\nCoba ${p}menu atau ${p}help <kategori>.`;
  }
  const entry = entries[0];
  const usage = entry.help.length ? entry.help : entry.commands;
  const meta = categoryMeta(entry.folder);
  const lines = [];
  if (entry.description) lines.push(entry.description);
  lines.push('');
  lines.push(`Kategori : ${meta.label}`);
  lines.push(`File     : ${entry.rel}`);
  lines.push(`Alias    : ${entry.commands.map((c) => p + c).join(', ')}`);
  lines.push('');
  lines.push('Cara pakai:');
  for (const u of usage.slice(0, 6)) {
    const text = String(u).trim();
    lines.push(`• ${text.startsWith(p) ? text : p + text}`);
  }
  if (entry.owner) lines.push('', 'Khusus owner');
  if (entry.premium) lines.push('', 'Khusus premium');
  if (entry.admin) lines.push('', 'Khusus admin grup');
  if (entry.group) lines.push('', 'Hanya di grup');
  if (entry.private) lines.push('', 'Hanya di chat pribadi');
  return box(`ʙᴀɴᴛᴜᴀɴ ${q}`, lines);
}

module.exports = {
  configure,
  ensureRuntime,
  attachSock,
  getCatalog,
  hasCommand,
  commandEntries,
  dispatch,
  dispatchPassive,
  formatMenu,
  formatHelp,
  prefixesFor,
  categoryMeta,
  smallCaps,
};
