'use strict';

/**
 * Pemetaan LID (Linked Identity) -> nomor telepon (PN).
 *
 * WhatsApp modern kadang memberi `remoteJid` berupa `<angka>@lid` untuk chat
 * pribadi. Pada Baileys 6.7.x, mengirim ke JID `@lid` diterima server tetapi
 * tidak pernah sampai/terdekripsi di penerima, sehingga muncul placeholder
 * "Menunggu pesan ini. Ini mungkin membutuhkan waktu beberapa saat."
 * (WhiskeySockets/Baileys#1950, #1964).
 *
 * Pesan masuk menyertakan nomor asli pengirim di `key.senderPn` walau chat-nya
 * LID-addressed. Pemetaan itu disimpan di sini, lalu `wa.sendMessage` memakai
 * nomor asli sebagai tujuan kirim.
 */

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 5000;
const SAVE_DELAY_MS = 1000;

function userPart(jid) {
  return String(jid || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D+/g, '');
}

function lidOf(jid) {
  const raw = String(jid || '').trim();
  if (!/@lid$/i.test(raw)) return '';
  const user = userPart(raw);
  return user ? `${user}@lid` : '';
}

function pnOf(jid) {
  const raw = String(jid || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) {
    if (!/@s\.whatsapp\.net$/i.test(raw)) return '';
    const user = userPart(raw);
    return user ? `${user}@s.whatsapp.net` : '';
  }
  const user = raw.replace(/\D+/g, '');
  return user ? `${user}@s.whatsapp.net` : '';
}

function isGroupJid(jid) {
  return /@g\.us$/i.test(String(jid || '').trim());
}

class LidMap {
  constructor(file) {
    this.file = file || path.resolve(process.cwd(), 'data', 'lidmap.json');
    this.map = new Map();
    this.loaded = false;
    this.dirty = false;
    this.timer = null;
  }

  load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const [lid, pn] of Object.entries(raw || {})) {
        const l = lidOf(lid);
        const p = pnOf(pn);
        if (l && p) this.map.set(l, p);
      }
    } catch {
      /* file belum ada / rusak: mulai kosong */
    }
  }

  remember(lidJid, pnJid) {
    const lid = lidOf(lidJid);
    const pn = pnOf(pnJid);
    if (!lid || !pn) return false;

    this.load();
    if (this.map.get(lid) === pn) return false;

    this.map.set(lid, pn);
    if (this.map.size > MAX_ENTRIES) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
    this.dirty = true;
    this._scheduleSave();
    return true;
  }

  /**
   * Ambil pasangan LID/PN dari key pesan Baileys. Mendukung dua arah:
   * - chat LID + senderPn/participantPn (nomor asli pengirim)
   * - chat PN + senderLid/participantLid
   */
  rememberFromKey(key) {
    if (!key) return false;
    let changed = false;

    const chat = String(key.remoteJid || '');
    const alt = String(key.remoteJidAlt || key.remoteJidPn || '');
    const senderLid = key.senderLid || key.participantLid;
    const senderPn = key.senderPn || key.participantPn;

    // Nomor asli pengirim bisa ada di beberapa field berbeda tergantung versi
    // Baileys dan jenis chat.
    const pnCandidates = [senderPn, key.senderPn, key.participantPn, alt];
    const lidCandidates = [senderLid, key.senderLid, key.participantLid, alt];

    if (chat && !isGroupJid(chat)) {
      if (lidOf(chat)) {
        const pn = pnCandidates.map(pnOf).find(Boolean);
        if (pn) changed = this.remember(chat, pn) || changed;
      } else if (pnOf(chat)) {
        const lid = lidCandidates.map(lidOf).find(Boolean);
        if (lid) changed = this.remember(lid, chat) || changed;
      }
    }

    // Pemetaan pengirim (berguna juga untuk mention/balasan di grup).
    const lid = lidCandidates.map(lidOf).find(Boolean);
    const pn = pnCandidates.map(pnOf).find(Boolean);
    if (lid && pn) changed = this.remember(lid, pn) || changed;

    return changed;
  }

  getPn(lidJid) {
    const lid = lidOf(lidJid);
    if (!lid) return '';
    this.load();
    return this.map.get(lid) || '';
  }

  size() {
    this.load();
    return this.map.size;
  }

  _scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.save();
    }, SAVE_DELAY_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  save() {
    if (!this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const data = {};
      for (const [lid, pn] of this.map) data[lid] = pn;
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
      fs.renameSync(tmp, this.file);
      this.dirty = false;
    } catch {
      /* best-effort; pemetaan tetap hidup di memori */
    }
  }
}

const lidMap = new LidMap(process.env.LID_MAP_FILE || undefined);

module.exports = { LidMap, lidMap, lidOf, pnOf, userPart };
