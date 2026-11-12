// Struk/receipt PNG generator — same "Keyra — Receipt Design" as the PDF
// version (cream showcase, white card w/ scalloped bottom, dashed dividers,
// highlighted TOTAL box, optional PAID stamp, deterministic barcode), but
// rendered straight to a raster PNG via @napi-rs/canvas. This is what you
// want when the receipt is going to be sent as a chat image (e.g. WhatsApp)
// instead of a downloadable PDF — WhatsApp's `image` field needs real
// image bytes, not a PDF.
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const FONTDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts");
const SCALE = 300 / 72; // ≈4.17x — matches the 300 DPI render the old keyra-engine used

// palette (exact from design)
const CREAM = "#e9e4db", INK = "#181513", MUTED = "#8c8781";
const SOFT = "#f2f0ec", DASH = "#dcd8d1", GREEN = "#2e7d5b", WHITE = "#ffffff";

const rupiah = (v) => `Rp ${Number(v || 0).toLocaleString("id-ID")}`;
const angka = (v) => Number(v || 0).toLocaleString("id-ID");
const has = (v) => v != null && String(v).trim() !== "" && String(v).trim() !== "-";

function waktuSekarang() {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return { tanggal: `${g("day")}/${g("month")}/${g("year")}`, jam: `${g("hour")}:${g("minute")}` };
}

const hitungQty = (items) => items.reduce((t, i) => t + Number(i.qtyTotal ?? i.qty ?? 0), 0);
const hitungTotal = (items) => items.reduce((t, i) => t + Number(i.qty || 0) * Number(i.harga || 0), 0);

// Register Inter once per runtime. Falls back to a generic sans-serif family
// name if the TTFs aren't present — most serverless base images don't ship
// any system fonts though, so for best results make sure lib/fonts/Inter-*
// are deployed alongside this file.
let fontMode = null; // "inter" | "fallback"
const FAMILY = { reg: "Inter-Regular", med: "Inter-Medium", semi: "Inter-SemiBold", bold: "Inter-Bold" };
const FALLBACK_FAMILY = { reg: "sans-serif", med: "sans-serif", semi: "sans-serif", bold: "sans-serif" };

