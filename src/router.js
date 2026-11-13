'use strict';

const path = require('path');
const log = require('./logger');
const { OwnerDetector, WelcomeHandler, TagAllHandler, RvoHandler } = require('./features/basic');
const { AfkFeature } = require('./features/afk');
const { CnFeature } = require('./features/cn');
const { StickerReplyFeature } = require('./features/stickerreply');
const { StickerUtilsFeature } = require('./features/stickerutils');
const { StickerTransformFeature } = require('./features/stickertransform');
const { StickerFeature, BratFeature } = require('./features/media');
const { BaImageFeature, PapFeature } = require('./features/images');
const { VisionFeature, VnFeature, TtsFeature, ImgGenFeature, HijabinFeature } = require('./features/ai');
const { AiToolsFeature } = require('./features/aitools');
const { AnimeFeature } = require('./features/anime');
const { InfoFeature } = require('./features/info');
const { PeraturanFeature } = require('./features/peraturan');
const { GroupTools } = require('./features/grouptools');
const { GroupGuard } = require('./features/groupguard');
const { NewsFeature } = require('./features/news');
const { ConfigFeature } = require('./features/configcmd');
const { UpdateFeature } = require('./features/updatecmd');
const { PanelFeature } = require('./features/panel');
const { VerifFeature } = require('./features/verif');
const { TikTokAdminFeature } = require('./features/tiktokadmin');
const { VerifStore } = require('./verifstore');
const newsfeeds = require('./newsfeeds');
const metrics = require('./metrics');
const { downloadQueue } = require('./downloadqueue');
const { RateLimiter } = require('./ratelimit');
const tiktok = require('./tiktok');
const llm = require('./llm');
const emotion = require('./emotion');
const memory = require('./memory');
const wa = require('./wa');
const { isGroupJid, jidUser, formatDateTime, splitChatBubbles } = require('./util');
const { shortError } = require('./logfmt');
const { isHotCue, isStopCue } = require('./adultmode');
const {
  featureForCommand,
  normalizeFeatureKey,
  normalizeCommandKey,
  featureLabel,
  featureList,
} = require('./featurescatalog');
const {
  escapeRegExp,
  KNOWN_COMMANDS,
  parseCommand,
  normalizeCommand,
  stripLeadingTrigger,
} = require('./commandparser');
const kaguya = require('./kaguya');

const RE_REPLY_CUE = /\b(balas(in|lah)?|reply|jawab(in|lah)?)(\s+ini)?\b/i;

function userPart(jid) {
  return String(jid || '').split('@')[0].split(':')[0].trim();
}

function normalizeTrigger(cfg) {
  const trig = String(cfg.trigger || 'tsukasa').trim();
  return new RegExp('\\b' + trig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
}

/**
 * Dukung "Tsukasa hot on", "Tsukasa mode dewasa off", dst.
 * Mengembalikan string argumen, atau null jika bukan perintah adult.
 */
function parseTriggerAdultCommand(text, trigger) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const re = new RegExp(
    '^' + escapeRegExp(trigger || 'tsukasa') + '\\s+(?:mode\\s+)?(?:dewasa|adult|hot|ecchi)\\b\\s*([\\s\\S]*)$',
    'i'
  );
  const match = raw.match(re);
  if (!match) return null;
  const rest = String(match[1] || '').trim();
  if (!rest) return 'on';
  // Hanya anggap perintah jika diikuti aksi yang dikenal. "tsukasa hot banget"
  // tetap diproses sebagai chat biasa.
  const action = rest.split(/\s+/)[0].toLowerCase();
  const known = [
    'on',
    'off',
    'status',
    'enable',
    'disable',
    'aktif',
    'aktifkan',
    'matikan',
    'mati',
    'nonaktif',
    'nonaktifkan',
    'nyala',
    'cek',
    'info',
    '1',
    '0',
    'ya',
    'tidak',
  ];
  return known.includes(action) ? action : null;
}

/**
 * Baileys modern bisa memberi JID @lid untuk chat pribadi. Coba ubah ke nomor
 * telepon asli lewat mapping internal, lalu fallback ke onWhatsApp.
 */
async function resolveLidToPn(sock, jid) {
  const s = String(jid || '').trim();
  if (!s.endsWith('@lid') || !sock) return '';
  const mapping = sock.signalRepository && sock.signalRepository.lidMapping;
  if (mapping) {
    for (const fn of ['getPNForLID', 'getPnForLid', 'getPhoneNumber']) {
      if (typeof mapping[fn] !== 'function') continue;
      try {
        const pn = await mapping[fn](s);
        if (pn) return String(pn);
      } catch {
        /* coba cara lain */
      }
    }
  }
  try {
    const res = await sock.onWhatsApp(s);
    if (Array.isArray(res)) {
      const hit = res.find((x) => x && x.jid && !String(x.jid).endsWith('@lid'));
      if (hit) return String(hit.jid);
    }
  } catch {
    /* ignore */
  }
  return '';
}

function extractText(m, content) {
  const txt = wa.extractText(content);
  if (txt) return txt;
  if (m.message && m.message.conversation) return m.message.conversation;
  return '';
}

function quotedInfo(quoted) {
  // Semua jenis pesan yang bisa di-quote harus dihitung sebagai "ada quote".
  // Dulu video/dokumen/sticker dan caption gambar tidak terdeteksi, sehingga
  // mode grup `reply` menganggap pesan bukan balasan dan tidak merespons.
  const info = { img: false, aud: false, vid: false, doc: false, sticker: false, text: '' };
  if (!quoted) return info;
  info.img = Boolean(quoted.imageMessage);
  info.aud = Boolean(quoted.audioMessage);
  info.vid = Boolean(quoted.videoMessage);
  info.doc = Boolean(quoted.documentMessage);
  info.sticker = Boolean(quoted.stickerMessage);

  const captionOf = (node) => String((node && node.caption) || '').trim();
  if (quoted.conversation) info.text = quoted.conversation;
  else if (quoted.extendedTextMessage && quoted.extendedTextMessage.text) {
    info.text = quoted.extendedTextMessage.text;
  } else {
    info.text =
      captionOf(quoted.imageMessage) ||
      captionOf(quoted.videoMessage) ||
      captionOf(quoted.documentMessage) ||
      '';
  }
  return info;
}

class Router {
  constructor(
    cfg,
    sock,
    ready,
    store,
    animeChannel,
    groupTools,
    verifStore,
    tiktokMonitor,
    tiktokAccounts,
    groupGuard,
    updater,
    backup,
    audit
  ) {
    this.cfg = cfg;
    this.sock = sock;
    this.ready = typeof ready === 'function' ? ready : () => Boolean(ready);
    this.store = store;
    this.backup = backup || null;
    this.audit = audit || null;
    this.animeChannel = animeChannel || null;
    this.groupTools = groupTools || new GroupTools(cfg, store);
    this.afk = new AfkFeature(cfg, store);
    this.verif = new VerifFeature(
      cfg,
      verifStore || new VerifStore(cfg),
      tiktokMonitor || null,
      tiktokAccounts || null
    );
    this.tiktokAdmin = new TikTokAdminFeature(cfg, tiktokAccounts || null, tiktokMonitor || null);

    this.reTrig = normalizeTrigger(cfg);
    this.owner = new OwnerDetector();
    this.welcome = new WelcomeHandler(store, cfg);
    this.tagall = new TagAllHandler();
    this.rvo = new RvoHandler();
    this.sticker = new StickerFeature();
    this.stickerReply = new StickerReplyFeature(cfg);
    this.stickerUtils = new StickerUtilsFeature(cfg);
    this.stickerTransform = new StickerTransformFeature(cfg);
    this.brat = new BratFeature(this.reTrig);
    this.cn = new CnFeature(cfg);
    this.ba = new BaImageFeature(cfg, this.reTrig);
    this.pap = new PapFeature(cfg);
    this.vision = new VisionFeature(this.reTrig, this.owner);
    this.vn = new VnFeature(this.reTrig, this.owner);
    this.tts = new TtsFeature(this.reTrig);
    this.imggen = new ImgGenFeature(cfg);
    this.aiTools = new AiToolsFeature(cfg, {
      stickerReply: this.stickerReply,
      imggen: this.imggen,
      groupTools: this.groupTools,
    });
    this.hijab = new HijabinFeature(cfg);
    this.anime = new AnimeFeature(this.reTrig);
    this.info = new InfoFeature(this.reTrig);
    this.news = new NewsFeature(cfg);
    this.configCmd = new ConfigFeature(cfg);
    this.updateCmd = new UpdateFeature(updater || null);
    this.panel = new PanelFeature(cfg, { updater: updater || null, appDir: path.resolve(__dirname, '..') });
    this.peraturan = new PeraturanFeature(store);
    this.guard = groupGuard || new GroupGuard(cfg, store);
    this.heavyLimiter = new RateLimiter({ maxEntries: 2000 });
    this.statusMentionSeen = new Set();
    kaguya.configure(cfg);
  }

  botJids() {
    const u = (this.sock && this.sock.user) || {};
    return [u.id, u.lid].filter(Boolean);
  }

  isQuotedFromBot(ctxInfo) {
    const participant = ctxInfo && ctxInfo.participant;
    if (!participant) return false;
    const got = userPart(participant);
    if (!got) return false;
    return this.botJids().some((jid) => userPart(jid) === got);
  }

