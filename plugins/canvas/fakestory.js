/**

* YannRzy Multi Device — WhatsApp & Tele Bot
*
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
*
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

// ───────── fakestory ─────────
// Plugin canvas: fakestory (satu command)
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import * as _canvas from '@napi-rs/canvas'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import {
    te,
    wrapPlugin,
    mergePlugins,
    canvasRoundedRectPath as roundedRectPath,
    canvasDrawAvatar as drawAvatar,
    canvasGetAvatarBuffer as getAvatarBuffer
} from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ── fakestory ──
const _fakestory = (() => {
const pluginConfig = {
  name: "fakestory",
  alias: [],
  category: "canvas",
  description: "Membuat fake Instagram story dengan 2 gambar",
  usage: ".fakestory <nama>",
  example: ".fakestory Misaki (reply 2 gambar)",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};
const canvasConfig = {
  width: 720,
  cardBg: "#121212",
  textColor: "#ffffff",
  cornerRadius: 35,
};
const icons = {
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  comment:
    "M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z",
  share: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
  options:
    "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
};
function drawCoverImage(ctx, img, x, y, w, h, clipRounded = false, radius = 0) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let drawW, drawH, drawX, drawY;
  if (imgRatio > canvasRatio) {
    drawH = h;
    drawW = h * imgRatio;
    drawX = x - (drawW - w) / 2;
    drawY = y;
  } else {
    drawW = w;
    drawH = w / imgRatio;
    drawX = x;
    drawY = y - (drawH - h) / 2;
  }
  ctx.save();
  if (clipRounded) {
    roundedRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}
function drawBlurredBackground(ctx, canvas, imgTop, imgBottom) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.filter = "blur(30px) brightness(30%)";
  const bleed = 40;
  drawCoverImage(ctx, imgTop, -bleed, -bleed, w + bleed * 2, h / 2 + bleed);
  drawCoverImage(ctx, imgBottom, -bleed, h / 2, w + bleed * 2, h / 2 + bleed);
  ctx.restore();
}
async function createFakeStory(
  username,
  avatarBuffer,
  imageTopBuffer,
  imageBottomBuffer,
) {
  const { createCanvas, loadImage, Path2D } = _canvas;
  const height = 1150;
  const canvas = createCanvas(canvasConfig.width, height);
  const ctx = canvas.getContext("2d");
  const avatar = await loadImage(avatarBuffer);
  const imgTop = await loadImage(imageTopBuffer);
  const imgBottom = await loadImage(imageBottomBuffer);
  drawBlurredBackground(ctx, canvas, imgTop, imgBottom);
  const cardMarginX = 25;
  const cardMarginY = 60;
  const cardW = canvasConfig.width - cardMarginX * 2;
  const cardH = height - cardMarginY * 2;
  const cardX = cardMarginX;
  const cardY = cardMarginY;
  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, canvasConfig.cornerRadius);
  ctx.fillStyle = canvasConfig.cardBg;
  ctx.fill();
  ctx.clip();
  const headerHeight = 90;
  const avatarSize = 45;
  drawAvatar(ctx, avatar, cardX + 20, cardY + 22, avatarSize);
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = canvasConfig.textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(username, cardX + 80, cardY + 45);
  ctx.save();
  ctx.translate(cardX + cardW - 40, cardY + 45);
  ctx.rotate((90 * Math.PI) / 180);
  const pOpts = new Path2D(icons.options);
  ctx.fillStyle = "white";
  ctx.fill(pOpts);
  ctx.restore();
  const footerHeight = 70;
  const contentAvailableHeight = cardH - headerHeight - footerHeight;
  const singleImageHeight = contentAvailableHeight / 2;
  drawCoverImage(
    ctx,
    imgTop,
    cardX,
    cardY + headerHeight,
    cardW,
    singleImageHeight,
  );
  drawCoverImage(
    ctx,
    imgBottom,
    cardX,
    cardY + headerHeight + singleImageHeight,
    cardW,
    singleImageHeight,
  );
  const iconY = cardY + cardH - footerHeight / 2;
  function drawSvgOutline(pathData, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-12, -12);
    const p = new Path2D(pathData);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.8;
    ctx.stroke(p);
    ctx.restore();
  }
  drawSvgOutline(icons.heart, cardX + 40, iconY, 1.3);
  drawSvgOutline(icons.comment, cardX + 100, iconY, 1.2);
  drawSvgOutline(icons.share, cardX + 160, iconY, 1.2);
  ctx.restore();
  return await canvas.encode("png");
}
async function handler(m, { sock }) {
  const username = m.args.join(" ").trim() || m.pushName || "User";
  m.react("🕕");
  try {
    let avatarBuffer;
    let imageTopBuffer;
    let imageBottomBuffer;
    avatarBuffer = await getAvatarBuffer(sock, m.sender);
    const isImage = m.isImage || (m.quoted && m.quoted.isImage);
    if (!isImage) {
      m.react("❌");
      return m.reply(
        `📷 *ꜰᴀᴋᴇ sᴛᴏʀʏ*\n\n` +
          `> Reply 1 atau 2 gambar!\n\n` +
          `> Format: \`${m.prefix}fakestory <nama>\`\n` +
          `> Contoh: \`${m.prefix}fakestory Misaki\``,
      );
    }
    if (m.isImage && m.download) {
      imageTopBuffer = await m.download();
      imageBottomBuffer = imageTopBuffer;
    } else if (m.quoted && m.quoted.isImage && m.quoted.download) {
      imageTopBuffer = await m.quoted.download();
      imageBottomBuffer = imageTopBuffer;
    }
    if (!imageTopBuffer) {
      m.react("❌");
      return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak bisa download gambar`);
    }
    const resultBuffer = await createFakeStory(
      username,
      avatarBuffer,
      imageTopBuffer,
      imageBottomBuffer,
    );
    await sock.sendMessage(m.chat, { image: resultBuffer }, { quoted: m });
    m.react("✅");
  } catch (error) {
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _fakestory
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'fakestory')
