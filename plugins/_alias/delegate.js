/**
 * delegate.js — helper untuk command alias gaya ALYA MD.
 *
 * Alias tidak menduplikasi logika. Saat dipanggil, plugin ini meneruskan
 * perintah ke command tujuan lewat dispatcher Kaguya, sehingga pemeriksaan
 * owner/premium/admin/grup pada command asli tetap berlaku.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let kaguya = null;

function dispatcher() {
  if (!kaguya) kaguya = require('../../src/kaguya');
  return kaguya;
}

export function makeAliasPlugin({ targets = {}, tags = 'main', description = '' } = {}) {
  const handler = async (m, ctx) => {
    const key = String(ctx.command || '').toLowerCase();
    const target = targets[key];
    if (!target) {
      await ctx.reply(`Command *${key || '-'}* belum punya tujuan.`);
      return true;
    }

    const command = typeof target === 'string' ? target : String(target.command || '');
    let text = String(ctx.text || '').trim();
    if (target && typeof target === 'object' && target.prepend) {
      text = [target.prepend, text].filter(Boolean).join(' ');
    }

    let handled = false;
    try {
      handled = await dispatcher().dispatch({
        sock: ctx.sock,
        raw: m,
        cfg: ctx.config || {},
        command,
        rest: text,
        prefix: ctx.prefix || ctx.usedPrefix || '.',
        chat: ctx.chat || ctx.jid || m.chat,
        sender: ctx.sender || m.sender,
        isOwner: Boolean(ctx.isOwner),
        isAdmin: Boolean(ctx.isAdmin),
        isPremium: Boolean(ctx.isPremium),
        reply: (value) => ctx.reply(value),
      });
    } catch (err) {
      console.error(`[alias:${key}]`, err?.message || err);
      await ctx.reply(`⚠️ Alias *${key}* gagal menjalankan *${command}*.`);
      return true;
    }

    if (!handled) await ctx.reply(`❌ Fitur *${command}* tidak tersedia.`);
    return true;
  };

  handler.help = Object.keys(targets);
  handler.tags = [tags];
  handler.description = description || 'Alias perintah gaya ALYA MD';
  return handler;
}
