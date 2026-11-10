'use strict';
const wa = require('./wa');
const { localParts } = require('./util');

const REMINDERS = [
  { h: 6, m: 0, text: 'Pagi! Waktunya bangun dan mulai hari. Semangat ya.' },
  { h: 7, m: 30, text: 'Sarapan dulu jangan lupa.' },
  { h: 10, m: 0, text: 'Minum air putih, istirahat mata sebentar.' },
  { h: 12, m: 0, text: 'Waktunya makan siang.' },
  { h: 15, m: 0, text: 'Minum air lagi, stretch sebentar.' },
  { h: 18, m: 0, text: 'Makan malam jangan lupa.' },
  { h: 21, m: 30, text: 'Waktunya istirahat, kurangi layar.' },
  { h: 22, m: 30, text: 'Tidur yang cukup, good night.' },
];

class Reminders {
  constructor(cfg) {
    this.cfg = cfg;
    this.to = (cfg.ownerJid || '').trim();
    this.timer = null;
    this.sent = new Set();
  }
  start() {
    if (!this.to) return;
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 60 * 1000);
    this.tick();
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  tick() {
    // Jangan pakai Date#getHours(): server panel biasanya UTC. Semua jadwal
    // harus mengikuti BOT_TIMEZONE supaya tidak molor 7 jam.
    const now = localParts(Date.now(), this.cfg.timezone);
    const key = `${now.dateKey}-${now.hour}-${now.minute}`;
    for (const r of REMINDERS) {
      if (r.h === now.hour && r.m === now.minute) {
        if (this.sent.has(key + r.h)) return;
        this.sent.add(key + r.h);
        wa.sendText(this.to, r.text).catch(() => {});
      }
    }
  }
}
module.exports = { Reminders };
