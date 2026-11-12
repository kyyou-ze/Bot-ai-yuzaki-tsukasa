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
import QRCode from 'qrcode'
import { reactTo } from '../../lib/core/file.js'

const ICONS = {
  none: '',
  whatsapp: 'M12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.27 4.88L2 22l5.3-1.25C8.68 21.46 10.3 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm3.83 14.28c-.2.57-1.02 1.05-1.55 1.13-.5.08-1.15.15-3.32-.75-2.78-1.15-4.52-4.01-4.66-4.2-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.95-2.28.25-.27.65-.41.95-.41.1 0 .2 0 .3.01.3 0 .45.02.65.5.25.61.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.2.33-.35.5-.15.17-.32.38-.45.51-.15.15-.31.32-.13.63.18.31.81 1.34 1.74 2.17.93.83 1.72 1.09 2.03 1.22.31.13.49.1.67-.1.18-.21.78-.91.99-1.22.2-.31.41-.26.68-.16.28.1.1.78 1.48 1.47 1.47.69.69 1.27.76 1.42.79s.42-.08.62-.35c.2-.27.87-1.02 1.1-1.37.23-.35.45-.3.75-.19.3.11 1.91.9 2.24 1.06s.55.24.63.38c.08.14.08.82-.12 1.39z',
  wifi: 'M12 3C7.03 3 2.5 5.03 0 8.5l1.5 1.5C3.5 7.5 7.5 6 12 6s8.5 1.5 10.5 4l1.5-1.5C21.5 5.03 16.97 3 12 3zm0 6c-3.31 0-6.19 1.39-8.19 3.59L12 21.5l8.19-8.91C18.19 10.39 15.31 9 12 9zm0 5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  google: 'M12.24 10.285V13.4h6.86c-.277 1.56-1.602 4.585-6.86 4.585-4.54 0-8.24-3.765-8.24-8.4s3.7-8.4 8.24-8.4c2.58 0 4.307 1.095 5.298 2.045l2.465-2.37C18.575 1.5 15.69 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.19-1.925H12.24z',
  url: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  phone: 'M6.62 10.79c1.44 2.82 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  instagram: 'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm-1 7a5 5 0 1 1 10 0a5 5 0 0 1-10 0Zm2 0a3 3 0 1 0 6 0a3 3 0 0 0-6 0Zm8.2-4.4a1.2 1.2 0 1 1 2.4 0a1.2 1.2 0 0 1-2.4 0Z',
  tiktok: 'M14 3h3c.3 2.2 1.8 3.7 4 4v3c-1.5 0-2.9-.5-4-1.3V15a5.5 5.5 0 1 1-5.5-5.5c.35 0 .7.03 1 .09V12.7a2.5 2.5 0 1 0 1.5 2.3V3Z',
  youtube: 'M6.5 5h11A4.5 4.5 0 0 1 22 9.5v5a4.5 4.5 0 0 1-4.5 4.5h-11A4.5 4.5 0 0 1 2 14.5v-5A4.5 4.5 0 0 1 6.5 5Zm3.5 4v6l5.2-3L10 9Z',
  shopee: 'M12 2a3 3 0 0 1 3 3v1h3.2a1 1 0 0 1 1 .92l1.06 12.06A2 2 0 0 1 18.27 21H5.73a2 2 0 0 1-2-2.02L4.8 6.92a1 1 0 0 1 1-.92H9V5a3 3 0 0 1 3-3Zm-1.5 4h3V5a1.5 1.5 0 0 0-3 0v1Zm-3.2 7.2a.9.9 0 0 1 1.27.2c.55.8 1.5 1.3 2.43 1.3s1.88-.5 2.43-1.3a.9.9 0 0 1 1.47 1.04c-.87 1.26-2.33 2.06-3.9 2.06s-3.03-.8-3.9-2.06a.9.9 0 0 1 .2-1.24Z',
  tokopedia: 'M4 21V11a8 8 0 0 1 16 0v10h-4v-5a4 4 0 0 0-8 0v5H4Zm8-14a2.5 2.5 0 0 1 2.5 2.5.9.9 0 0 1-1.8 0a.7.7 0 0 0-1.4 0a.9.9 0 0 1-1.8 0A2.5 2.5 0 0 1 12 7Z',
  gopay: 'M5 5h13a3 3 0 0 1 3 3v2.5h-3.5a2.5 2.5 0 0 0 0 5H21V16a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Zm12.5 6h3v1h-3a.5.5 0 0 1 0-1Z',
  ovo: 'M4 12a8 5.5 0 1 1 16 0a8 5.5 0 0 1-16 0Zm3 0a5 3.2 0 1 0 10 0a5 3.2 0 0 0-10 0Z',
  dana: 'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm5 3-4.5 7h3L10.8 18l4.7-7h-3L13 6Z',
  linkaja: 'M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.7-2.6 1.6-3.6C10.5 8.5 11.5 6 12 3Zm-1.8 8.5a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 0 0-3.6 0Z'
}

