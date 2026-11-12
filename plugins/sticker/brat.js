// ───────── brat ─────────
// Dipecah dari plugins/sticker/brat.js (dulu digabung dengan fitur lain dalam satu file)

import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'
import { getAssetBuffer } from '../../lib/engine/plugins.js'
import { isIosId, chatIsIos } from '../../lib/platform/wa.js'

const _brat = (() => {
const pluginConfig = {
  name: "brat",
  alias: ["bratimg"],
  category: "sticker",
  description: "Menu variant brat dan generator sticker brat",
  usage: ".brat | .bratimg <text>",
  example: ".bratimg Hai semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

// Daftar variant brat untuk tombol pilihan (dikelompokkan per section list)
const BRAT_SECTIONS = [
  {
    title: "Brat Gambar",
    rows: [
      { command: "bratimg", title: "Brat Default", description: "Sticker brat versi biasa" },
      { command: "bratgreen", title: "Brat Green", description: "Variant brat warna hijau" },
      { command: "bratcewek", title: "Brat Cewek", description: "Variant brat cewek" },
      { command: "brathd", title: "Brat HD", description: "Variant brat HD" },
    ],
  },
  {
    title: "Brat Video",
    rows: [
      { command: "bratvid", title: "Brat Video", description: "Sticker brat animated" },
      { command: "bratvid2", title: "Brat Video V2", description: "Sticker brat video v2" },
      { command: "bratgojovid", title: "Brat Gojo Video", description: "Variant brat Gojo video" },
      { command: "bratvermeilvid", title: "Brat Vermeil Video", description: "Variant brat Vermeil video" },
    ],
  },
  {
    title: "Brat Karakter (1)",
    rows: [
      { command: "bratgojo", title: "Brat Gojo", description: "Variant brat Gojo" },
      { command: "bratvermeil", title: "Brat Vermeil", description: "Variant brat Vermeil" },
      { command: "bratanime", title: "Brat Anime", description: "Brat versi anime" },
      { command: "bratgura", title: "Brat Gura", description: "Brat anime chibi" },
      { command: "bratbahlil", title: "Brat Bahlil", description: "Brat versi Bahlil" },
      { command: "bratpatrick", title: "Brat Patrick", description: "Brat versi Patrick" },
      { command: "bratsquidward", title: "Brat Squidward", description: "Brat versi Squidward" },
    ],
  },
  {
    title: "Brat Karakter (2)",
    rows: [
      { command: "bratwhite", title: "Brat White", description: "Brat versi putih" },
      { command: "bratchika", title: "Brat Chika", description: "Brat versi Chika" },
      { command: "bratkobato", title: "Brat Kobato", description: "Brat versi Kobato" },
      { command: "bratmenhera", title: "Brat Menhera", description: "Brat versi Menhera" },
      { command: "bratnezuko", title: "Brat Nezuko", description: "Brat versi Nezuko" },
      { command: "bratqiqi", title: "Brat Qiqi", description: "Brat versi Qiqi" },
      { command: "bratruromiya", title: "Brat Ruromiya", description: "Brat versi Ruromiya" },
      { command: "bratumaru", title: "Brat Umaru", description: "Brat versi Umaru" },
    ],
  },
];

const isIosMessage = (m) => isIosId(m.key?.id) || (!m.isGroup && chatIsIos(m.chat));

// Teks cadangan (dipakai kalau tombol gagal dikirim)
function bratMenuText(m, text) {
  const list = BRAT_SECTIONS.flatMap((sec) => sec.rows)
    .map((item) => `-▢ ${m.prefix}${item.command} _(${item.description})_`)
    .join("\n");

  return (
    "🌿 *kamu mau buat brat yak, silahkan pilih variant brat di bawah*\n\n" +
    list +
    `\n\nContoh: ${m.prefix}bratimg ${text || "Hai semua"}`
  );
}

async function sendBratMenu(m, sock, text) {
  const p = m.prefix;
  const arg = text ? ` ${text}` : "";
  const logo = getAssetBuffer("logo");
  const body =
    "🌿 *Mau pakai fitur brat yang mana?*\n\n" +
    (text
      ? `Teks kamu: _${text}_\n\nPilih variant lewat tombol di bawah 👇`
      : `Kamu belum menulis teks. Ketik *${p}brat <teks>* lalu pilih variant, atau pilih variant lalu tulis teksnya.\n\nContoh: ${p}brat Hai semua`);
  const footer = global.namebot || "Brat Maker";

  try {
    if (isIosMessage(m)) {
      // iPhone hanya merender tombol reply/url/copy/call, jadi kirim versi ringkas + daftar teks
      return await sock.sendButtons(
        m.chat,
        {
          ...(logo ? { image: logo } : {}),
          text: bratMenuText(m, text),
          footer,
          mentions: [m.sender],
          buttons: [
            { type: "reply", text: "Brat Default", id: `${p}bratimg${arg}` },
            { type: "reply", text: "Brat Green", id: `${p}bratgreen${arg}` },
            { type: "reply", text: "Brat Video", id: `${p}bratvid${arg}` },
          ],
        },
        { quoted: m },
      );
    }

    return await sock.sendButtons(
      m.chat,
      {
        ...(logo ? { image: logo } : {}),
        text: body,
        footer,
        mentions: [m.sender],
        buttons: [
          {
            type: "list",
            text: "Pilih Brat",
            sections: BRAT_SECTIONS.map((sec) => ({
              title: sec.title,
              rows: sec.rows.map((item) => ({
                title: item.title,
                description: item.description,
                id: `${p}${item.command}${arg}`,
              })),
            })),
          },
        ],
      },
      { quoted: m },
    );
  } catch (err) {
    console.error("[brat] tombol gagal, kirim teks biasa:", err.stack || err);
    const caption = bratMenuText(m, text);
    if (logo) return sock.sendMessage(m.chat, { image: logo, caption }, { quoted: m });
    return sock.sendMessage(m.chat, { text: caption }, { quoted: m });
  }
}

async function handler(m, { sock }) {
  const text = m.text;
  const command = String(m.command || "").toLowerCase();

  if (command === "brat") {
    await sendBratMenu(m, sock, text);
    return;
  }

  if (!text) {
    return m.reply(
      `🖼️ *ʙʀᴀᴛ ɪᴍᴀɢᴇ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratimg Hai semua\``,
    );
  }

  m.react("🕕");

  try {
    await sock.sendImageAsSticker(m.chat, `https://api.nexray.eu.cc/maker/brat?text=${encodeURIComponent(text)}`, m, {
      packname: config.sticker.packname,
      author: config.sticker.author,
    });

    m.react("✅");
  } catch (error) {
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

_brat.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file; command lain jadi sub-command
_brat.limit = true
export default oneCommand(_brat, 'brat')
