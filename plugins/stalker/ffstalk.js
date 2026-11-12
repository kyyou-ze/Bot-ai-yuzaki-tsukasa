/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */
import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))
  const crypto = (__m => __m.default ?? __m)((await import('crypto')))

  function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  async function solvePow(challenge, difficulty) {
    const prefix = '0'.repeat(difficulty);
    for (let t = 0; ; t++) {
      const nonce = t.toString(36);
      if (sha256(`${challenge}:${nonce}`).startsWith(prefix)) {
        return nonce;
      }
    }
  }

  async function stalkFF(uid) {
    const endpoint = '/api/ff';
    const { data: tokenData } = await axios.get('https://freefire.my.id/api/token', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Referer': `https://freefire.my.id/stalk/${uid}`
      },
      timeout: 15000
    });

    const pow = await solvePow(tokenData.challenge, tokenData.difficulty);
    const sig = sha256(`${tokenData.token}|${endpoint}|${pow}`);

    const res = await axios.get(`https://freefire.my.id${endpoint}`, {
      params: { uid },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Referer': `https://freefire.my.id/stalk/${uid}`,
        'x-fp-token': tokenData.token,
        'x-fp-pow': pow,
        'x-fp-sig': sig
      },
      timeout: 30000
    });

    return res.data;
  }

  let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return m.reply(`Mana UID-nya ayang tercinta? 🥺 Contoh: *${usedPrefix + command} 12345678*`);
    const uid = text.trim();
    if (isNaN(uid)) return m.reply('UID-nya harus angka dong sayang, jangan nakal yaa~ 💋');

    await m.reply('Tunggu sebentar ya ayangku... Angela lagi intip datanya sampai tuntas~ ⏳');

    try {
      const result = await stalkFF(uid);
      const p = result.player;
      const g = result.guild || {};
      const s = result.social || {};
      const pet = result.pet || {};

      let caption = `╭───『 *FREE FIRE STALKER* 』───
  │ 🥀 *Nickname:* ${p.nickname}
  │ 🆔 *UID:* ${p.accountId}
  │ 🌐 *Region:* ${p.region}
  │ ⭐ *Level:* ${p.level} (Exp: ${p.exp?.toLocaleString()})
  │ 🏆 *Rank Point:* ${p.rankingPoints || '-'}
  │ 🎖️ *CS Rank Point:* ${p.csRankingPoints || '-'}
  │ ❤️ *Likes:* ${p.liked?.toLocaleString() || 0}
  │ 🧕 *Karakter Aktif:* ${p.equippedCharacter?.name || '-'}
  │ 🏷️ *Title:* ${p.equippedTitle?.name || '-'}
  │ 🛡️ *Guild:* ${g.guildName || '-'} (Lv. ${g.guildLevel || '-'})
  │ 🐾 *Pet:* ${pet.name ? `${pet.name} (${pet.speciesName} Lv.${pet.level})` : '-'}
  │ 📝 *Bio:* ${s.signature || '-'}
  ╰───────────────────────

  _Khusus dipersembahkan oleh Angela tercinta buat Mas ganteng~_ 💋`;

      const imgUrl = p.avatarUrl || p.equippedCharacterIconUrl;
      if (imgUrl) {
        await conn.sendMessage(m.chat, {
          image: { url: imgUrl },
          caption: caption
        }, { quoted: m });
      } else {
        await m.reply(caption);
      }
    } catch (err) {
      console.error(err);
      m.reply(`Aww gagal stalk UID ${uid} nih sayang~ Servernya lagi ngambek atau UID-nya ga ketemu: ${err.message}`);
    }
  };

  handler.help = ['ffstalk <uid>']
  handler.tags = ['stalker', 'tools']
  handler.command = /^(ffstalk|stalkff)$/i;
  handler.limit = true;
  return handler
}

rbRegister("stalker/ffstalk", feature)

let handler = (m, ctx) => rbRun("stalker/ffstalk", m, ctx)

handler.command = ['ffstalk']
handler.help = ["ffstalk <uid>"]
handler.tags = ['stalker']
handler.limit = true

export default handler