  /**
   * Tag status WhatsApp diterima sebagai pesan biasa di chat pribadi (atau grup
   * bila yang di-tag adalah grup). Isinya bisa berupa statusMentionMessage di
   * dalam message maupun metadata statusMentions di level WebMessageInfo.
   */
  isStatusMention(m, content) {
    if (!m) return false;
    const msg = m.message || {};
    const ctx = msg.messageContextInfo || (content && content.messageContextInfo) || {};
    const info =
      m.statusMentionMessageInfo || msg.statusMentionMessageInfo || ctx.statusMentionMessageInfo;
    const wrapped = Boolean(
      msg.statusMentionMessage ||
        msg.groupStatusMentionMessage ||
        (content && (content.statusMentionMessage || content.groupStatusMentionMessage))
    );
    const flagged = m.isMentionedInStatus === true;
    const mentions = Array.isArray(m.statusMentions) ? m.statusMentions : [];
    if (!info && !wrapped && !flagged && mentions.length === 0) return false;
    if (info || wrapped || flagged) return true;

    const targets = this.botJids().map(userPart).filter(Boolean);
    if (targets.length === 0) return mentions.length > 0;
    return mentions.some((jid) => targets.includes(userPart(jid)));
  }

  async handleStatusMention(m) {
    const chat = m.key.remoteJid;
    const id = String(m.key.id || '');
    if (id && this.statusMentionSeen.has(id)) return;
    if (id) {
      this.statusMentionSeen.add(id);
      if (this.statusMentionSeen.size > 500) {
        const oldest = this.statusMentionSeen.values().next().value;
        this.statusMentionSeen.delete(oldest);
      }
    }

    const sender = m.key.participant || chat;
    // status@broadcast tidak bisa dibalas langsung. Untuk kasus itu, balas ke
    // chat pribadi pengunggah status bila nomor teleponnya tersedia.
    let target = chat && chat !== 'status@broadcast' ? chat : '';
    if (!target) {
      target = [m.key.participantPn, m.key.remoteJidAlt, m.key.participant]
        .filter(Boolean)
        .map((jid) => (String(jid).includes('@') ? String(jid) : `${userPart(jid)}@s.whatsapp.net`))
        .find((jid) => !/@lid$/i.test(jid)) || '';
    }

    log.info(`[STATUS] tag status dari ${sender} di ${chat}`);
    if (!target) {
      log.info('[STATUS] tidak ada nomor tujuan untuk membalas tag status');
      return;
    }
    await wa
      .sendText(
        target,
        '👀 Aku melihat tag status kamu. Terima kasih sudah menyebutku! ✨',
        undefined
      )
      .catch(() => {});
  }

  heavyGate(chat, key, seconds) {
    const win = Math.max(0, Number(seconds) || 0) * 1000;
    if (win <= 0) return { allowed: true, retryMs: 0 };
    return this.heavyLimiter.take(`${key}|${chat}`, win);
  }

  async denyHeavy(chat, gate, m, label) {
    const wait = Math.max(1, Math.ceil((gate.retryMs || 0) / 1000));
    await wa
      .sendText(
        chat,
        `⏳ Command *${label}* terlalu sering. Coba lagi dalam ${wait} detik.`,
        m
      )
      .catch(() => {});
  }

  formatUptime(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [d ? `${d}h` : '', h ? `${h}j` : '', m ? `${m}m` : '', `${s}d`]
      .filter(Boolean)
      .join(' ');
  }

  healthReport() {
    const mem = process.memoryUsage();
    const mb = (n) => `${(Number(n) / 1024 / 1024).toFixed(1)} MB`;
    const ready = Boolean(this.ready());
    const sock = wa.getSock();
    const anime = this.anime && this.anime.downloadStatus
      ? this.anime.downloadStatus()
      : { active: [], queued: [], max: 0 };
    const channel = this.animeChannel ? this.animeChannel.status() : null;
    const cache = newsfeeds.cacheStats();
    const guardCount = this.store && this.store.listGroupGuards
      ? this.store.listGroupGuards().length
      : 0;
    const snap = metrics.snapshot();
    const dl = downloadQueue.status();
    const backupText = this.backup ? this.backup.statusText() : 'tidak tersedia';
    const auditText = this.audit
      ? this.audit.enabled
        ? 'aktif'
        : 'nonaktif'
      : 'tidak tersedia';

    const lines = [
      '🩺 *Health Tsukasa*',
      `• WhatsApp   : ${ready ? 'terhubung' : 'belum terhubung'}${sock ? '' : ' (sock kosong)'}`,
      `• Uptime     : ${this.formatUptime(process.uptime())}`,
      `• RAM        : ${mb(mem.rss)} (heap ${mb(mem.heapUsed)})`,
      `• Node       : ${process.version}`,
      `• Berita     : cache ${cache.entries} entri (TTL ${cache.ttlMin} menit)`,
      `• Unduhan    : ${anime.active.length} aktif, ${anime.queued.length} antre (paralel ${anime.max})`,
      `• Unduhan WA : ${dl.active} aktif, ${dl.pending} antre (paralel ${dl.concurrency})`,
      `• Moderasi   : ${guardCount} grup dipantau`,
      `• Backup     : ${backupText}`,
      `• Audit      : ${auditText}`,
      `• Metrik     : ${snap.counters.messages} pesan, ${snap.counters.commands} command, ${snap.counters.errors} error`,
      `• Reconnect  : ${snap.counters.reconnects}x (delay terakhir ${Math.round(
        Number(snap.gauges.reconnectDelayMs) || 0
      )}ms)`,
    ];
    if (snap.lastError) {
      lines.push(
        `• Error akhir: [${snap.lastError.tag || 'APP'}] ${String(snap.lastError.message).slice(0, 120)}`
      );
    }
    if (channel) {
      lines.push(
        `• Channel    : ${channel.running ? 'scheduler jalan' : 'scheduler berhenti'}`,
        `• Post hari  : ${channel.todayCount}/${channel.maxPerDay}`,
        `• Post total : ${channel.postedCount}`
      );
      if (channel.lastError) lines.push(`• Error      : ${channel.lastError}`);
    }
    return lines.join('\n');
  }

  /**
   * Menu AI-first. Baris menu dipetakan ke fitur lewat `featureForCommand`,
   * lalu fitur yang dimatikan admin grup otomatis hilang dari daftar.
   */
  buildMenu(chat, sender, isOwner) {
    const isGroup = isGroupJid(chat);
    const featureOn = (key) => !isGroup || !key || this.store.isFeatureEnabled(chat, key);
    const commandOn = (cmd) => !isGroup || !cmd || this.store.isCommandEnabled(chat, cmd);
    const userName = memory.getUserName(sender) || '';
    const greeting = userName ? `Hai ${userName}!` : 'Hai!';

    const sections = [
      {
        title: '*AI — Fitur Utama*',
        feature: 'ai',
        lines: [
          '• tsukasa <tanya> — ngobrol natural; AI bisa kirim sticker, reaksi, gambar, pengingat, cari web',
          '• kirim/reply gambar + sebut "tsukasa" — analisis gambar (Vision)',
          '• tsukasa vn <teks> — voice note AI',
          '• .gambar <prompt> — buat gambar AI',
          '• .info <topik> — info apa saja dalam Bahasa Indonesia',
          '• .rangkum [jumlah] — rangkum percakapan terakhir',
        ],
      },
      {
        title: '*Umum*',
        lines: [
          '• .help / .menu — menu ini',
          '• .whoami — lihat JID kamu',
          '• .health / .ping / .status — status bot, uptime, RAM',
          '• .afk [alasan] — tandai AFK (.afk off untuk kembali)',
          '• .statistik — statistik aktivitas chat',
          '• .topaktif [jumlah] — leaderboard anggota paling aktif di grup',
          '• .welcome on|off|set|reset|preview — pesan sambutan grup',
          '• .goodbye on|off|set|reset|preview — pesan perpisahan grup',
        ],
      },
      {
        title: '*Sticker & Quote*',
        lines: [
          '• .stiker / .s — gambar/video/URL jadi sticker',
          '• .sgif — sticker animasi (GIF/video)',
          '• .brat [tema] <teks> — sticker brat (green/white/black/pink/blue/red)',
          '• .srandom <mood> / .s <mood> — sticker random dari pack',
          '• .sadd <mood> — simpan sticker (reply sticker) ke pack',
          '• .slist / .sdel <mood> <nomor> — kelola pack sticker',
          '• .toimg — sticker jadi gambar PNG',
          '• .ttp <teks> / .attp <teks> — sticker teks statis/animasi',
          '• .qc [light|dark] — quote card dari pesan yang di-reply',
          '• .qcimg / .qci — quote card sebagai gambar PNG',
          '• .wm <teks> — watermark sticker',
          '• .stickerinfo / .smeta — info sticker',
          '• .emojimix 😀 😍 — gabung dua emoji',
          '• .flip / .flipv / .rotate <derajat> — balik/putar sticker',
          '• .grayscale / .invert / .blur [sigma] — filter sticker',
          '• .crop / .resize <px> — potong/resize sticker',
        ],
      },
      {
        title: '*Media & Anime*',
        lines: [
          '• .rvo — buka media sekali lihat (reply)',
          '• .ba — gambar Blue Archive',
          '• .pap — kirim pap',
          '• .hijabin — hijabkan gambar (kirim/reply gambar)',
          '• .anime ... — info anime (new/movie/schedule/search/detail)',
          '• .anime roulette [genre] — rekomendasi anime acak',
          '• .news [topik] — berita anime/manga/gacha/cosplay',
          '• .cosplay <link IG> — ambil foto dari post Instagram',
        ],
      },
      {
        title: '*Verif TikTok & CN*',
        lines: [
          '• .cn <nama> — contoh CN TikTok (3 gaya)',
          '• .verif <acc> — verif ACC TikTok dan tautkan nomor WA kamu',
          '• .me — lihat akun TikTok yang tertaut ke nomor kamu',
          '• .listverif — daftar ACC terverifikasi',
          '• .unverif <acc> — hapus ACC dari daftar verif',
          '• .siapaup / .whoup [CN] — siapa yang UP hari ini',
          '• .cekup @username — cek akun sudah UP atau belum',
          '• .history [CN] — rekap UP 7 hari terakhir',
          '• .addakun <acc> — di grup sama seperti .verif; di DM khusus owner',
          '• .delakun <acc> — hapus pantauan/verif akun',
          '• .listakun — daftar akun yang dipantau detector',
          '• .detector status — status detector TikTok',
          '• .detector setgc — atur grup notifikasi TikTok dari WhatsApp',
          '• .detector on|off — kontrol detector (owner)',
        ],
      },
      {
        title: '*Admin Grup*',
        lines: [
          '• .fitur on|off <nama> — aktif/nonaktifkan fitur di grup ini',
          '• .fitur status — daftar fitur aktif/nonaktif',
          '• .modegrup all|reply|call — atur cara bot membalas',
          '• .tagall <pesan> — mention semua anggota (khusus admin grup)',
          '• .peraturan on|off|status — moderasi grup',
          '• .antilink on|off / .antilink allow domain.com',
          '• .antispam on|off',
          '• .mute [menit] @user / .unmute @user / .resetwarn @user|all',
          '• .jadwal buka 06:00 / .jadwal tutup 22:00',
          '• .jadwal weekend on|off / .jadwal test',
          '• .ingatkan <waktu> <teks> — pengingat',
          '• .poll <tanya> | <opsi1> | <opsi2> — polling grup',
        ],
      },
    ];

    if (isOwner) {
      sections.push({
        title: '*Owner*',
        lines: [
          '• .config / .set <KEY> <nilai> — ubah pengaturan lewat chat',
          '• .update status|check|now|auto on|off — auto-update & restart',
          '• .panel status|logs|install|restart — kelola panel dari chat pribadi',
          '• .animechannel status|test|news|info|cosplay|check <judul>',
          '• .tsukasa persona tsukasa1|tsukasa2 — pilih persona AI',
          '• .tsukasa mode pro on|off / .hot on|off|status',
          '• .geminikey list|add <key>|remove <key>',
          '• .backup [status|run] — backup sesi WhatsApp',
          '• .audit [jumlah|clear] — audit command owner',
        ],
      });
    }

    sections.push({
      title: '*Tips*',
      lines: [
        '• Chat pribadi: reply pesan apa pun, aku tetap jawab.',
        '• Grup: default hanya merespons saat dipanggil "tsukasa". Admin bisa ubah lewat .modegrup.',
        '• Suasana hatiku berubah otomatis dari obrolan — tanpa pemberitahuan.',
        '• Fitur grup bisa dimatikan tanpa mengganggu fitur lain: .fitur off brat qc',
        '• Mau satu perintah saja? .fitur off news atau .fitur off cmd:news',
        '• Katakan "panggil aku [nama]" supaya aku ingat namamu!',
      ],
    });

    const featureOfLine = (line) => {
      const first = line.match(/^\s*•\s+\.([a-z0-9-]+)/i);
      if (!first) return { commands: [], feature: '' };
      const commands = [...line.matchAll(/\.([a-z0-9-]+)/g)]
        .map((match) => match[1].toLowerCase())
        .filter(Boolean);
      return { commands, feature: featureForCommand(first[1]) };
    };

    const lines = [
      '✨ *MENU TSUKASA* ✨',
      greeting,
      '',
      'Pakai perintah dengan awalan *!*, */*, *.*, atau sebut "' + this.cfg.trigger + '".',
      '',
    ];

    for (const section of sections) {
      const visible = section.lines.filter((line) => {
        const info = featureOfLine(line);
        const key = info.feature || section.feature;
        const commandVisible = !info.commands.length || info.commands.some(commandOn);
        return featureOn(key) && commandVisible;
      });
      if (!visible.length) continue;
      lines.push(section.title, ...visible, '');
    }

    return lines.join('\n').trim();
  }