const PRESETS = {
  'executive': { moduleStyle: 'square', moduleRoundness: 0.2, eyeOuterStyle: 'square', eyeInnerStyle: 'square', colorType: 'solid', primaryColor: '#0F172A', backgroundColor: '#FFFFFF', useCustomEyeColors: false, frameStyle: 'none' },
  'neo-pop': { moduleStyle: 'rounded', moduleRoundness: 0.85, eyeOuterStyle: 'rounded', eyeInnerStyle: 'rounded', colorType: 'solid', primaryColor: '#141414', backgroundColor: '#FFD43B', useCustomEyeColors: false, frameStyle: 'none' },
  'indigo-luxe': { moduleStyle: 'dots', moduleRoundness: 0.9, eyeOuterStyle: 'rounded', eyeInnerStyle: 'circle', colorType: 'gradient', primaryColor: '#4F46E5', secondaryColor: '#06B6D4', gradientAngle: 45, backgroundColor: '#FFFFFF', useCustomEyeColors: false, frameStyle: 'none' },
  'sunset-blaze': { moduleStyle: 'rounded', moduleRoundness: 0.7, eyeOuterStyle: 'leaf', eyeInnerStyle: 'rounded', colorType: 'gradient', primaryColor: '#F97316', secondaryColor: '#EC4899', gradientAngle: 135, backgroundColor: '#FFFFFF', useCustomEyeColors: false, frameStyle: 'none' },
  'ocean-breeze': { moduleStyle: 'dots', moduleRoundness: 1, eyeOuterStyle: 'circle', eyeInnerStyle: 'circle', colorType: 'gradient', primaryColor: '#0EA5E9', secondaryColor: '#22D3EE', gradientAngle: 90, backgroundColor: '#FFFFFF', useCustomEyeColors: false, frameStyle: 'none' },
  'forest-trust': { moduleStyle: 'rounded', moduleRoundness: 0.6, eyeOuterStyle: 'leaf', eyeInnerStyle: 'leaf', colorType: 'solid', primaryColor: '#15803D', backgroundColor: '#FFFFFF', useCustomEyeColors: true, eyeOuterColor: '#14532D', eyeInnerColor: '#65A30D', frameStyle: 'none' },
  'royal-velvet': { moduleStyle: 'dots', moduleRoundness: 0.85, eyeOuterStyle: 'leaf', eyeInnerStyle: 'circle', colorType: 'gradient', primaryColor: '#7C3AED', secondaryColor: '#DB2777', gradientAngle: 220, backgroundColor: '#FFFFFF', useCustomEyeColors: false, frameStyle: 'none' },
  'midnight-pro': { moduleStyle: 'square', moduleRoundness: 0.3, eyeOuterStyle: 'rounded', eyeInnerStyle: 'square', colorType: 'solid', primaryColor: '#F8FAFC', backgroundColor: '#0F172A', useCustomEyeColors: false, frameStyle: 'none' },
  'scan-me-pro': { moduleStyle: 'rounded', moduleRoundness: 0.5, eyeOuterStyle: 'rounded', eyeInnerStyle: 'rounded', colorType: 'solid', primaryColor: '#0F172A', backgroundColor: '#FFFFFF', useCustomEyeColors: false, frameStyle: 'scan-me', frameText: 'SCAN ME', frameColor: '#141414', frameTextColor: '#FFD43B' }
}

const DEFAULTS = {
  moduleStyle: 'square', moduleRoundness: 0.5, eyeOuterStyle: 'square', eyeInnerStyle: 'square',
  colorType: 'solid', primaryColor: '#141414', secondaryColor: '#141414', gradientAngle: 45,
  backgroundColor: '#FFFFFF', useCustomEyeColors: false, eyeOuterColor: '#141414', eyeInnerColor: '#141414',
  logoType: 'none', logoScale: 0.18, logoPadding: 0, logoBgColor: '#FFFFFF',
  margin: 2, resolution: 768, errorCorrection: 'M',
  frameStyle: 'none', frameText: '', frameColor: '#141414', frameTextColor: '#FFFFFF'
}

