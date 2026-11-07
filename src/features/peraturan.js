'use strict';

const log = require('../logger');
const wa = require('../wa');
const llm = require('../llm');
const { WARN_LIMIT } = require('../state');
const { isGroupJid, jidUser } = require('../util');

const REDEEM_KEYWORD = 'mengurangi warn';

function bareJid(jid) {
  return String(jid || '').replace(/:\d+@/, '@').trim();
}

function sanitizeRules(s) {
  return String(s || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function botNameFromEnv() {
  return String(process.env.BOT_NAME || '').trim() || 'Bot';
}

class PeraturanFeature {
  constructor(store) {
    this.store = store;
    this.botName = botNameFromEnv();
  }

  ready() {
    return llm.moderationReady();
  }

  reply(m, msg) {
    return wa.sendText(m.key.remoteJid, msg, m).catch(() => {});
  }

  replyMention(m, text, mentions) {
    return wa.sendText(m.key.remoteJid, text, m, mentions).catch(() => {});
  }

  async isAdmin(sock, group, sender) {
    try {
      const meta = await sock.groupMetadata(group);
      const participants = (meta && meta.participants) || [];
      const target = bareJid(sender);
      const targetUser = jidUser(target);
      for (const p of participants) {
        // Grup modern bisa menyimpan participant sebagai LID, sedangkan
        // sender bisa berupa nomor telepon (atau sebaliknya).
        const ids = [p.id, p.lid, p.phoneNumber, p.pn]
          .filter(Boolean)
          .map(bareJid);
        const same = ids.some((id) => id === target || jidUser(id) === targetUser);
        if (same) {
          return p.admin === 'admin' || p.admin === 'superadmin';
        }
      }
    } catch (err) {
      log.error('[PERATURAN] isAdmin error:', err.message);
    }
    return false;
  }

  async tryCommand(sock, m, args, isOwner) {
    if (!this.ready()) {
      await this.reply(m, 'PERATURAN_APIKEY belum diatur.');
      return true;
    }
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Perintah peraturan hanya berlaku di grup.');
      return true;
    }

    const sender = m.key.participant || chat;
    const canAdmin = isOwner || (await this.isAdmin(sock, chat, sender));
    if (!canAdmin) {
      await this.reply(m, 'Hanya admin grup atau owner bot yang bisa mengatur fitur peraturan.');
      return true;
    }

    const sub = String(args || '')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (sub.length === 0) {
      await this.reply(
        m,
        'Gunakan: !peraturan on|off|sync|status|rules|clear @user\n' +
          'Untuk mengurangi warn: sebut nama bot lalu tulis `saya mau mengurangi warn` dan ucapkan `subhanallah` tepat 5 kali.'
      );
      return true;
    }

    switch (sub[0]) {
      case 'on':
        await this.enable(sock, m);
        return true;
      case 'off':
        await this.disable(sock, m);
        return true;
      case 'sync':
      case 'reload':
        await this.sync(sock, m);
        return true;
      case 'status':
        await this.status(sock, m);
        return true;
      case 'rules':
        await this.showRules(sock, m);
        return true;
      case 'clear':
        await this.clearWarn(sock, m);
        return true;
      default:
        await this.reply(
          m,
          'Perintah tidak dikenal. Gunakan: !peraturan on|off|sync|status|rules|clear @user\n' +
            'Pengurangan warn: sebut nama bot + "saya mau mengurangi warn" + `subhanallah` x5.'
        );
        return true;
    }
  }

  async handleMessage(sock, m, text) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat) || !this.ready()) return;

    const state = this.store.getPeraturanState(chat);
    if (!state.enabled || !String(state.rules || '').trim()) return;

    const content = String(text || '').trim();
    if (!content) return;

    const lower = content.toLowerCase();
    const isRedeem =
      lower.includes(this.botName.toLowerCase()) &&
      (lower.includes(REDEEM_KEYWORD) ||
        lower.includes('kurangi warn') ||
        lower.includes('kurangin warn'));

    try {
      if (isRedeem) {
        await this.handleRedeem(sock, m, state, content);
      } else {
        await this.handleWarn(sock, m, state, content);
      }
    } catch (err) {
      log.error('[PERATURAN] evaluate error:', err.message);
    }
  }

  async handleWarn(sock, m, state, content) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;

    const res = await llm.moderate({
      mode: 'WARN',
      rules: state.rules,
      botName: this.botName,
      message: content,
      userId: jidUser(sender),
    });
    if (!res.violation) return;

    let reason = String(res.reason || '').trim();
    if (!reason) reason = 'Melanggar aturan grup.';

    await this.revoke(sock, m);

    const rec = await this.store.addWarn(chat, sender, reason);
    await this.replyMention(
      m,
      `*Peringatan ${rec.count}/${WARN_LIMIT} untuk @${jidUser(sender)}*\nAlasan: ${reason}`,
      [bareJid(sender)]
    );

    if (rec.count >= WARN_LIMIT) {
      try {
        await sock.groupParticipantsUpdate(chat, [bareJid(sender)], 'remove');
      } catch (err) {
        log.error(`[PERATURAN] gagal keluarkan ${sender}:`, err.message);
        return;
      }
      await this.store.clearWarns(chat, sender);
      await this.replyMention(
        m,
        `*@${jidUser(sender)} dikeluarkan karena melebihi batas peringatan.*`,
        [bareJid(sender)]
      );
    }
  }

  async handleRedeem(sock, m, state, content) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;

    const res = await llm.moderate({
      mode: 'REDEEM',
      rules: state.rules,
      botName: this.botName,
      message: content,
      userId: jidUser(sender),
    });
    if (!res.redeem) return;

    const rec = await this.store.decrementWarn(chat, sender);
    if (rec.count <= 0) {
      await this.replyMention(
        m,
        `*@${jidUser(sender)}, warn kamu sudah 0. Tetap jaga kedisiplinan ya.*`,
        [bareJid(sender)]
      );
      return;
    }
    await this.replyMention(
      m,
      `*Warn kamu berkurang menjadi ${rec.count}/${WARN_LIMIT}.*`,
      [bareJid(sender)]
    );
  }

  async groupDesc(sock, chat) {
    const meta = await sock.groupMetadata(chat);
    return String((meta && (meta.desc || meta.description)) || '').trim();
  }

  async enable(sock, m) {
    const chat = m.key.remoteJid;
    try {
      const desc = await this.groupDesc(sock, chat);
      if (!desc) {
        await this.reply(m, 'Deskripsi grup kosong. Atur deskripsi berisi aturan terlebih dahulu.');
        return;
      }
      const rules = sanitizeRules(desc);
      await this.store.setPeraturanState(chat, true, rules);
      await this.reply(
        m,
        'Fitur peraturan aktif.\nAturan tersimpan sebanyak ' + rules.split('\n').length + ' baris.'
      );
    } catch (err) {
      await this.reply(m, 'Gagal mengambil info grup: ' + err.message);
    }
  }

  async disable(sock, m) {
    const chat = m.key.remoteJid;
    const state = this.store.getPeraturanState(chat);
    if (!state.enabled) {
      await this.reply(m, 'Fitur peraturan sudah nonaktif.');
      return;
    }
    try {
      await this.store.setPeraturanState(chat, false, state.rules);
      await this.reply(m, 'Fitur peraturan dinonaktifkan.');
    } catch (err) {
      await this.reply(m, 'Gagal menonaktifkan: ' + err.message);
    }
  }

  async sync(sock, m) {
    const chat = m.key.remoteJid;
    try {
      const desc = await this.groupDesc(sock, chat);
      if (!desc) {
        await this.reply(m, 'Deskripsi grup kosong.');
        return;
      }
      await this.store.setPeraturanState(chat, true, sanitizeRules(desc));
      await this.reply(m, 'Aturan diperbarui dari deskripsi grup.');
    } catch (err) {
      await this.reply(m, 'Gagal menyinkronkan aturan: ' + err.message);
    }
  }

  async status(sock, m) {
    const chat = m.key.remoteJid;
    const state = this.store.getPeraturanState(chat);
    const lines = [`*Status:* ${state.enabled ? 'Aktif' : 'Nonaktif'}`];

    if (state.rules) {
      lines.push('*Aturan tersimpan:* ');
      const rules = state.rules.split('\n');
      const max = Math.min(rules.length, 6);
      for (let i = 0; i < max; i++) lines.push(`- ${rules[i]}`);
      if (rules.length > max) lines.push(`... (${rules.length - max} baris lagi)`);
    }

    const warns = this.store.listWarns(chat);
    if (warns.length > 0) {
      lines.push('');
      lines.push('*Daftar warn teratas:*');
      const limit = Math.min(warns.length, 5);
      for (let i = 0; i < limit; i++) {
        const w = warns[i];
        lines.push(`${i + 1}. ${w.user} - ${w.count}/${WARN_LIMIT}`);
      }
    }
    await this.reply(m, lines.join('\n'));
  }

  async showRules(sock, m) {
    const chat = m.key.remoteJid;
    const state = this.store.getPeraturanState(chat);
    if (!String(state.rules || '').trim()) {
      await this.reply(m, 'Belum ada aturan tersimpan.');
      return;
    }
    await this.reply(m, '*Aturan grup:*\n' + state.rules);
  }

  async clearWarn(sock, m) {
    const chat = m.key.remoteJid;
    const content = wa.contentOf(m);
    const ci = wa.contextInfoOf(content);
    const mentions = (ci && Array.isArray(ci.mentionedJid) && ci.mentionedJid) || [];
    const target = mentions[0];
    if (!target) {
      await this.reply(m, 'Sertakan mention pengguna yang ingin kamu hapus warn-nya.');
      return;
    }
    await this.store.clearWarns(chat, bareJid(target));
    await this.reply(m, `Warn untuk ${target} direset.`);
  }

  async revoke(sock, m) {
    try {
      await sock.sendMessage(m.key.remoteJid, { delete: m.key });
    } catch (err) {
      log.error('[PERATURAN] gagal hapus pesan:', err.message);
    }
  }
}

module.exports = { PeraturanFeature, sanitizeRules };