  async handleFiturCommand(chat, m, rest) {
    const parts = String(rest || '').trim().split(/\s+/).filter(Boolean);
    const action = String(parts[0] || 'status').toLowerCase();
    const rawKeys = parts.slice(1);
    const features = featureList();

    const summary = () => {
      const disabled = new Set(this.store.listDisabledFeatures(chat));
      const disabledCommands = this.store.listDisabledCommands(chat);
      const lines = [
        '⚙️ *Fitur Grup*',
        `Aktif: ${features.length - disabled.size}/${features.length}`,
        '',
      ];
      for (const feature of features) {
        const offCommands = feature.commands.filter((cmd) => disabledCommands.includes(cmd));
        const extra = offCommands.length ? ` — ${offCommands.length} perintah off` : '';
        lines.push(
          `${disabled.has(feature.key) ? '❎' : '✅'} ${feature.label} (\`${feature.key}\`)${extra}`
        );
      }
      if (disabledCommands.length) {
        lines.push('', 'Perintah nonaktif:', ...disabledCommands.map((cmd) => `❎ .${cmd}`));
      }
      lines.push(
        '',
        'Atur:',
        '.fitur off news — matikan satu perintah',
        '.fitur off brat qc — matikan beberapa perintah',
        '.fitur off fitur:news — matikan seluruh kelompok fitur',
        '.fitur on news — aktifkan lagi',
        '.fitur off all — matikan semua fitur',
        '.fitur reset — aktifkan semua',
        '',
        'Fitur/perintah yang dimatikan otomatis hilang dari .help di grup ini.'
      );
      return lines.join('\n');
    };

    if (!parts.length || ['status', 'list', 'daftar', 'info', 'cek'].includes(action)) {
      await wa.sendText(chat, summary(), m);
      return;
    }

    if (['reset', 'default', 'restore'].includes(action)) {
      await this.store.clearGroupFeatures(chat);
      await wa.sendText(chat, '♻️ Semua fitur di grup ini diaktifkan kembali.\n\n' + summary(), m);
      return;
    }

    const on = ['on', 'enable', 'aktif', 'aktifkan', 'nyala', '1', 'ya'].includes(action);
    const off = [
      'off',
      'disable',
      'mati',
      'matikan',
      'nonaktif',
      'nonaktifkan',
      '0',
      'tidak',
    ].includes(action);
    if (!on && !off) {
      await wa.sendText(
        chat,
        'Gunakan:\n.fitur status\n.fitur off <nama>\n.fitur on <nama>\n.fitur reset',
        m
      );
      return;
    }

    const parseTarget = (raw) => {
      const value = String(raw || '').trim();
      const lower = value.toLowerCase();
      const commandPrefix = lower.match(/^(?:cmd|command|perintah):(.*)$/);
      if (commandPrefix) {
        const key = normalizeCommandKey(commandPrefix[1]);
        return key ? { type: 'command', key } : null;
      }
      const featurePrefix = lower.match(/^(?:fitur|feature|grup|group):(.*)$/);
      if (featurePrefix) {
        const key = normalizeFeatureKey(featurePrefix[1]);
        return key ? { type: 'feature', key } : null;
      }
      // Token berawalan . ! / dipaksa sebagai perintah, mis. ".fitur off .news".
      if (/^[./!]/.test(value)) {
        const key = normalizeCommandKey(value);
        if (key) return { type: 'command', key };
      }
      // Nama perintah diprioritaskan supaya bisa dimatikan satu per satu.
      const cmd = normalizeCommandKey(value);
      if (cmd) return { type: 'command', key: cmd };
      const feature = normalizeFeatureKey(value);
      if (feature) return { type: 'feature', key: feature };
      return null;
    };

    const featureKeys = [];
    const commandKeys = [];
    const unknown = [];
    let all = false;
    for (const raw of rawKeys) {
      const lower = String(raw || '').toLowerCase();
      if (['all', 'semua', '*'].includes(lower)) {
        all = true;
        continue;
      }
      const target = parseTarget(raw);
      if (!target) {
        unknown.push(raw);
        continue;
      }
      if (target.type === 'command') {
        if (!commandKeys.includes(target.key)) commandKeys.push(target.key);
      } else if (!featureKeys.includes(target.key)) {
        featureKeys.push(target.key);
      }
    }

    if (unknown.length) {
      await wa.sendText(
        chat,
        `❌ Fitur/perintah tidak dikenal: ${unknown.join(', ')}\n\n` +
          'Fitur yang tersedia:\n' +
          features.map((f) => `• ${f.key} — ${f.label}`).join('\n') +
          '\n\nPerintah bisa dimatikan satu per satu, mis. .fitur off news\n' +
          'Untuk seluruh kelompok: .fitur off fitur:news',
        m
      );
      return;
    }

    if (all) featureKeys.splice(0, featureKeys.length, ...features.map((f) => f.key));
    if (!featureKeys.length && !commandKeys.length) {
      await wa.sendText(chat, summary(), m);
      return;
    }

    for (const key of featureKeys) {
      await this.store.setFeatureEnabled(chat, key, on);
    }
    for (const key of commandKeys) {
      await this.store.setCommandEnabled(chat, key, on);
    }

    const labels = [
      ...featureKeys.map((key) => `Fitur ${featureLabel(key)}`),
      ...commandKeys.map((key) => `Perintah .${key}`),
    ];
    await wa.sendText(
      chat,
      `${on ? '✅' : '❎'} ${on ? 'Diaktifkan' : 'Dinonaktifkan'}: ` +
        labels.join(', ') +
        (on
          ? ''
          : '\nItem tersebut sekarang hilang dari .help dan perintahnya ditolak.'),
      m
    );
  }

  async handleGroupParticipantsUpdate(ev) {
    try {
      await this.welcome.handle(this.sock, ev);
    } catch (err) {
      log.error('[WELCOME] error:', err.message);
    }
  }