const escapeWifi = (t) => (t ? t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/:/g, '\\:').replace(/,/g, '\\,') : '')
const escapeXml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ───────── matriks QR ─────────
function getQrMatrix(text, ecLevel = 'M') {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecLevel })
  const size = qr.modules.size
  const matrix = []
  for (let r = 0; r < size; r++) {
    const row = []
    for (let c = 0; c < size; c++) row.push(qr.modules.get(r, c) ? 1 : 0)
    matrix.push(row)
  }
  return { size, matrix }
}

const isEye = (r, c, size) => (r < 7 && c < 7 ? 'tl' : r < 7 && c >= size - 7 ? 'tr' : r >= size - 7 && c < 7 ? 'bl' : null)

function leafEyePath(x, y, size, radius, corner) {
  if (corner === 'tl') return `M${x + radius},${y} h${size - radius} v${size - radius} a${radius},${radius} 0 0,1 -${radius},${radius} h-${size - radius} v-${size - radius} a${radius},${radius} 0 0,1 ${radius},-${radius} z`
  if (corner === 'tr') return `M${x},${y} h${size - radius} a${radius},${radius} 0 0,1 ${radius},${radius} v${size - radius} h-${size - radius} a${radius},${radius} 0 0,1 -${radius},-${radius} v-${size - radius} z`
  return `M${x},${y} h${size} v${size - radius} a${radius},${radius} 0 0,1 -${radius},${radius} h-${size - 2 * radius} a${radius},${radius} 0 0,1 -${radius},-${radius} v-${size - radius} z`
}

const roundRect = (x, y, w, h, r) =>
  `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0,1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0,1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0,1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0,1 ${r},-${r} z`
const circlePath = (cx, cy, r) => `M${cx},${cy - r} a${r},${r} 0 1,1 0,${r * 2} a${r},${r} 0 1,1 0,-${r * 2}`