function ensureFonts() {
  if (fontMode) return fontMode === "inter" ? FAMILY : FALLBACK_FAMILY;
  const files = {
    reg: "Inter-Regular.ttf", med: "Inter-Medium.ttf",
    semi: "Inter-SemiBold.ttf", bold: "Inter-Bold.ttf",
  };
  const haveAll = Object.values(files).every((f) => fs.existsSync(path.join(FONTDIR, f)));
  if (haveAll) {
    for (const [alias, file] of Object.entries(files)) {
      GlobalFonts.registerFromPath(path.join(FONTDIR, file), FAMILY[alias]);
    }
    fontMode = "inter";
    return FAMILY;
  }
  fontMode = "fallback";
  return FALLBACK_FAMILY;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateStrukImage(data = {}) {
  const {
    toko = {}, kasir = null, pelanggan = null, alamatPelanggan = null,
    nomorStruk = null, items = [], bayar = 0, metodeBayar = "Cash",
    paid = false, lunas = false, uniqueCode = 0,
  } = data;
  const uCode = Math.max(0, Number(uniqueCode) || 0);
  if (!Array.isArray(items) || items.length === 0) throw new Error("items must be a non-empty array");
  if (items.length > 50) throw new Error("too many items (max 50)");
  const isPaid = paid === true || paid === "true" || lunas === true || lunas === "true";

  const FONT = ensureFonts();
  const now = waktuSekarang();
  const finalNomor = nomorStruk || Date.now().toString().slice(-8);

  // ── geometry (design units = CSS px) ──
  const SHOW_W = 720, SIDE = 180, PAD = 96;
  const cardLeft = SIDE, cardW = SHOW_W - SIDE * 2; // 360
  const inL = cardLeft + 28, inW = cardW - 56, inR = inL + inW; // content 304
  const cardTop = PAD, contentTop = cardTop + 36;
  const GAP = 18, DIV = GAP + 0 + GAP;

  const addrLines = [toko.alamat, toko.kota, has(toko.telp) ? `Telp ${toko.telp}` : null].filter(has);

  // pesan/catatan (mis. pesan donatur): maksimal 3 baris, karakter di luar Latin (emoji dll) dibuang karena font tidak punya
  const mctx = createCanvas(4, 4).getContext("2d");
  const wrapNote = (raw, family, size, maxW, maxLines = 3) => {
    const clean = String(raw ?? "").replace(/[^\x20-\x7E\u00A0-\u024F]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!clean) return [];
    mctx.font = `${size}px "${family}"`;
    const w = (t) => mctx.measureText(t).width;
    const lines = [];
    let cur = "";
    for (let word of clean.split(" ")) {
      while (w(word) > maxW) { // kata sangat panjang dipotong
        let k = word.length;
        while (k > 1 && w(word.slice(0, k)) > maxW) k--;
        if (cur) { lines.push(cur); cur = ""; }
        lines.push(word.slice(0, k));
        word = word.slice(k);
      }
      const next = cur ? `${cur} ${word}` : word;
      if (w(next) <= maxW) cur = next;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      const cut = lines.slice(0, maxLines);
      let last = cut[maxLines - 1];
      while (last.length > 1 && w(`${last}…`) > maxW) last = last.slice(0, -1);
      cut[maxLines - 1] = `${last}…`;
      return cut;
    }
    return lines;
  };
  const noteLines = wrapNote(data.catatan, FONT.med, 11, inW);
  const noteAdvance = noteLines.length ? 19 + noteLines.length * 15 : 0;
  const H_note = noteLines.length ? DIV + noteAdvance : 0;
  const H_header = 92 + 17 * addrLines.length;
  const metaRows = 2 + (has(kasir) ? 1 : 0) + (has(pelanggan) ? 1 : 0) + (has(alamatPelanggan) ? 1 : 0);
  const H_meta = metaRows * 13 + (metaRows - 1) * 9;
  const H_items = items.length * 30 + (items.length - 1) * 14;
  const H_totals = 147 + (uCode > 0 ? 23 : 0), H_footer = 97;
  const cardContent = H_header + H_meta + H_items + H_note + H_totals + H_footer + 4 * DIV;
  const cardH = 36 + cardContent + 40;
  const SHOW_H = PAD + cardH + PAD;

  const canvas = createCanvas(Math.ceil(SHOW_W * SCALE), Math.ceil(SHOW_H * SCALE));
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  const textWidth = (s, family, size) => {
    ctx.font = `${size}px "${family}"`;
    return ctx.measureText(String(s ?? "")).width;
  };
  const truncateToWidth = (s, family, size, maxWidth) => {
    const str = String(s ?? "");
    if (textWidth(str, family, size) <= maxWidth) return str;
    let lo = 0, hi = str.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = str.slice(0, mid) + "…";
      if (textWidth(candidate, family, size) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return str.slice(0, lo) + "…";
  };

  // draws text with optional manual letter-spacing (canvas has no native
  // characterSpacing option that's reliable across renderers)
  const txt = (s, weight, size, color, x, y, w, align, ls) => {
    const family = FONT[weight];
    const str = String(s ?? "");
    ctx.font = `${size}px "${family}"`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    const baseline = y + size * 0.86;
    if (ls) {
      let chars = str.split("");
      let total = 0;
      const widths = chars.map((c) => { const cw = ctx.measureText(c).width; total += cw + ls; return cw; });
      total -= ls;
      let startX = x;
      if (align === "center") startX = x + (w - total) / 2;
      else if (align === "right") startX = x + w - total;
      let cx = startX;
      chars.forEach((c, i) => { ctx.fillText(c, cx, baseline); cx += widths[i] + ls; });
      return;
    }
    const tw = ctx.measureText(str).width;
    let drawX = x;
    if (align === "center") drawX = x + (w - tw) / 2;
    else if (align === "right") drawX = x + w - tw;
    ctx.fillText(str, drawX, baseline);
  };
  const line = (y) => {
    ctx.save();
    ctx.strokeStyle = DASH;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(inL, y);
    ctx.lineTo(inR, y);
    ctx.stroke();
    ctx.restore();
  };
  const kv = (label, value, y) => {
    txt(label, "reg", 11, MUTED, inL, y, inW, "left");
    txt(value, "med", 11, INK, inL, y, inW, "right");
  };

  // ── background + card + soft shadow ──
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, SHOW_W, SHOW_H);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    roundRectPath(ctx, cardLeft, cardTop + 3 + i * 2, cardW, cardH, 22);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();
  }
  roundRectPath(ctx, cardLeft, cardTop, cardW, cardH, 22);
  ctx.fillStyle = WHITE;
  ctx.fill();

  // ── content ──
  let Y = contentTop;

  // Header
  const badge = 56, bx = cardLeft + cardW / 2 - badge / 2;
  roundRectPath(ctx, bx, Y, badge, badge, 16);
  ctx.fillStyle = INK;
  ctx.fill();
  txt("K", "bold", 26, WHITE, bx, Y + 13, badge, "center");
  const nameY = Y + 70;
  txt((toko.nama || "Store").toUpperCase(), "bold", 18, INK, inL, nameY, inW, "center", 0.6);
  let ay = nameY + 26;
  for (const l of addrLines) { txt(l, "reg", 10.5, MUTED, inL, ay, inW, "center"); ay += 17; }
  Y += H_header;

  // Meta
  Y += GAP; line(Y); Y += GAP;
  kv("Receipt No.", finalNomor, Y); Y += 22;
  kv("Date", `${now.tanggal}  ${now.jam}`, Y);
  if (has(kasir)) { Y += 22; kv("Cashier", kasir, Y); }
  if (has(pelanggan)) { Y += 22; kv("Customer", pelanggan, Y); }
  if (has(alamatPelanggan)) { Y += 22; kv("Address", alamatPelanggan, Y); }
  Y += 13;

  // Items
  Y += GAP; line(Y); Y += GAP;
  items.forEach((it, i) => {
    const nama = it.nama || "-", qty = Number(it.qty || 0), satuan = it.satuan || "", harga = Number(it.harga || 0);
    const sub = qty * harga;
    const namaMaxW = inW - 80;
    const subtitle = satuan ? `${qty} ${satuan} × ${angka(harga)}` : `${qty} × ${angka(harga)}`;
    txt(truncateToWidth(nama, FONT.semi, 12.5, namaMaxW), "semi", 12.5, INK, inL, Y, namaMaxW, "left");
    txt(truncateToWidth(subtitle, FONT.reg, 10.5, namaMaxW), "reg", 10.5, MUTED, inL, Y + 17, namaMaxW, "left");
    txt(rupiah(sub), "med", 12.5, INK, inL, Y, inW, "right");
    Y += 30 + (i < items.length - 1 ? 14 : 0);
  });

  // Pesan / catatan
  if (noteLines.length) {
    Y += GAP; line(Y); Y += GAP;
    txt("Message", "reg", 11, MUTED, inL, Y, inW, "left");
    noteLines.forEach((l, i) => txt(l, "med", 11, INK, inL, Y + 21 + i * 15, inW, "left"));
    Y += noteAdvance;
  }

  // Totals
  Y += GAP; const lineIT = Y; line(Y); Y += GAP;
  const totalQty = hitungQty(items), subTotal = hitungTotal(items);
  const boxTotal = subTotal + uCode;
  kv("Total Items", `${totalQty} pcs`, Y); Y += 23;
  kv("Subtotal", rupiah(subTotal), Y); Y += 23;
  if (uCode > 0) { kv("Unique Code", rupiah(uCode), Y); Y += 23; }
  const boxH = 52;
  roundRectPath(ctx, inL, Y, inW, boxH, 12);
  ctx.fillStyle = SOFT;
  ctx.fill();
  txt("TOTAL", "bold", 13, INK, inL + 18, Y + 18, 100, "left", 0.5);
  txt(rupiah(boxTotal), "bold", 18, INK, inL, Y + 15, inW - 18, "right");
  Y += boxH + 10 + 4;
  kv(`Paid · ${metodeBayar}`, rupiah(bayar), Y); Y += 22;
  kv("Change", rupiah(Number(bayar || 0) - boxTotal), Y); Y += 13;

  // Footer
  Y += GAP; line(Y); Y += GAP;
  txt("Thank You For Your Purchase", "semi", 12.5, INK, inL, Y, inW, "center");
  txt("Please keep this receipt as proof of payment", "reg", 9.5, MUTED, inL, Y + 21, inW, "center");
  const bcY = Y + 45, bcH = 34;
  let seed = 0; for (const ch of finalNomor) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const targetW = 150, gap = 2;
  const widths = []; let tw = 0;
  while (tw < targetW) { const w = 1 + Math.round(rand() * 2); if (tw + w > targetW) break; widths.push(w); tw += w + gap; }
  let bxc = cardLeft + cardW / 2 - (tw - gap) / 2;
  ctx.fillStyle = INK;
  for (const w of widths) { ctx.fillRect(bxc, bcY, w, bcH); bxc += w + gap; }
  const digits = finalNomor.split("").join(" ");
  txt(digits, "reg", 9, MUTED, inL, bcY + bcH + 8, inW, "center", 2);

  // scalloped bottom edge
  const scR = 12, cy = cardTop + cardH;
  ctx.fillStyle = CREAM;
  for (let cx = cardLeft + scR; cx <= cardLeft + cardW - scR + 0.1; cx += scR * 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, scR, 0, Math.PI * 2);
    ctx.fill();
  }

  // PAID stamp
  if (isPaid) {
    const sw = 124, sh = 43, cxs = cardLeft + cardW / 2, cys = lineIT + 25;
    ctx.save();
    ctx.translate(cxs, cys);
    ctx.rotate((-10 * Math.PI) / 180);
    ctx.translate(-cxs, -cys);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, cxs - sw / 2, cys - sh / 2, sw, sh, 10);
    ctx.stroke();
    txt("PAID", "bold", 22, GREEN, cxs - sw / 2, cys - 11, sw, "center", 3);
    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}
