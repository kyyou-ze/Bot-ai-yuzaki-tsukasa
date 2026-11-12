/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Fitur: Ephoto360 — Blackpink Logo
 * Command: .blackpinklogo <text>
 * Letakkan di: plugins/ephoto/blackpinklogo.js
 */

import axios from 'axios'
import FormData from 'form-data'
import * as cheerio from 'cheerio'

const EFFECT_URL = 'https://en.ephoto360.com/create-blackpink-logo-online-free-607.html'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'

async function ephotoEffect(url, textInput) {
    const formData = new FormData()

    const initialResponse = await axios.get(url, {
        headers: { 'user-agent': UA }
    })

    const $ = cheerio.load(initialResponse.data)

    const token = $('input[name=token]').val()
    const buildServer = $('input[name=build_server]').val()
    const buildServerId = $('input[name=build_server_id]').val()

    formData.append('text[]', textInput)
    formData.append('token', token)
    formData.append('build_server', buildServer)
    formData.append('build_server_id', buildServerId)

    const postResponse = await axios({
        url,
        method: 'POST',
        data: formData,
        headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'user-agent': UA,
            'cookie': initialResponse.headers['set-cookie']?.join('; '),
            ...formData.getHeaders()
        }
    })

    const $$ = cheerio.load(postResponse.data)
    const formValueInput = JSON.parse($$('input[name=form_value_input]').val())
    formValueInput['text[]'] = formValueInput.text
    delete formValueInput.text

    const { data: finalResponseData } = await axios.post(
        'https://en.ephoto360.com/effect/create-image',
        new URLSearchParams(formValueInput),
        {
            headers: {
                'user-agent': UA,
                'cookie': initialResponse.headers['set-cookie'].join('; ')
            }
        }
    )

    return buildServer + finalResponseData.image
}

let handler = async (m, { sock, reply, prefix, command, text }) => {
    if (!text) {
        return reply(`❌ *ᴇʀʀᴏʀ*\n\n> Masukkan text!\n> *Contoh:* ${prefix}${command} Ourin-AI`)
    }

    await m.react('🕕')

    try {
        const imageUrl = await ephotoEffect(EFFECT_URL, text)

        await sock.sendMessage(m.chat, {
            image: { url: imageUrl },
            caption: `✅ *Blackpink Logo*\n\n> Text: ${text}`
        }, { quoted: m })

        await m.react('✅')
    } catch (e) {
        await m.react('❌')
        await reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

handler.help = ['blackpinklogo <text>']
handler.tags = ['ephoto']
handler.command = ['blackpinklogo']

export default handler