  async handleMessage(m) {
    if (!this.ready()) return;
    if (!m || !m.message) return;
    if (m.key && m.key.fromMe) return;

    const chat = m.key.remoteJid;
    if (!chat) return;

    // Status biasa bukan pesan untuk bot. Tag status yang benar-benar
    // menyebut bot bisa datang sebagai status@broadcast (dengan flag
    // isMentionedInStatus) atau sebagai pesan mention di chat pribadi/grup.
    if (this.isStatusMention(m, m.message)) {
      await this.handleStatusMention(m);
      return;
    }
    if (chat === 'status@broadcast') return;

    const content = wa.contentOf(m);
    if (!content) return;

    let txt = extractText(m, content);
    const origTxt = txt;
    const sender = m.key.participant || chat;
    // Baileys modern memakai LID sebagai participant. Nomor telepon asli ada di
    // participantPn/participantAlt/remoteJidAlt, jadi owner tetap dikenali
    // walaupun OWNER_NUMBER diisi nomor telepon biasa.
    const ownerCandidates = [
      sender,
      m.key.participantPn,
      m.key.participantAlt,
      m.key.remoteJidAlt,
      m.key.remoteJidPn,
      m.key.senderPn,
      m.key.senderLid,
    ].filter(Boolean);
    let isOwner = this.owner.isOwnerAny(ownerCandidates, chat);

    // Fallback untuk chat pribadi yang hanya membawa @lid: resolve ke nomor
    // telepon owner. Tanpa ini, mode dewasa (hot) tidak pernah aktif.
    if (!isOwner && !isGroupJid(chat)) {
      for (const cand of ownerCandidates.slice()) {
        if (!String(cand).endsWith('@lid')) continue;
        const pn = await resolveLidToPn(this.sock, cand);
        if (!pn) continue;
        ownerCandidates.push(pn);
        if (this.owner.isOwner(pn, chat)) {
          isOwner = true;
          break;
        }
      }
    }
    this.owner.debugLog(sender, chat, isOwner);

    // Parser perintah tunggal: !help, /help, .help, atau "tsukasa help".
    const parsed = normalizeCommand(parseCommand(origTxt, this.cfg.trigger));
    // Abaikan prefix yang isinya bukan nama perintah (mis. "..." atau "!!").
    const explicitCmd = Boolean(
      parsed && parsed.explicit && parsed.cmd && /^[a-z0-9]/i.test(parsed.cmd)
    );
    const knownCmd = Boolean(parsed && parsed.cmd && KNOWN_COMMANDS.has(parsed.cmd));
    const isCmd = Boolean(explicitCmd || knownCmd);
    const cmdName = isCmd && parsed ? parsed.cmd : '';
    const cmdRest = isCmd && parsed ? parsed.rest : '';

    if (isCmd) {
      metrics.inc('commands');
      if (isOwner) {
        metrics.inc('ownerCommands');
        // Audit hanya command owner, tanpa menyimpan isi command sensitif.
        if (this.audit) {
          this.audit
            .record({ chat, sender, command: cmdName, rest: cmdRest })
            .catch(() => {});
        }
      }
    }

    // Fitur yang dimatikan admin grup lewat `.fitur` langsung ditolak di sini.
    // Override bisa per fitur/kelompok atau per perintah (`cmd:<nama>`).
    // `.help`, `.fitur`, dan perintah owner tidak termasuk katalog sehingga
    // tetap bisa dipakai untuk mengaktifkan kembali fitur.
    const commandFeature = cmdName ? featureForCommand(cmdName) : '';
    const commandBlocked = Boolean(
      isCmd && cmdName && isGroupJid(chat) && !this.store.isCommandEnabled(chat, cmdName)
    );
    const featureBlocked = Boolean(
      isCmd &&
        commandFeature &&
        isGroupJid(chat) &&
        !this.store.isFeatureEnabled(chat, commandFeature)
    );
    if (commandBlocked || featureBlocked) {
      const text = commandBlocked
        ? `🔒 Perintah *${cmdName}* sedang dimatikan di grup ini oleh admin.`
        : `🔒 Fitur *${featureLabel(commandFeature)}* sedang dimatikan di grup ini oleh admin.`;
      await wa.sendText(chat, text, m).catch(() => {});
      return;
    }

    // AFK: cabut status saat user aktif kembali, dan beri tahu jika ada
    // member AFK yang di-mention/di-reply. Command .afk/.back dikecualikan.
    if (!(isCmd && AfkFeature.isCommand(cmdName))) {
      await this.afk.observe(chat, m, content).catch(() => {});
    }

    // Moderasi ringan (antilink/antispam) untuk pesan biasa di grup.
    // Perintah yang dikenal dikecualikan supaya admin tetap bisa memakai bot,
    // tetapi teks berawalan "!" yang bukan perintah tetap ikut dimoderasi.
    if (!knownCmd && !isOwner && isGroupJid(chat) && !kaguya.hasCommand(cmdName)) {
      if (await this.guard.handleMessage(this.sock, m, content, origTxt)) return;
    }

    // Perintah verif/UP dan kelola akun detector (bisa tanpa trigger di grup).
    if (isCmd && (VerifFeature.isCommand(cmdName) || TikTokAdminFeature.isCommand(cmdName))) {
      if (await this.verif.handle(this.sock, m, cmdName, cmdRest, isOwner)) return;
      if (await this.tiktokAdmin.handle(this.sock, m, cmdName, cmdRest, isOwner)) return;
    }

    // Moderasi grup: antilink, antispam, jadwal buka/tutup.
    if (isCmd && GroupGuard.isCommand(cmdName)) {
      if (await this.guard.handleCommand(this.sock, m, cmdName, cmdRest, isOwner)) return;
    }

    // "Tsukasa hot on/off/status" dan "Tsukasa mode dewasa ..." (owner DM).
    const adultCmd = parseTriggerAdultCommand(origTxt, this.cfg.trigger);
    if (adultCmd !== null) {
      await this.handleAdultMode(chat, m, isOwner, adultCmd);
      return;
    }

    const quoted = wa.quotedContent(wa.contextInfoOf(content));
    const q = quotedInfo(quoted);
    if (q.img || q.aud || q.text) {
      log.info(
        `[REPLY] chat=${chat} quoted{img:${q.img} aud:${q.aud} textLen:${q.text.length}}`
      );
    }

    // PRIORITAS TERTINGGI: image generation
    if (await this.imggen.handle(this.sock, m, content, origTxt)) return;

    const bang = isCmd ? { cmd: cmdName, rest: cmdRest, rawRest: parsed.rawRest } : null;
    // Simpan metadata pesan di memori untuk fitur rangkuman & statistik.
    // Tidak ditulis ke disk dan tidak dipakai untuk membalas otomatis.
    this.groupTools.recordMessage(chat, sender, txt, { isCommand: Boolean(bang) });
    // Statistik top-aktif persisten. Hitung obrolan biasa (bukan perintah)
    // supaya leaderboard mencerminkan keaktifan chat, bukan spam command.
    if (!bang && isGroupJid(chat)) {
      this.store.recordActivity(
        chat,
        sender,
        memory.getUserName(sender) || String(m.pushName || '').trim()
      );
    }

    if (bang) {
      if (AfkFeature.isCommand(bang.cmd)) {
        await this.afk.handleCommand(chat, m, bang.cmd, bang.rest, sender);
        return;
      }

      if (bang.cmd === 'ping') {
        const rawTs = m.messageTimestamp;
        const sec =
          typeof rawTs === 'number'
            ? rawTs
            : rawTs && typeof rawTs.toNumber === 'function'
              ? rawTs.toNumber()
              : Number(rawTs);
        const latency =
          Number.isFinite(sec) && sec > 0 ? Math.max(0, Date.now() - sec * 1000) : 0;
        const lines = ['🏓 *Pong!*'];
        if (latency > 0) lines.push(`• Respon: ${latency} ms`);
        lines.push(`• Uptime: ${this.formatUptime(process.uptime())}`);
        await wa.sendText(chat, lines.join('\n'), m);
        return;
      }

      if (bang.cmd === 'health' || bang.cmd === 'status') {
        await wa.sendText(chat, this.healthReport(), m);
        return;
      }

      if (bang.cmd === 'modegrup' || bang.cmd === 'groupmode') {
        if (!isGroupJid(chat)) {
          await wa.sendText(chat, 'Perintah ini hanya berlaku di grup.', m);
          return;
        }
        const allowed = isOwner || (await this.peraturan.isAdmin(this.sock, chat, sender));
        if (!allowed) {
          await wa.sendText(chat, 'Perintah ini khusus admin grup atau owner bot.', m);
          return;
        }
        const labels = {
          all: 'balas semua pesan',
          reply: 'balas saat pesan di-reply (sebut tsukasa atau balas pesan bot)',
          call: 'balas hanya saat dipanggil tsukasa',
        };
        const help =
          '⚙️ *Mode Balasan Grup*\n' +
          '• .modegrup all — balas semua pesan\n' +
          '• .modegrup reply — balas saat pesan di-reply dan menyebut tsukasa (atau reply pesan bot)\n' +
          '• .modegrup call — balas hanya saat dipanggil tsukasa (default)\n' +
          '• .modegrup status — lihat mode aktif';
        const sub = String(bang.rest || '').trim().toLowerCase();
        const map = {
          all: 'all',
          semua: 'all',
          reply: 'reply',
          balas: 'reply',
          call: 'call',
          panggil: 'call',
          trigger: 'call',
          tsukasa: 'call',
        };
        if (!sub || sub === 'status') {
          const current = this.store.getGroupMode(chat);
          await wa.sendText(
            chat,
            `⚙️ Mode balasan grup ini: *${current}* (${labels[current]})\n\n${help}`,
            m
          );
          return;
        }
        const mode = map[sub];
        if (!mode) {
          await wa.sendText(chat, help, m);
          return;
        }
        const saved = await this.store.setGroupMode(chat, mode);
        await wa.sendText(
          chat,
          `✅ Mode balasan grup disetel ke *${saved}* (${labels[saved]}).`,
          m
        );
        return;
      }

      if (
        bang.cmd === 'welcome' ||
        bang.cmd === 'sambutan' ||
        bang.cmd === 'goodbye' ||
        bang.cmd === 'selamattinggal' ||
        bang.cmd === 'pamit' ||
        bang.cmd === 'bye'
      ) {
        const allowed = isOwner || (await this.peraturan.isAdmin(this.sock, chat, sender));
        await this.welcome.handleCommand(
          this.sock,
          m,
          bang.cmd,
          bang.rest,
          bang.rawRest,
          allowed,
          isOwner
        );
        return;
      }

      if (bang.cmd === 'backup') {
        if (!isOwner) {
          await wa.sendText(chat, 'Perintah ini khusus owner.', m);
          return;
        }
        if (!this.backup) {
          await wa.sendText(chat, 'Fitur backup tidak tersedia.', m);
          return;
        }
        const sub = String(bang.rest || '').trim().toLowerCase();
        if (sub === 'run' || sub === 'now' || sub === 'sekarang') {
          await wa.sendText(chat, '💾 Menjalankan backup sesi...', m).catch(() => {});
          const res = await this.backup.runNow();
          if (res.ok) {
            await wa.sendText(
              chat,
              `✅ Backup selesai: ${res.files} file (${Math.round(
                (res.durationMs || 0) / 1000
              )} detik)\n${res.path}`,
              m
            );
          } else {
            await wa.sendText(chat, `❌ Backup gagal: ${res.reason || 'unknown'}`, m);
          }
          return;
        }
        const st = this.backup.status();
        const lines = [
          '💾 *Session Backup*',
          `• Status   : ${st.enabled ? (st.running ? 'sedang berjalan' : 'aktif') : 'nonaktif'}`,
          `• Folder   : ${st.dir}`,
          `• Interval : ${st.intervalH} jam`,
          `• Disimpan : ${st.keep} backup terakhir`,
        ];
        if (st.last) {
          lines.push(
            `• Terakhir : ${formatDateTime(st.last.at, this.cfg.timezone)} (${st.last.files} file)`
          );
        }
        if (st.lastError) lines.push(`• Error    : ${st.lastError}`);
        lines.push('', 'Gunakan .backup run untuk backup sekarang.');
        await wa.sendText(chat, lines.join('\n'), m);
        return;
      }

      if (bang.cmd === 'audit') {
        if (!isOwner) {
          await wa.sendText(chat, 'Perintah ini khusus owner.', m);
          return;
        }
        if (!this.audit) {
          await wa.sendText(chat, 'Fitur audit tidak tersedia.', m);
          return;
        }
        const sub = String(bang.rest || '').trim().toLowerCase();
        if (sub === 'clear' || sub === 'hapus' || sub === 'reset') {
          await this.audit.clear();
          await wa.sendText(chat, '🗑️ Audit log dibersihkan.', m);
          return;
        }
        const limit = Math.max(1, Math.min(50, parseInt(sub, 10) || 10));
        const rows = await this.audit.recent(limit);
        if (rows.length === 0) {
          await wa.sendText(chat, '📝 Audit log masih kosong.', m);
          return;
        }
        const lines = ['📝 *Audit Command Owner*'];
        for (const row of rows) {
          const when = formatDateTime(row.at, this.cfg.timezone);
          const rest = row.rest ? ` → ${row.rest}` : '';
          lines.push(`• ${when} | ${row.command}${rest} | ${userPart(row.sender) || '-'}`);
        }
        await wa.sendText(chat, lines.join('\n'), m);
        return;
      }

      if (bang.cmd === 'help' || bang.cmd === 'menu') {
        const usedPrefix = /^[.!/]/.test(origTxt) ? origTxt[0] : '.';
        const builtinCategories = featureList()
          .filter((f) => !isGroupJid(chat) || this.store.isFeatureEnabled(chat, f.key))
          .map((f) => ({
            key: f.key,
            label: f.label,
            description: f.description,
            commands: f.commands.filter(
              (cmd) => !isGroupJid(chat) || this.store.isCommandEnabled(chat, cmd)
            ),
          }))
          .filter((f) => f.commands.length);

        if (bang.cmd === 'menu') {
          const menu = kaguya.formatMenu({
            category: bang.rest,
            isOwner,
            prefix: usedPrefix,
            builtinCategories,
            userName:
              memory.getUserName(sender) || String(m.pushName || '').trim() || jidUser(sender),
            uptime: this.formatUptime(process.uptime()),
          });

          // Banner hanya untuk menu utama. Caption WhatsApp terbatas, jadi
          // gambar dikirim dulu lalu katalog teks menyusul.
          if (!String(bang.rest || '').trim()) {
            const imageUrl = String(process.env.MENU_IMAGE_URL || '').trim();
            if (imageUrl) {
              try {
                const res = await fetch(imageUrl, {
                  signal: AbortSignal.timeout(15000),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const type = String(res.headers.get('content-type') || '');
                if (!/^image\//i.test(type)) {
                  throw new Error(`bukan gambar (${type || 'tanpa content-type'})`);
                }
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length > 8 * 1024 * 1024) throw new Error('gambar terlalu besar');
                await wa.sendImage(chat, buf, '', m, type);
              } catch (err) {
                log.warn('[MENU] banner gagal dimuat:', err && err.message ? err.message : err);
              }
            }
          }

          await wa.sendText(
            chat,
            menu ||
              `Kategori *${String(bang.rest || '').trim()}* tidak ditemukan.\nCoba ${usedPrefix}menu atau ${usedPrefix}menu all.`,
            m
          );
          return;
        }

        await wa.sendText(
          chat,
          kaguya.formatHelp({ query: bang.rest, prefix: usedPrefix, builtinCategories }),
          m
        );
        return;
      }

      if (bang.cmd === 'fitur' || bang.cmd === 'feature' || bang.cmd === 'features' || bang.cmd === 'togglefitur') {
        if (!isGroupJid(chat)) {
          await wa.sendText(chat, 'Perintah .fitur hanya berlaku di dalam grup.', m);
          return;
        }
        const allowed = isOwner || (await this.peraturan.isAdmin(this.sock, chat, sender));
        if (!allowed) {
          await wa.sendText(chat, 'Perintah ini khusus admin grup atau owner bot.', m);
          return;
        }
        await this.handleFiturCommand(chat, m, bang.rest);
        return;
      }

      if (bang.cmd === 'whoami') {
        const userName = memory.getUserName(sender) || '';
        let who = `Sender: ${sender}\nChat  : ${chat}`;
        if (userName) who += `\nNama tersimpan: ${userName}`;
        await wa.sendText(chat, who, m);
        return;
      }

      if (bang.cmd === 'cn') {
        await this.cn.handle(this.sock, m, bang.rest);
        return;
      }

      if (bang.cmd === 's' || StickerReplyFeature.isCommand(bang.cmd)) {
        if (await this.stickerReply.handleCommand(this.sock, m, content, bang.cmd, bang.rest)) {
          return;
        }
      }

      if (StickerUtilsFeature.isCommand(bang.cmd)) {
        if (await this.stickerUtils.handle(this.sock, m, content, bang.cmd, bang.rest)) {
          return;
        }
      }

      if (StickerTransformFeature.isCommand(bang.cmd)) {
        if (await this.stickerTransform.handle(this.sock, m, content, bang.cmd, bang.rest)) {
          return;
        }
      }

      if (ConfigFeature.isCommand(bang.cmd)) {
        if (await this.configCmd.handle(this.sock, m, bang.rest, isOwner)) return;
      }

      if (UpdateFeature.isCommand(bang.cmd)) {
        if (await this.updateCmd.handle(this.sock, m, bang.rest, isOwner)) return;
      }

      if (PanelFeature.isCommand(bang.cmd)) {
        if (await this.panel.handle(this.sock, m, bang.rest, isOwner)) return;
      }

      if (bang.cmd === 'ingatkan' || bang.cmd === 'remind' || bang.cmd === 'pengingat') {
        if (await this.groupTools.handleReminder(this.sock, m, bang.rest)) return;
      }

      if (bang.cmd === 'poll' || bang.cmd === 'voting') {
        if (await this.groupTools.handlePoll(this.sock, m, bang.rest)) return;
      }

      if (bang.cmd === 'rangkum' || bang.cmd === 'ringkas' || bang.cmd === 'summary') {
        if (await this.groupTools.handleSummary(this.sock, m, bang.rest)) return;
      }

      if (bang.cmd === 'statistik' || bang.cmd === 'stats' || bang.cmd === 'stat') {
        if (await this.groupTools.handleStats(this.sock, m)) return;
      }

      if (bang.cmd === 'topaktif' || bang.cmd === 'topactive' || bang.cmd === 'topchat') {
        if (await this.groupTools.handleTopActive(this.sock, m, bang.rest, isOwner)) return;
      }

      if (bang.cmd === 'anime') {
        const animeSub = String(bang.rest || '').trim().split(/\s+/)[0].toLowerCase();
        if (['episode', 'stream', 'download', 'unduh'].includes(animeSub)) {
          const gate = this.heavyGate(
            chat,
            'anime-download',
            this.cfg.rateLimit && this.cfg.rateLimit.downloadSec
          );
          if (!gate.allowed) {
            await this.denyHeavy(chat, gate, m, 'anime download');
            return;
          }
        }
        if (await this.anime.handle(this.sock, m, `!${bang.cmd}${bang.rest ? ` ${bang.rest}` : ''}`)) return;
      }

      if (bang.cmd === 'info') {
        if (await this.info.handle(this.sock, m, `!${bang.cmd}${bang.rest ? ` ${bang.rest}` : ''}`)) return;
      }

      if (NewsFeature.isCommand(bang.cmd)) {
        const key = bang.cmd === 'cosplay' ? 'cosplay' : 'news';
        const firstArg = String(bang.rest || '').trim().split(/\s+/)[0].toLowerCase();
        const cosplayConfig =
          bang.cmd === 'cosplay' &&
          [
            'add', 'tambah', 'simpan',
            'del', 'remove', 'hapus',
            'list', 'daftar',
            'on', 'off', 'aktif', 'mati',
            'every', 'interval',
          ].includes(firstArg);
        if (!cosplayConfig) {
          const gate = this.heavyGate(
            chat,
            `news-${key}`,
            this.cfg.rateLimit && this.cfg.rateLimit.newsSec
          );
          if (!gate.allowed) {
            await this.denyHeavy(chat, gate, m, bang.cmd);
            return;
          }
        }
        if (await this.news.handle(this.sock, m, bang.cmd, bang.rest, isOwner)) return;
      }

      if (bang.cmd === 'animechannel' || bang.cmd === 'anime-channel') {
        const parts = String(bang.rest || '').trim().split(/\s+/).filter(Boolean);
        const sub = (parts[0] || 'status').toLowerCase();
        const group = isGroupJid(chat);
        const allowed =
          isOwner || (group && (await this.peraturan.isAdmin(this.sock, chat, sender)));
        if (!allowed) {
          await wa.sendText(chat, 'Perintah ini khusus owner atau admin grup.', m);
          return;
        }
        if (!this.animeChannel) {
          await wa.sendText(chat, 'Fitur auto-post anime tidak tersedia.', m);
          return;
        }
        if (['test', 'post', 'news', 'berita', 'info', 'cosplay'].includes(sub)) {
          const gate = this.heavyGate(
            chat,
            `channel-${sub}`,
            this.cfg.rateLimit && this.cfg.rateLimit.channelSec
          );
          if (!gate.allowed) {
            await this.denyHeavy(chat, gate, m, `animechannel ${sub}`);
            return;
          }
        }
        if (sub === 'status') {
          await wa.sendText(chat, this.animeChannel.formatStatus(), m);
          return;
        }
        if (sub === 'check' || sub === 'cek') {
          const title = parts.slice(1).join(' ').trim();
          if (!title) {
            await wa.sendText(chat, 'Gunakan: !animechannel check <judul anime>', m);
            return;
          }
          const res = this.animeChannel.checkTitle(title);
          if (res.posted) {
            const at = res.at ? formatDateTime(res.at, this.cfg.timezone) : '-';
            await wa.sendText(
              chat,
              `🔁 *Sudah pernah diposting*: ${title}\nTerakhir: ${at}\nKey: ${res.key}`,
              m
            );
          } else {
            await wa.sendText(chat, `🆕 *Belum pernah diposting*: ${title}`, m);
          }
          return;
        }
        if (sub === 'info' || sub === 'jejepangan' || sub === 'japan') {
          try {
            const res = await this.animeChannel.postOne({
              force: true,
              type: 'info',
              reason: 'manual-info',
            });
            if (res.ok) {
              await wa.sendText(
                chat,
                `✅ Info Jejepangan terkirim ke channel: *${res.item.title}* (${res.mode}).`,
                m
              );
            } else {
              await wa.sendText(chat, `ℹ️ Tidak ada post: ${res.message}`, m);
            }
          } catch (err) {
            await wa.sendText(chat, `❌ Gagal post info ke channel: ${err.message}`, m);
          }
          return;
        }
        if (sub === 'test' || sub === 'post') {
          try {
            const res = await this.animeChannel.postOne({ force: true, reason: 'manual' });
            if (res.ok) {
              const kind =
                res.type === 'info'
                  ? 'Info Jejepangan'
                  : res.type === 'news'
                    ? 'Berita bergambar'
                    : res.type === 'cosplay'
                      ? 'Cosplay'
                      : 'Anime';
              await wa.sendText(
                chat,
                `✅ ${kind} terkirim ke channel: *${res.item.title}* (${res.mode}).\nSumber: ${res.item.sourceLabel || '-'}`,
                m
              );
            } else {
              await wa.sendText(chat, `ℹ️ Tidak ada post: ${res.message}`, m);
            }
          } catch (err) {
            await wa.sendText(chat, `❌ Gagal post ke channel: ${err.message}`, m);
          }
          return;
        }
        if (sub === 'news' || sub === 'berita') {
          try {
            const res = await this.animeChannel.postOne({
              force: true,
              type: 'news',
              reason: 'manual-news',
            });
            if (res.ok) {
              await wa.sendText(
                chat,
                `✅ Berita terkirim ke channel: *${res.item.title}* (${res.mode}).`,
                m
              );
            } else {
              await wa.sendText(chat, `ℹ️ Tidak ada berita: ${res.message}`, m);
            }
          } catch (err) {
            await wa.sendText(chat, `❌ Gagal post berita ke channel: ${err.message}`, m);
          }
          return;
        }
        if (sub === 'cosplay' || sub === 'cosplayer') {
          try {
            const res = await this.animeChannel.postOne({
              force: true,
              type: 'cosplay',
              reason: 'manual-cosplay',
            });
            if (res.ok) {
              await wa.sendText(
                chat,
                `✅ Cosplay terkirim ke channel: *${res.item.title}* (${res.mode}).`,
                m
              );
            } else {
              await wa.sendText(
                chat,
                `ℹ️ Tidak ada post cosplay: ${res.message}\nIsi COSPLAY_POSTS/COSPLAY_RSS di .env.`,
                m
              );
            }
          } catch (err) {
            await wa.sendText(chat, `❌ Gagal post cosplay ke channel: ${err.message}`, m);
          }
          return;
        }
        await wa.sendText(
          chat,
          'Gunakan:\n' +
            '!animechannel status\n' +
            '!animechannel test\n' +
            '!animechannel news\n' +
            '!animechannel info\n' +
            '!animechannel cosplay\n' +
            '!animechannel check <judul>',
          m
        );
        return;
      }

      if (bang.cmd === 'peraturan') {
        if (await this.peraturan.tryCommand(this.sock, m, bang.rest, isOwner)) return;
      }

      if (bang.cmd === 'geminikey' || bang.cmd === 'gkey') {
        if (!isOwner) {
          await wa.sendText(chat, 'Perintah ini khusus owner.', m);
          return;
        }
        const parts = String(bang.rest || '').trim().split(/\s+/).filter(Boolean);
        const sub = (parts[0] || 'list').toLowerCase();
        if (sub === 'list') {
          const ks = llm.getKeyList();
          await wa.sendText(chat, 'Gemini keys: ' + ks.length + '\n' + ks.map((k,i)=>(i+1)+'. '+k.slice(0,8)+'...').join('\n'), m);
          return;
        }
        if (sub === 'add') {
          const k = parts[1];
          if (!k) { await wa.sendText(chat, 'Gunakan: !geminikey add <key>', m); return; }
          const ok = llm.addKey(k);
          await wa.sendText(chat, ok ? 'Key ditambahkan.' : 'Key sudah ada/invalid.', m);
          return;
        }
        if (sub === 'remove' || sub === 'del') {
          const k = parts[1];
          if (!k) { await wa.sendText(chat, 'Gunakan: !geminikey remove <key>', m); return; }
          const ok = llm.removeKey(k);
          await wa.sendText(chat, ok ? 'Key dihapus (runtime).' : 'Key tidak ditemukan di runtime.', m);
          return;
        }
        await wa.sendText(chat, 'Gunakan: !geminikey list|add <key>|remove <key>', m);
        return;
      }

      if (bang.cmd === 'hot') {
        await this.handleAdultMode(chat, m, isOwner, bang.rest || 'on');
        return;
      }

      if (bang.cmd === 'tsukasa') {
        const parts = String(bang.rest || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2 && parts[0].toLowerCase() === 'persona') {
          let p = String(parts[1] || '').toLowerCase();
          if (p === '1') p = 'tsukasa1';
          if (p === '2') p = 'tsukasa2';
          if (p !== 'tsukasa1' && p !== 'tsukasa2') {
            await wa.sendText(chat, 'Persona tidak valid. Gunakan: tsukasa1 atau tsukasa2.', m);
            return;
          }
          try {
            await this.store.setPersona(chat, p);
            await wa.sendText(chat, `Persona disetel ke ${p} untuk chat ini.`, m);
          } catch (err) {
            await wa.sendText(chat, err.message, m);
          }
          return;
        }
        const isAdultMode =
          (parts[0].toLowerCase() === 'mode' &&
            ['dewasa', 'adult', 'hot', 'ecchi'].includes((parts[1] || '').toLowerCase())) ||
          parts[0].toLowerCase() === 'hot';
        if (isAdultMode) {
          const arg =
            parts[0].toLowerCase() === 'hot'
              ? parts.slice(1).join(' ')
              : parts.slice(2).join(' ');
          await this.handleAdultMode(chat, m, isOwner, arg || (parts[0].toLowerCase() === 'hot' ? 'on' : 'status'));
          return;
        }
        if (
          parts.length >= 3 &&
          parts[0].toLowerCase() === 'mode' &&
          parts[1].toLowerCase() === 'pro'
        ) {
          const on = parts[2].toLowerCase() === 'on' || parts[2].toLowerCase() === 'enable';
          await this.store.setPro(chat, on);
          await wa.sendText(
            chat,
            on ? 'Mode Pro diaktifkan (persist).' : 'Mode Pro dimatikan (persist).',
            m
          );
          return;
        }
        await wa.sendText(
          chat,
          'Gunakan: !tsukasa persona tsukasa1|tsukasa2, !tsukasa mode pro on|off, atau !tsukasa mode dewasa on|off',
          m
        );
        return;
      }

      if (kaguya.hasCommand(bang.cmd)) {
        const usedPrefix = /^[.!/]/.test(origTxt) ? origTxt[0] : '.';
        const isAdmin =
          isOwner ||
          (isGroupJid(chat) && (await this.peraturan.isAdmin(this.sock, chat, sender)));
        const handled = await kaguya.dispatch({
          sock: this.sock,
          raw: m,
          cfg: this.cfg,
          command: bang.cmd,
          rest: bang.rest,
          prefix: usedPrefix,
          chat,
          sender,
          isOwner,
          isAdmin,
          isPremium: false,
          reply: (text) => wa.sendText(chat, text, m),
        });
        if (handled) return;
      }
    }

    // Plugin pasif Kaguya: jawaban game yang butuh reply (family100, tebak,
    // adu, dll), captcha, menfess, autodl, JPM. Dijalankan sebelum gate mode
    // grup dan sebelum AI, supaya Tsukasa tidak ikut membalas jawaban tersebut
    // di mode all/reply.
    if (!bang) {
      const usedPrefix = /^[.!/]/.test(origTxt) ? origTxt[0] : '.';
      const passiveHandled = await kaguya.dispatchPassive({
        sock: this.sock,
        raw: m,
        cfg: this.cfg,
        chat,
        sender,
        text: origTxt,
        prefix: usedPrefix,
        isOwner,
        isAdmin: isOwner,
        isPremium: false,
        reply: (text) => wa.sendText(chat, text, m),
      });
      if (passiveHandled) return;
    }

    // Moderation peraturan (berjalan untuk semua teks di grup).
    // Perintah bang dan pesan owner tidak perlu dimoderasi.
    if (!bang && !isOwner) {
      this.peraturan.handleMessage(this.sock, m, origTxt).catch(() => {});
    }

    const cmd = bang ? bang.cmd : '';
    const isGroup = isGroupJid(chat);
    const hasTrig = this.reTrig.test(origTxt);
    const isTagAllCmd = isCmd && cmd === 'tagall';
    const isRvoCmd = isCmd && cmd === 'rvo';

    // Mode balasan per grup (diatur admin lewat .modegrup).
    // all = balas semua, reply = harus reply + trigger, call = harus trigger.
    const groupMode = isGroup ? this.store.getGroupMode(chat) : 'all';
    const modeAll = !isGroup || groupMode === 'all';

    const qCtx = wa.contextInfoOf(content);
    const hasQuoted = q.img || q.aud || q.vid || q.doc || q.sticker || q.text !== '';
    // Di mode `reply`, membalas pesan bot sendiri tetap dilayani tanpa harus
    // menyebut trigger. Ini perilaku lama yang sempat hilang.
    const quotedFromBot = hasQuoted && this.isQuotedFromBot(qCtx);
    const replyModeReply = groupMode === 'reply' && quotedFromBot;
    if (hasQuoted && !hasTrig && !isCmd) {
      // Chat pribadi: balasan ke pesan apa pun tetap dilayani. Di grup,
      // mode all membalas semua quote; mode reply menunggu reply ke bot;
      // mode call menunggu trigger.
      if (!modeAll && !replyModeReply) return;
    }

    const hasImage = Boolean(content.imageMessage);
    const hasVideo = Boolean(content.videoMessage);
    if (isGroup && (hasImage || hasVideo) && !hasTrig && !isCmd && !modeAll && !replyModeReply) {
      return;
    }

    // TikTok text termasuk matchedText dari preview link
    let tiktokText = origTxt;
    let hasTrigTikTok = hasTrig;
    if (content.extendedTextMessage) {
      const ext = content.extendedTextMessage;
      if (ext.matchedText) {
        tiktokText += ' ' + ext.matchedText;
        if (this.reTrig.test(ext.matchedText)) hasTrigTikTok = true;
      }
      if (ext.text && this.reTrig.test(ext.text)) hasTrigTikTok = true;
    }

    // RVO & tagall. Tagall hanya boleh dipakai admin grup/owner.
    const tagAllRequested =
      isGroup && (isTagAllCmd || (hasTrig && /\btagall\b/i.test(origTxt)));
    if (!isGroup || hasTrig || tagAllRequested || isRvoCmd) {
      if (await this.rvo.handle(this.sock, m, content)) return;
      if (tagAllRequested) {
        const canTagAll = isOwner || (await this.peraturan.isAdmin(this.sock, chat, sender));
        if (!canTagAll) {
          await wa.sendText(
            chat,
            '⚠️ `.tagall` hanya bisa dipakai oleh admin grup atau owner bot.',
            m
          );
          return;
        }
      }
      if (await this.tagall.handle(this.sock, m, content)) return;
    }

    // TikTok
    try {
      const ttUrls = await tiktok.detectTikTokUrls(tiktokText);
      const allowTikTok = !isGroup || hasTrigTikTok || ttUrls.length > 0;
      if (allowTikTok && ttUrls.length > 0) {
        await this.handleTikTok(chat, m, ttUrls);
        return;
      }
    } catch (err) {
      log.error(`[TIKTOK] baca link gagal: ${shortError(err)}`);
    }

    // Perintah bang (!ba, !pap, !s, !stiker, dll) juga harus jalan di grup
    // walaupun tidak ada trigger.
    const allowNonCmd = !isGroup || hasTrig || isCmd || modeAll;
    // Fitur yang dimatikan juga tidak boleh dijalankan lewat bentuk natural
    // ("tsukasa brat ..."), bukan hanya lewat perintah berawalan titik.
    const featureOn = (key) => !isGroup || this.store.isFeatureEnabled(chat, key);
    if (allowNonCmd) {
      if (featureOn('media')) {
        if (await this.pap.handle(chat, m, content, origTxt)) return;
        if (await this.ba.handle(chat, m, content, origTxt)) return;
        if (await this.hijab.handle(this.sock, m, content, origTxt)) return;
      }
      if (featureOn('brat') && (await this.brat.handle(this.sock, m, content, origTxt))) return;
      if (featureOn('sticker')) {
        if (await this.stickerReply.handleAuto(this.sock, m, content)) return;
        if (await this.sticker.handle(this.sock, m, content, origTxt)) return;
      }
      if (featureOn('ai')) {
        if (await this.vision.handle(this.sock, m, content, origTxt)) return;
        if (await this.info.handle(this.sock, m, origTxt)) return;
        if (await this.tts.handle(this.sock, m, content, origTxt)) return;
      }
      if (featureOn('anime') && (await this.anime.handle(this.sock, m, origTxt))) return;
    }

    // VN selalu dicek (juga saat tidak ada teks)
    if (await this.vn.handle(this.sock, m, content, isOwner)) return;

    // Tentukan teks user tanpa awalan trigger, lalu tambahkan konteks quote
    // supaya AI tetap tahu pesan yang sedang dibalas.
    let userText = hasTrig && !isCmd ? stripLeadingTrigger(origTxt, this.cfg.trigger) : origTxt;
    userText = String(userText || '').trim();
    if (q.text) {
      if (!userText || RE_REPLY_CUE.test(userText)) {
        txt = q.text;
      } else {
        txt = `${userText}\n\nKonteks (pesan yang di-reply):\n${q.text}`;
      }
    } else {
      txt = userText;
    }

    // Mode balasan grup: call = harus dipanggil trigger; reply = harus reply
    // ke suatu pesan sekaligus menyebut trigger. Mode all tidak dibatasi.
    if (isGroup && !isTagAllCmd) {
      if (groupMode === 'call' && !hasTrig) return;
      if (groupMode === 'reply') {
        // Wajib berupa balasan/quote, lalu sebut trigger atau balas pesan bot.
        if (!hasQuoted) return;
        if (!hasTrig && !quotedFromBot) return;
      }
    }

    if (!String(txt).trim()) return;

    // Jika admin grup mematikan fitur AI, obrolan natural juga berhenti.
    // Perintah lain sudah ditangani/di-gate sebelum titik ini.
    if (isGroup && !this.store.isFeatureEnabled(chat, 'ai')) return;

    // Permintaan ubah nama
    const nameReq = memory.detectNameRequest(txt);
    if (nameReq) {
      memory.setUserName(sender, nameReq);
      const reply = `*Oke! Mulai sekarang aku akan memanggilmu ${nameReq}* ✨\n\n_Senang berkenalan denganmu, ${nameReq}!_ Aku Tsukasa, siap menemanimu~ 🌟`;
      const out = this.owner.decorate(isOwner, reply);
      await wa.sendText(chat, out.text, m, out.mentions);
      memory.saveTurn(chat, 'user', txt, nameReq);
      memory.saveTurn(chat, 'assistant', reply);
      return;
    }

    // AI chat
    const state = this.store.get(chat);

    // Fallback nama tampilan: pakai pushName WhatsApp jika user belum pernah
    // memperkenalkan diri. Supaya bot memanggil nama user yang sedang chat,
    // bukan menebak nama owner.
    if (!memory.getUserName(sender)) {
      const pushName = String(m.pushName || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
      if (pushName && !/^\+?\d[\d\s-]*$/.test(pushName)) {
        memory.setUserName(sender, pushName);
      }
    }
    const senderName =
      memory.getUserName(sender) || String(m.pushName || '').trim() || jidUser(sender);

    // Mode dewasa otomatis: hanya di chat pribadi owner. Jika owner memulai
    // percakapan hot, bot mengikuti selama 30 menit; "stop" mengembalikan normal.
    const ownerDm = isOwner && !isGroupJid(chat);
    let adult = ownerDm && state.adult;
    if (ownerDm && isStopCue(txt)) {
      if (state.adult) await this.store.setAdult(chat, false);
      adult = false;
      log.info(`[ADULT] nonaktif untuk chat=${chat}`);
    } else if (ownerDm && isHotCue(txt)) {
      // Aktif otomatis tanpa pemberitahuan di chat.
      adult = true;
      await this.store.setAdult(chat, true);
      log.info(`[ADULT] aktif untuk chat=${chat} sender=${sender}`);
    } else if (adult) {
      // Perpanjang selama owner masih mengobrol (sliding 30 menit).
      await this.store.refreshAdult(chat).catch(() => {});
    } else if (!isGroupJid(chat) && isHotCue(txt)) {
      log.info(
        `[ADULT] cue terdeteksi tapi bukan owner. chat=${chat} sender=${sender} ` +
          `kandidat=${ownerCandidates.join(',')}`
      );
    }

    // Suasana hati & kondisi waktu Tsukasa diperbarui otomatis dari obrolan.
    // Berlaku di semua chat (publik), tanpa pesan pemberitahuan ke chat.
    const { mood, timeCtx } = await this.updateEmotion(
      chat,
      txt,
      isOwner && !isGroupJid(chat)
    );
    const emotionPrompt = emotion.prompt(mood, timeCtx);

    const hist = memory.load(chat);
    const ctxTxt = memory.buildContext(hist, txt, sender);

    // Tier 2: AI boleh memilih aksi lewat tag [[...]]. Panggilan pertama
    // memakai tool prompt penuh (termasuk izin search).
    let rawReply = await llm.askAsPersona(
      this.cfg,
      state.persona,
      state.pro,
      ctxTxt,
      sender,
      adult,
      [emotionPrompt, this.aiTools.systemPrompt({ allowSearch: true })]
        .filter(Boolean)
        .join('\n\n'),
      isOwner
    );

    let aiParsed = this.aiTools.parse(rawReply);
    const searchReq = this.aiTools.searchRequest(aiParsed.actions);

    // Two-phase search: kalau model hanya minta cari, ambil hasil web lalu
    // panggil model sekali lagi tanpa izin search.
    if (searchReq) {
      const results = await this.aiTools.searchWeb(searchReq.arg);
      const searchCtx = [
        ctxTxt,
        '',
        `Hasil pencarian web untuk "${searchReq.arg}":`,
        results || '(tidak ada hasil yang ditemukan)',
        '',
        'Jawab pertanyaan user memakai hasil di atas. Sebutkan sumber bila relevan. Jangan memakai tag [[search:...]] lagi.',
      ].join('\n');
      rawReply = await llm.askAsPersona(
        this.cfg,
        state.persona,
        state.pro,
        searchCtx,
        sender,
        adult,
        [emotionPrompt, this.aiTools.systemPrompt({ allowSearch: false })]
          .filter(Boolean)
          .join('\n\n'),
        isOwner
      );
      aiParsed = this.aiTools.parse(rawReply);
    }

    const reply = String(aiParsed.text || '').trim();
    // AI boleh memecah balasan menjadi beberapa bubble dengan tag [[next]],
    // supaya terasa seperti orang chatting. Simpan riwayat sebagai satu turn.
    const bubbles = splitChatBubbles(reply, 4);
    memory.saveTurn(chat, 'user', txt, senderName);
    if (bubbles.length) memory.saveTurn(chat, 'assistant', bubbles.join('\n'));

    for (let i = 0; i < bubbles.length; i += 1) {
      const first = i === 0;
      const out = first
        ? this.owner.decorate(isOwner, bubbles[i])
        : { text: bubbles[i], mentions: [] };
      await wa.sendText(chat, out.text, first ? m : undefined, out.mentions);
      // Jeda kecil antarbubble agar terasa natural, bukan spam.
      if (i < bubbles.length - 1) {
        await new Promise((r) => setTimeout(r, 350 + Math.min(700, bubbles[i].length * 12)));
      }
    }
    await this.aiTools.run(chat, m, aiParsed.actions, txt);
  }

  /**
   * Perbarui suasana hati dan catatan waktu tidur Tsukasa dari pesan terakhir.
   * Dijalankan otomatis di semua chat, tanpa mengirim pemberitahuan apa pun.
   */
  async updateEmotion(chat, text, isOwner) {
    const now = Date.now();
    const timezone = (this.cfg && this.cfg.timezone) || 'Asia/Jakarta';

    // Catatan tidur bersifat global (satu tubuh, satu jadwal), bukan per chat.
    const sleep = emotion.trackSleep(this.store.getSleep(), now, timezone);
    await this.store.setSleep(sleep).catch(() => {});
    const timeCtx = emotion.timeContext(now, timezone, sleep);

    const prev = this.store.getEmotion(chat);
    // Sentuhan waktu dipakai untuk mendeteksi user yang lama pergi.
    const lastSeen = this.store.touchSeen(chat, now);
    const awayMinutes = lastSeen ? (now - lastSeen) / 60000 : 0;
    const detected = emotion.detect(text, {
      isOwner: Boolean(isOwner),
      previousMood: prev.mood,
      previousIntensity: prev.intensity,
      awayMinutes,
    });

    // Kalau sedang kurang tidur dan tidak ada emosi kuat dari obrolan, rasa
    // ngantuk/lelah otomatis muncul di chat mana pun.
    let base = detected ? emotion.merge(prev, detected, now) : prev;
    const weak = !base || base.mood === 'netral' || Number(base.intensity) < 0.45;
    if (timeCtx.debtMinutes >= 30 && weak && !['sedih', 'marah', 'takut', 'prihatin'].includes(base.mood)) {
      const tired = timeCtx.debtMinutes >= 120 ? 'lelah' : 'ngantuk';
      base = {
        mood: tired,
        intensity: Math.min(0.85, 0.45 + timeCtx.debtMinutes / 600),
        reason: 'kurang tidur karena begadang semalam',
        updated: now,
      };
      await this.store
        .setEmotion(chat, base.mood, base.intensity, base.reason)
        .catch(() => {});
    } else if (base && detected) {
      await this.store
        .setEmotion(chat, base.mood, base.intensity, base.reason)
        .catch(() => {});
    }

    return { mood: base, timeCtx };
  }

  async handleAdultMode(chat, m, isOwner, arg) {
    if (!isOwner || isGroupJid(chat)) {
      await wa.sendText(
        chat,
        isGroupJid(chat)
          ? 'Mode dewasa hanya untuk owner di chat pribadi.'
          : 'Perintah ini khusus owner.',
        m
      );
      return true;
    }

    const action = String(arg || 'status').trim().toLowerCase();
    if (['status', 'cek', 'info'].includes(action)) {
      const st = this.store.get(chat);
      if (!st.adult) {
        await wa.sendText(chat, 'Mode dewasa sedang *tidak aktif*.', m);
      } else {
        const until = formatDateTime(st.adultUntil, this.cfg.timezone);
        await wa.sendText(chat, `🔥 Mode dewasa *aktif* sampai ${until}.`, m);
      }
      return true;
    }

    const on = ['on', 'enable', 'aktif', 'aktifkan', 'nyala', '1', 'ya'].includes(action);
    const off = ['off', 'disable', 'mati', 'matikan', 'nonaktif', 'nonaktifkan', '0', 'tidak'].includes(
      action
    );
    if (!on && !off) {
      await wa.sendText(
        chat,
        'Gunakan: !hot on|off|status\nAtau: !tsukasa mode dewasa on|off|status',
        m
      );
      return true;
    }

    await this.store.setAdult(chat, on);
    await wa.sendText(
      chat,
      on
        ? '🔥 Mode dewasa aktif untuk chat ini (18+, 30 menit). Kirim "stop" untuk kembali normal.'
        : 'Mode dewasa dimatikan. Kita kembali ke obrolan biasa.',
      m
    );
    return true;
  }

  async handleTikTok(chat, m, urls) {
    try {
      const data = await tiktok.getTikTokFromTikwm(urls, this.cfg);

      if (Array.isArray(data.images) && data.images.length > 0) {
        const max = Math.min(data.images.length, Number(this.cfg.ttMaxSlides) || 10);
        for (let i = 0; i < max; i++) {
          const url = data.images[i];
          try {
            const info = await tiktok.headInfo(url);
            if (info.size > 0 && this.cfg.ttMaxImage > 0 && info.size > this.cfg.ttMaxImage) {
              if (this.cfg.ttMaxDoc <= 0 || info.size <= this.cfg.ttMaxDoc) {
                const got = await tiktok.downloadBytes(url, this.cfg.ttMaxDoc);
                await wa.sendDocument(
                  chat,
                  got.data,
                  got.mime || info.ctype || 'image/jpeg',
                  `slide_${i + 1}.jpg`,
                  `TikTok 🖼️ slide ${i + 1}/${max} (dokumen)`,
                  m
                );
                continue;
              }
            }
            const got = await tiktok.downloadBytes(url, this.cfg.ttMaxImage);
            await wa.sendImage(chat, got.data, `TikTok 🖼️ slide ${i + 1}/${max}`, m, got.mime);
          } catch (err) {
            log.error(`[TIKTOK] slide ${i + 1} gagal: ${shortError(err)}`);
          }
        }
        if (data.audio) await wa.sendText(chat, `🔊 Audio: ${data.audio}`, m);
        return;
      }

      if (data.video) {
        try {
          const info = await tiktok.headInfo(data.video);
          if (
            info.size > 0 &&
            this.cfg.ttMaxVideo > 0 &&
            info.size > this.cfg.ttMaxVideo &&
            (this.cfg.ttMaxDoc <= 0 || info.size <= this.cfg.ttMaxDoc)
          ) {
            const got = await tiktok.downloadBytes(data.video, this.cfg.ttMaxDoc);
            const ok = await wa
              .sendDocument(
                chat,
                got.data,
                got.mime || info.ctype || 'video/mp4',
                'tiktok.mp4',
                'TikTok 🎬 (dokumen)',
                m
              )
              .catch(() => null);
            if (ok) {
              if (data.audio) await wa.sendText(chat, `🔊 Audio: ${data.audio}`, m);
              return;
            }
          }
          const got = await tiktok.downloadBytes(data.video, this.cfg.ttMaxVideo);
          await wa.sendVideo(chat, got.data, 'TikTok 🎬', m, got.mime || 'video/mp4');
          if (data.audio) await wa.sendText(chat, `🔊 Audio: ${data.audio}`, m);
          return;
        } catch (err) {
          log.error(`[TIKTOK] video gagal: ${shortError(err)}`);
        }
      }

      if (data.audio) {
        await wa.sendText(chat, `🔊 Audio: ${data.audio}`, m);
        return;
      }

      await wa.sendText(chat, 'Maaf, tidak menemukan media valid dari TikTok.', m);
    } catch (err) {
      log.error(`[TIKTOK] download gagal: ${shortError(err)}`);
      if (err && err.waf) {
        await wa.sendText(
          chat,
          'TikTok sedang membatasi akses dari server (WAF). Coba lagi beberapa saat, atau minta admin mengatur TIKTOK_PROXY_URLS / TIKTOK_COOKIE / TIKTOK_JINA_KEY.',
          m
        );
        return;
      }
      await wa.sendText(chat, 'Maaf, gagal mengambil media TikTok. Coba kirim lagi ya.', m);
    }
  }
}

module.exports = { Router };
