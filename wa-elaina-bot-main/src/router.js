'use strict';

const { OwnerDetector, WelcomeHandler, TagAllHandler, RvoHandler } = require('./features/basic');
const { StickerFeature, BratFeature } = require('./features/media');
const { BaImageFeature, PapFeature } = require('./features/images');
const { VisionFeature, VnFeature, TtsFeature, ImgGenFeature, HijabinFeature } = require('./features/ai');
const { AnimeFeature } = require('./features/anime');
const { PeraturanFeature } = require('./features/peraturan');
const tiktok = require('./tiktok');
const llm = require('./llm');
const memory = require('./memory');
const wa = require('./wa');
const { isGroupJid } = require('./util');

const RE_REPLY_CUE = /\b(balas(in|lah)?|reply|jawab(in|lah)?)(\s+ini)?\b/i;

function normalizeTrigger(cfg) {
  const trig = String(cfg.trigger || 'tsukasa').trim();
  return new RegExp('\\b' + trig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
}

function parseBang(s) {
  const t = String(s || '').trim();
  if (!t || !t.startsWith('!')) return null;
  const parts = t.slice(1).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return { cmd: parts[0].toLowerCase(), rest: parts.slice(1).join(' ') };
}

function extractText(m, content) {
  const txt = wa.extractText(content);
  if (txt) return txt;
  if (m.message && m.message.conversation) return m.message.conversation;
  return '';
}

function quotedInfo(quoted) {
  const info = { img: false, aud: false, text: '' };
  if (!quoted) return info;
  info.img = Boolean(quoted.imageMessage);
  info.aud = Boolean(quoted.audioMessage);
  if (quoted.conversation) info.text = quoted.conversation;
  else if (quoted.extendedTextMessage && quoted.extendedTextMessage.text) {
    info.text = quoted.extendedTextMessage.text;
  }
  return info;
}

class Router {
  constructor(cfg, sock, ready, store, animeChannel) {
    this.cfg = cfg;
    this.sock = sock;
    this.ready = typeof ready === 'function' ? ready : () => Boolean(ready);
    this.store = store;
    this.animeChannel = animeChannel || null;

    this.reTrig = normalizeTrigger(cfg);
    this.owner = new OwnerDetector();
    this.welcome = new WelcomeHandler();
    this.tagall = new TagAllHandler();
    this.rvo = new RvoHandler();
    this.sticker = new StickerFeature();
    this.brat = new BratFeature(this.reTrig);
    this.ba = new BaImageFeature(cfg);
    this.pap = new PapFeature(cfg);
    this.vision = new VisionFeature(this.reTrig, this.owner);
    this.vn = new VnFeature(this.reTrig, this.owner);
    this.tts = new TtsFeature(this.reTrig);
    this.imggen = new ImgGenFeature(cfg);
    this.hijab = new HijabinFeature(cfg);
    this.anime = new AnimeFeature(this.reTrig);
    this.peraturan = new PeraturanFeature(store);
  }

  async handleGroupParticipantsUpdate(ev) {
    try {
      await this.welcome.handle(this.sock, ev);
    } catch (err) {
      console.error('[WELCOME] error:', err.message);
    }
  }

  async handleMessage(m) {
    if (!this.ready()) return;
    if (!m || !m.message) return;
    if (m.key && m.key.fromMe) return;

    const chat = m.key.remoteJid;
    if (!chat || chat === 'status@broadcast') return;

    const content = wa.contentOf(m);
    if (!content) return;

    let txt = extractText(m, content);
    const origTxt = txt;
    const sender = m.key.participant || chat;
    const isOwner = this.owner.isOwner(sender, chat);
    this.owner.debugLog(sender, chat, isOwner);

    const quoted = wa.quotedContent(wa.contextInfoOf(content));
    const q = quotedInfo(quoted);
    if (q.img || q.aud || q.text) {
      console.log(
        `[REPLY] chat=${chat} quoted{img:${q.img} aud:${q.aud} textLen:${q.text.length}}`
      );
    }

    // PRIORITAS TERTINGGI: image generation
    if (await this.imggen.handle(this.sock, m, content, origTxt)) return;

    const bang = parseBang(txt);
    if (bang) {
      if (bang.cmd === 'help') {
        const userName = memory.getUserName(sender) || '';
        const greeting = userName ? `Hai ${userName}!` : 'Hai!';
        const lines = [
          greeting + ' Ini perintah yang bisa kamu gunakan:',
          '',
          '- !help : bantuan ringkas',
          '- !whoami : lihat JID kamu',
          '- !tagall / tsukasa tagall : mention semua anggota grup',
          '- !rvo : buka media sekali lihat (reply ke pesannya)',
          '- ba / kirim gambar blue archive : gambar BA',
          '- tsukasa hijabin : berhijabkan gambar (kirim/quote gambar)',
          '- tsukasa vn <teks> : kirim voice note',
          "- kirim gambar + sebut '" + this.cfg.trigger + "' : analisis gambar",
          "- vn sebut 'tsukasa' : transkrip & jawab",
          '- kirim link TikTok : unduh via TikWM',
          '- tsukasa brat <teks> : buat sticker brat',
          '- tsukasa buatin gambar <prompt> / !gambar <prompt> : generate gambar AI',
          '- !anime ... : info anime (new/movie/schedule/search/detail)',
          '- !animechannel status|test : cek / tes auto-post ke channel (owner/admin)',
          '- !peraturan on|off|status : moderasi grup (admin)',
          '- !tsukasa persona tsukasa1|tsukasa2 : pilih persona AI (persist)',
          '- !tsukasa mode pro on|off : aktifkan Mode Pro (persist)',
          '',
          'Tips: katakan "panggil aku [nama]" supaya aku ingat namamu!',
        ];
        await wa.sendText(chat, lines.join('\n'), m);
        return;
      }

      if (bang.cmd === 'whoami') {
        const userName = memory.getUserName(sender) || '';
        let who = `Sender: ${sender}\nChat  : ${chat}`;
        if (userName) who += `\nNama tersimpan: ${userName}`;
        await wa.sendText(chat, who, m);
        return;
      }

      if (bang.cmd === 'anime') {
        if (await this.anime.handle(this.sock, m, origTxt)) return;
      }

      if (bang.cmd === 'animechannel' || bang.cmd === 'anime-channel') {
        const sub = String(bang.rest || '').trim().split(/\s+/).filter(Boolean)[0] || 'status';
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
        if (sub === 'status') {
          await wa.sendText(chat, this.animeChannel.formatStatus(), m);
          return;
        }
        if (sub === 'test' || sub === 'post') {
          try {
            const res = await this.animeChannel.postOne({ force: true, reason: 'manual' });
            if (res.ok) {
              await wa.sendText(
                chat,
                `✅ Terkirim ke channel: *${res.item.title}* (${res.mode}).\nSumber: ${res.source || '-'}`,
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
        await wa.sendText(chat, 'Gunakan: !animechannel status  atau  !animechannel test', m);
        return;
      }

      if (bang.cmd === 'peraturan') {
        if (await this.peraturan.tryCommand(this.sock, m, bang.rest, isOwner)) return;
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
          'Gunakan: !tsukasa persona tsukasa1|tsukasa2  atau  !tsukasa mode pro on|off',
          m
        );
        return;
      }
    }

    // Moderation peraturan (berjalan untuk semua teks di grup)
    this.peraturan.handleMessage(this.sock, m, origTxt).catch(() => {});

    const isCmd = Boolean(bang);
    const cmd = bang ? bang.cmd : '';
    const isGroup = isGroupJid(chat);
    const hasTrig = this.reTrig.test(origTxt);
    const isTagAllCmd = isCmd && cmd === 'tagall';

    const hasQuoted = q.img || q.aud || q.text !== '';
    if (hasQuoted && !hasTrig && !isCmd) return;

    const hasImage = Boolean(content.imageMessage);
    const hasVideo = Boolean(content.videoMessage);
    if (isGroup && (hasImage || hasVideo) && !hasTrig && !isCmd) return;

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

    // RVO & tagall
    if (!isGroup || hasTrig || isTagAllCmd) {
      if (await this.rvo.handle(this.sock, m, content)) return;
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
      console.error('[TIKTOK] detect error:', err.message);
    }

    const allowNonCmd = !isGroup || hasTrig;
    if (allowNonCmd) {
      if (await this.pap.handle(chat, m, content, origTxt)) return;
      if (await this.ba.handle(chat, m, content, origTxt)) return;
      if (await this.hijab.handle(this.sock, m, content, origTxt)) return;
      if (await this.brat.handle(this.sock, m, content, origTxt)) return;
      if (await this.sticker.handle(this.sock, m, content, origTxt)) return;
      if (await this.vision.handle(this.sock, m, content, origTxt)) return;
      if (await this.anime.handle(this.sock, m, origTxt)) return;
      if (await this.tts.handle(this.sock, m, content, origTxt)) return;
    }

    // VN selalu dicek (juga saat tidak ada teks)
    if (await this.vn.handle(this.sock, m, content, isOwner)) return;

    // Konteks pesan yang di-reply
    if (q.text && this.reTrig.test(origTxt)) {
      const after = origTxt.replace(this.reTrig, '').trim();
      if (!after || RE_REPLY_CUE.test(after)) {
        txt = q.text;
      } else {
        txt = after + '\n\nKonteks (pesan yang di-reply): ' + q.text;
      }
    }

    // Mode MANUAL di grup
    if (isGroup && String(this.cfg.mode || '').toUpperCase() === 'MANUAL') {
      if (!hasTrig && !isTagAllCmd) return;
      const clean = origTxt.toLowerCase().replace(this.reTrig, '').trim();
      if (!clean && q.text) {
        txt = q.text;
      } else if (clean && txt === origTxt) {
        txt = clean;
      }
    }

    if (!String(txt).trim()) return;

    // Permintaan ubah nama
    const nameReq = memory.detectNameRequest(txt);
    if (nameReq) {
      memory.setUserName(sender, nameReq);
      const reply = `*Oke! Mulai sekarang aku akan memanggilmu ${nameReq}* ✨\n\n_Senang berkenalan denganmu, ${nameReq}!_ Aku Tsukasa, siap menemanimu~ 🌟`;
      const out = this.owner.decorate(isOwner, reply);
      await wa.sendText(chat, out.text, m, out.mentions);
      memory.saveTurn(chat, 'user', txt);
      memory.saveTurn(chat, 'assistant', reply);
      return;
    }

    // AI chat
    const state = this.store.get(chat);
    const hist = memory.load(chat);
    const ctxTxt = memory.buildContext(hist, txt, sender);
    const reply = await llm.askAsPersona(this.cfg, state.persona, state.pro, ctxTxt, sender);
    memory.saveTurn(chat, 'user', txt);
    memory.saveTurn(chat, 'assistant', reply);
    const out = this.owner.decorate(isOwner, reply);
    await wa.sendText(chat, out.text, m, out.mentions);
  }

  async handleTikTok(chat, m, urls) {
    try {
      const data = await tiktok.getTikTokFromTikwm(urls);

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
            console.error('[TIKTOK] slide error:', err.message);
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
          console.error('[TIKTOK] video error:', err.message);
        }
      }

      if (data.audio) {
        await wa.sendText(chat, `🔊 Audio: ${data.audio}`, m);
        return;
      }

      await wa.sendText(chat, 'Maaf, tidak menemukan media valid dari TikTok.', m);
    } catch (err) {
      console.error('[TIKTOK] gagal:', err.message);
      await wa.sendText(chat, 'Maaf, gagal mengambil media TikTok. Coba kirim lagi ya.', m);
    }
  }
}

module.exports = { Router };