// ───────── SVG ─────────
function generateQrSvg(payload, userOpts = {}) {
  const opts = { ...DEFAULTS, ...userOpts }
  if (opts.preset && PRESETS[opts.preset]) Object.assign(opts, PRESETS[opts.preset], userOpts)

  const hasLogo = opts.logoType && opts.logoType !== 'none' && ICONS[opts.logoType]
  const ecLevel = hasLogo ? 'H' : opts.errorCorrection || 'M'
  const { size, matrix } = getQrMatrix(payload, ecLevel)

  const res = opts.resolution || 768
  const isScanMe = opts.frameStyle === 'scan-me'
  const activeHeight = isScanMe ? Math.floor(res * 0.83) : res

  const margin = opts.margin >= 0 ? opts.margin : 2
  const gridCount = size + 2 * margin
  const cellSize = Math.max(1, Math.floor(Math.min(res, activeHeight) / gridCount))
  const qrActualSize = cellSize * size
  const offsetX = Math.floor((res - qrActualSize) / 2)
  const offsetY = Math.floor((activeHeight - qrActualSize) / 2)

  let logoStart = -1, logoEnd = -1
  if (hasLogo) {
    const logoModuleSize = Math.max(5, Math.floor(size * (opts.logoScale || 0.18)))
    logoStart = Math.floor((size - logoModuleSize) / 2)
    logoEnd = logoStart + logoModuleSize
  }

  let defs = ''
  let fillAttr = `fill="${opts.primaryColor}"`
  if (opts.colorType === 'gradient') {
    const a = ((opts.gradientAngle || 45) * Math.PI) / 180
    const x1 = 50 - Math.cos(a) * 50, y1 = 50 - Math.sin(a) * 50
    const x2 = 50 + Math.cos(a) * 50, y2 = 50 + Math.sin(a) * 50
    defs = `<defs><linearGradient id="qrGrad" x1="${x1.toFixed(1)}%" y1="${y1.toFixed(1)}%" x2="${x2.toFixed(1)}%" y2="${y2.toFixed(1)}%"><stop offset="0%" stop-color="${opts.primaryColor}" /><stop offset="100%" stop-color="${opts.secondaryColor || opts.primaryColor}" /></linearGradient></defs>`
    fillAttr = 'fill="url(#qrGrad)"'
  }

  let body = defs
  const bgColor = opts.backgroundColor === 'transparent' ? 'none' : opts.backgroundColor || '#FFFFFF'
  body += `<rect width="${res}" height="${res}" fill="${bgColor}" />`

  // modul data
  let pathData = ''
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!matrix[r][c] || isEye(r, c, size)) continue
      if (hasLogo && r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd) continue
      const px = offsetX + c * cellSize, py = offsetY + r * cellSize
      if (opts.moduleStyle === 'square') {
        pathData += ` M${px},${py} h${cellSize} v${cellSize} h-${cellSize} z`
      } else if (opts.moduleStyle === 'circle') {
        pathData += ' ' + circlePath(px + cellSize / 2, py + cellSize / 2, (cellSize / 2) * 0.9)
      } else if (opts.moduleStyle === 'dots') {
        const k = opts.moduleRoundness !== undefined ? opts.moduleRoundness : 0.8
        pathData += ' ' + circlePath(px + cellSize / 2, py + cellSize / 2, (cellSize / 2) * k * 0.9)
      } else if (opts.moduleStyle === 'rounded') {
        const k = opts.moduleRoundness !== undefined ? opts.moduleRoundness : 0.5
        pathData += ' ' + roundRect(px, py, cellSize, cellSize, Math.floor(cellSize * 0.45 * k))
      }
    }
  }
  if (pathData) body += `<path d="${pathData}" ${fillAttr} />`

  // tiga mata (finder)
  const eyeOuterColor = opts.useCustomEyeColors ? opts.eyeOuterColor : opts.primaryColor
  const eyeInnerColor = opts.useCustomEyeColors ? opts.eyeInnerColor : opts.primaryColor
  const eyes = [
    { name: 'tl', x: offsetX, y: offsetY },
    { name: 'tr', x: offsetX + (size - 7) * cellSize, y: offsetY },
    { name: 'bl', x: offsetX, y: offsetY + (size - 7) * cellSize }
  ]

  for (const eye of eyes) {
    const outerDim = 7 * cellSize, innerDim = 3 * cellSize, gap = 2 * cellSize
    const ex = eye.x, ey = eye.y

    let outerPath = ''
    if (opts.eyeOuterStyle === 'square') outerPath = `M${ex},${ey} h${outerDim} v${outerDim} h-${outerDim} z`
    else if (opts.eyeOuterStyle === 'rounded') outerPath = roundRect(ex, ey, outerDim, outerDim, 1.75 * cellSize)
    else if (opts.eyeOuterStyle === 'circle') outerPath = circlePath(ex + 3.5 * cellSize, ey + 3.5 * cellSize, 3.5 * cellSize)
    else if (opts.eyeOuterStyle === 'leaf') outerPath = leafEyePath(ex, ey, outerDim, 3.5 * cellSize, eye.name)

    let cutPath = ''
    const cutX = ex + cellSize, cutY = ey + cellSize, cutDim = 5 * cellSize
    if (opts.eyeOuterStyle === 'square') cutPath = `M${cutX},${cutY} h${cutDim} v${cutDim} h-${cutDim} z`
    else if (opts.eyeOuterStyle === 'rounded') cutPath = roundRect(cutX, cutY, cutDim, cutDim, 1.25 * cellSize)
    else if (opts.eyeOuterStyle === 'circle') cutPath = circlePath(cutX + 2.5 * cellSize, cutY + 2.5 * cellSize, 2.5 * cellSize)
    else if (opts.eyeOuterStyle === 'leaf') cutPath = leafEyePath(cutX, cutY, cutDim, 2.5 * cellSize, eye.name)

    if (!opts.backgroundColor || opts.backgroundColor === 'transparent') {
      body += `<path d="${outerPath} ${cutPath}" fill="${eyeOuterColor}" fill-rule="evenodd" />`
    } else {
      body += `<path d="${outerPath}" fill="${eyeOuterColor}" />`
      body += `<path d="${cutPath}" fill="${opts.backgroundColor}" />`
    }

    let pupil = ''
    const px = ex + gap, py = ey + gap
    if (opts.eyeInnerStyle === 'square') pupil = `M${px},${py} h${innerDim} v${innerDim} h-${innerDim} z`
    else if (opts.eyeInnerStyle === 'rounded') pupil = roundRect(px, py, innerDim, innerDim, 0.75 * cellSize)
    else if (opts.eyeInnerStyle === 'circle') pupil = circlePath(px + 1.5 * cellSize, py + 1.5 * cellSize, 1.5 * cellSize)
    else if (opts.eyeInnerStyle === 'leaf') pupil = leafEyePath(px, py, innerDim, 1.5 * cellSize, eye.name)
    body += `<path d="${pupil}" fill="${eyeInnerColor}" />`
  }

  // logo tengah
  if (hasLogo) {
    const logoPx = Math.floor(qrActualSize * (opts.logoScale || 0.18))
    const lx = offsetX + Math.floor((qrActualSize - logoPx) / 2)
    const ly = offsetY + Math.floor((qrActualSize - logoPx) / 2)
    const pad = opts.logoPadding || 0
    const box = logoPx + pad * 2
    const rad = Math.floor(box * 0.25)
    body += `<rect x="${lx - pad}" y="${ly - pad}" width="${box}" height="${box}" rx="${rad}" ry="${rad}" fill="${opts.logoBgColor || '#FFFFFF'}" />`
    body += `<g transform="translate(${lx}, ${ly}) scale(${(logoPx / 24).toFixed(4)})"><path d="${ICONS[opts.logoType]}" fill="${opts.primaryColor || '#000000'}" fill-rule="evenodd" /></g>`
  }

  // frame
  if (opts.frameStyle === 'card') {
    const off = Math.floor(res * 0.03), rad = Math.floor(res * 0.04), sw = Math.max(2, Math.floor(res * 0.01))
    body += `<rect x="${off}" y="${off}" width="${res - 2 * off}" height="${res - 2 * off}" rx="${rad}" ry="${rad}" fill="none" stroke="${opts.frameColor || '#E2E8F0'}" stroke-width="${sw}" />`
  } else if (isScanMe) {
    const bh = res - activeHeight, by = activeHeight
    body += `<rect x="0" y="${by}" width="${res}" height="${bh}" fill="${opts.frameColor || '#0F172A'}" />`
    body += `<text x="${res / 2}" y="${by + bh / 2}" fill="${opts.frameTextColor || '#FFFFFF'}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="${Math.floor(bh * 0.35)}" text-anchor="middle" dominant-baseline="central">${escapeXml(opts.frameText || 'SCAN ME')}</text>`
  } else if (opts.frameStyle === 'ticket') {
    const hasBg = opts.backgroundColor && opts.backgroundColor !== 'transparent'
    const sw = Math.max(2, Math.floor(res * 0.014))
    const om = Math.floor(res * 0.05), cr = Math.floor(res * 0.07), nr = Math.floor(res * 0.034)
    const fc = opts.frameColor || '#0F172A'
    body += `<rect x="${om}" y="${om}" width="${res - om * 2}" height="${res - om * 2}" rx="${cr}" ry="${cr}" fill="none" stroke="${fc}" stroke-width="${sw}" />`
    const im = om + Math.floor(sw * 2.2)
    body += `<rect x="${im}" y="${im}" width="${res - im * 2}" height="${res - im * 2}" rx="${Math.floor(cr * 0.75)}" ry="${Math.floor(cr * 0.75)}" fill="none" stroke="${fc}" stroke-width="${Math.max(1, Math.floor(sw * 0.45))}" />`
    if (hasBg) {
      body += `<circle cx="${om}" cy="${res / 2}" r="${nr}" fill="${opts.backgroundColor}" />`
      body += `<circle cx="${res - om}" cy="${res / 2}" r="${nr}" fill="${opts.backgroundColor}" />`
      body += `<path d="M${om},${res / 2 - nr} a${nr},${nr} 0 0 0 0,${nr * 2}" fill="none" stroke="${fc}" stroke-width="${Math.max(1, Math.floor(sw * 0.6))}" />`
      body += `<path d="M${res - om},${res / 2 + nr} a${nr},${nr} 0 0 0 0,-${nr * 2}" fill="none" stroke="${fc}" stroke-width="${Math.max(1, Math.floor(sw * 0.6))}" />`
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${res} ${res}" width="${res}" height="${res}">${body}</svg>`
}

async function svgToPng(svg) {
  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// ───────── parsing opsi dari teks ─────────
const FRAMES = new Set(['card', 'ticket', 'scan-me'])
function parseOptions(tokens) {
  const opts = {}
  for (const raw of tokens) {
    const t = raw.trim().toLowerCase()
    if (!t) continue
    if (PRESETS[t]) opts.preset = t
    else if (ICONS[t] && t !== 'none') opts.logoType = t
    else if (FRAMES.has(t)) opts.frameStyle = t
    else if (/^#?[0-9a-f]{6}$/.test(t)) opts.primaryColor = t.startsWith('#') ? t : `#${t}`
  }
  if (opts.frameStyle === 'scan-me' && !opts.frameText) { opts.frameText = 'SCAN ME'; opts.frameTextColor = '#FFD43B'; opts.frameColor = '#141414' }
  return opts
}

let handler = async (m, { sock, text, reply, prefix, usedPrefix, command }) => {
  const p = usedPrefix ?? prefix ?? '.'
  const cmd = String(command || 'qr').toLowerCase()
  const raw = String(text || '').trim()

  if (cmd === 'qrlist') {
    return reply(
      `*▢ QR GENERATOR PRO*\n\n*Preset:*\n${Object.keys(PRESETS).join(', ')}\n\n` +
      `*Logo:*\n${Object.keys(ICONS).filter((k) => k !== 'none').join(', ')}\n\n` +
      `*Frame:* card, ticket, scan-me\n*Warna:* #RRGGBB\n\n` +
      `Contoh: ${p}qr https://google.com | neo-pop | google`
    )
  }

  let payload = ''
  let opts = {}

  if (cmd === 'qrwifi') {
    const [ssid, password = '', secRaw = 'WPA', ...rest] = raw.split('|').map((s) => s.trim())
    if (!ssid) return reply(`Format: ${p}qrwifi nama wifi | password | WPA\n(WPA / WEP / nopass, bawaan WPA)`)
    const sec = /^(wep|nopass)$/i.test(secRaw) ? secRaw.toUpperCase().replace('NOPASS', 'nopass') : 'WPA'
    payload = `WIFI:S:${escapeWifi(ssid)};T:${sec};P:${sec === 'nopass' ? '' : escapeWifi(password)};H:false;;`
    opts = { logoType: 'wifi', ...parseOptions(rest) }
  } else if (cmd === 'qrwa') {
    const [numRaw, msg = '', ...rest] = raw.split('|').map((s) => s.trim())
    let phone = String(numRaw || '').replace(/[^0-9+]/g, '')
    if (phone.startsWith('+')) phone = phone.slice(1)
    if (phone.startsWith('0')) phone = '62' + phone.slice(1)
    if (phone.length < 8) return reply(`Format: ${p}qrwa 08123456789 | pesan (opsional)`)
    payload = `https://wa.me/${phone}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`
    opts = { logoType: 'whatsapp', ...parseOptions(rest) }
  } else {
    const [first, ...rest] = raw.split('|')
    payload = (first || '').trim()
    if (!payload && m.quoted) payload = String(m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()
    if (!payload) {
      return reply(
        `*▢ QR GENERATOR PRO*\n\n` +
        `${p}qr <teks/link>\n` +
        `${p}qr <teks> | <preset> | <logo> | #warna | <frame>\n` +
        `${p}qrwifi nama | password | WPA\n` +
        `${p}qrwa 08123456789 | pesan\n` +
        `${p}qrlist → daftar preset & logo\n\n` +
        `Contoh: ${p}qr https://google.com | neo-pop | google`
      )
    }
    opts = parseOptions(rest)
  }

  if (payload.length > 1000) return reply('❌ Teks terlalu panjang (maksimal 1000 karakter).')

  await reactTo(sock, m, '🕒')
  try {
    const svg = generateQrSvg(payload, opts)
    const png = await svgToPng(svg)
    const caption = `*▢ QR CODE*\n\n❀ Isi : ${payload.length > 120 ? payload.slice(0, 117) + '...' : payload}\n❀ Gaya : ${opts.preset || 'custom'}`
    await sock.sendMessage(m.chat, { image: png, caption }, { quoted: m })
    return reactTo(sock, m, '✅')
  } catch (e) {
    console.error('[qrpro]', e?.message || e)
    await reactTo(sock, m, '❌')
    if (/too big|Invalid|capacity/i.test(e?.message || '')) return reply('❌ Teks terlalu panjang untuk dijadikan QR, coba perpendek.')
    return reply(`❌ Gagal membuat QR: ${e?.message || 'terjadi kesalahan'}`)
  }
}

handler.command = ['qr', 'qrpro', 'qrwifi', 'qrwa', 'qrlist']
handler.help = ['qr <teks/link> | preset | logo']
handler.tags = ['tools']
handler.limit = true

export default handler
