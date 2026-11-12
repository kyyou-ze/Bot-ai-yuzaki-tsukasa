/**
 * YannRzy Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Creator      : Rizkyrohan
 * Recode       : (Your Name)
 *
 * Official Channels:
 * • https://whatsapp.com/channel/0029VbDWBmtA89MamPba8q3f
 *
 * Copyright © Rizkyrohan 2026
 * All Rights Reserved.
 */

// ───────── catatan ─────────
// Plugin canvas: tulisan di atas gambar sticky-note (font Arial Narrow).
// Teks diambil dari input .catatan <teks>, bukan teks tetap.

import axios from 'axios'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { te, wrapPlugin, mergePlugins } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const FONT_URL = 'https://github.com/rzkrohan/Font/raw/2e114f4712fbab9e290cb822ab7bfe0b02bbcaab/arialnarrow.ttf'
const BG_URL = 'https://raw.githubusercontent.com/rzkrohan/image-canvas/refs/heads/main/IMG-20261110-WA0238.jpg'
const FONT_NAME = 'Arial Narrow Catatan'

let fontReady = false
async function loadFont() {
    if (fontReady) return
    try {
        const buf = await axios.get(FONT_URL, { responseType: 'arraybuffer', timeout: 15000 }).then(r => r.data)
        GlobalFonts.register(Buffer.from(buf), FONT_NAME)
        fontReady = true
    } catch (e) {}
}

// ── catatan ──
const _catatan = (() => {
const pluginConfig = {
    name: "katabgwindah",
    alias: ["katawindah"],
    category: "canvas",
    description: "Tulis teks di atas gambar sticky-note",
    usage: ".katabgwindah <teks>",
    example: ".katabgwindah mark tidur, besok ban grup lagi",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true,
}

async function handler(m, { sock }) {
    const content = m.text?.trim()
    if (!content) {
        return m.reply(`✏️ *CATATAN*\n\nMasukkan teks yang mau ditulis.\n\nContoh:\n${m.prefix}${pluginConfig.name} ${pluginConfig.example.split(' ').slice(1).join(' ')}`)
    }

    try {
        await loadFont()

        const width = 1594
        const height = 3200

        const atasbawah = -650
        const kanankiri = -300
        const zoom = 1

        const textZoom = 1
        const areaWidth = 650
        const areaHeight = 800
        const lineSpacing = 1.0

        const boldMode = 'tebal'
        const boldSize = 1

        const stretchY = 2
        const stretchX = 1

        const canvas = createCanvas(width, height)
        const ctx = canvas.getContext('2d')

        const bg = await loadImage(BG_URL)

        const bgWidth = width * zoom
        const bgHeight = height * zoom

        ctx.drawImage(
            bg,
            (width - bgWidth) / 2,
            (height - bgHeight) / 2,
            bgWidth,
            bgHeight
        )

        const maxChars = 10
        const maxWords = 2

        const centerX = width / 2 + kanankiri
        const centerY = height / 2 + atasbawah

        const words = content.split(/\s+/)
        const lines = []
        let line = []

        for (const word of words) {
            const totalChars = line.join('').length + word.length

            if (
                line.length >= maxWords ||
                totalChars > maxChars ||
                word.length >= maxChars
            ) {
                if (line.length) lines.push(line.join(' '))
                line = [word]
            } else {
                line.push(word)
            }
        }

        if (line.length) lines.push(line.join(' '))

        const extra = boldMode === 'tebal' ? boldSize * 2 : 0

        const maxFontSize = 400
        const minFontSize = 20

        let fontSize = maxFontSize

        while (fontSize > minFontSize) {
            const currentSize = fontSize * textZoom
            ctx.font = `${currentSize}px "${FONT_NAME}"`

            const lh = currentSize * lineSpacing * stretchY
            const widthFits = lines.every(t => ctx.measureText(t).width * stretchX + extra * stretchX <= areaWidth)
            const heightFits = lines.length * lh <= areaHeight

            if (widthFits && heightFits) break

            fontSize -= 2
        }

        const finalFontSize = fontSize * textZoom

        ctx.font = `${finalFontSize}px "${FONT_NAME}"`
        ctx.fillStyle = '#18362F'
        ctx.strokeStyle = '#18362F'
        ctx.lineJoin = 'round'
        ctx.lineWidth = boldMode === 'tebal' ? boldSize * 2 : 0
        ctx.globalAlpha = 1
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const lineHeight = finalFontSize * lineSpacing * stretchY
        const totalHeight = lines.length * lineHeight
        const startY = centerY - totalHeight / 2 + lineHeight / 2

        lines.forEach((text, i) => {
            const y = startY + i * lineHeight
            ctx.save()
            ctx.translate(centerX, y)
            ctx.scale(stretchX, stretchY)
            if (boldMode === 'tebal') ctx.strokeText(text, 0, 0)
            ctx.fillText(text, 0, 0)
            ctx.restore()
        })

        const output = await canvas.encode('jpeg', 95)

        await sock.sendMessage(m.chat, {
            image: output,
            mimetype: 'image/jpeg'
        }, { quoted: m })

        await m.react('✅')
    } catch (e) {
        await m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _catatan
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'catatan')
