/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Search — Resep Cookpad Indonesia
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  .cookpad nasi goreng   |   .cookpad detail 26390975   |   .cookpad detail <link resep>
 */

import axios from 'axios'
import * as cheerio from 'cheerio'

const client = axios.create({
    baseURL: 'https://cookpad.com',
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
    }
})

export async function search(query, page = 1) {
    const { data } = await client.get(`/id/cari/${encodeURIComponent(query)}`, { params: page > 1 ? { page } : undefined })
    const $ = cheerio.load(data)
    const results = []

    $('#search-recipes-list > li[id^="recipe_"]').each((_, el) => {
        const $el = $(el)
        const id = ($el.attr('id') || '').replace('recipe_', '')
        if (!id) return
        const title = $el.find('a.block-link__main').first().text().trim().replace(/\s+/g, ' ')
        if (!title) return

        const author = $el.find('img[alt][title]').last().attr('alt') || $el.find('span.break-all span').last().text().trim() || null
        const duration = $el.find('.mise-icon-time').parent().find('.mise-icon-text').first().text().trim() || null
        const servings = $el.find('.mise-icon-user').parent().find('.mise-icon-text').first().text().trim() || null

        const ingredientsPreview = []
        const ingText = $el.find('[data-ingredients-redesign-target="ingredients"] .line-clamp-2').text() || ''
        ingText.split('•').forEach(t => { const c = t.trim(); if (c && c.length > 1) ingredientsPreview.push(c) })

        results.push({
            id, title, author, duration, servings,
            ingredientsPreview: ingredientsPreview.slice(0, 8),
            image: $el.find('img[src*="cpcdn.com/recipes"]').attr('src') || null,
            url: `https://cookpad.com/id/resep/${id}`
        })
    })
    return results
}

export async function detail(idOrUrl) {
    const id = String(idOrUrl).match(/(\d+)/)?.[1] || idOrUrl
    const { data } = await client.get(`/id/resep/${id}`)
    const $ = cheerio.load(data)
    let recipe = null
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const json = JSON.parse($(el).html())
            const list = Array.isArray(json) ? json : [json]
            for (const j of list) if (j['@type'] === 'Recipe') recipe = j
        } catch {}
    })
    if (!recipe) throw new Error('Resep tidak ditemukan')
    return {
        id,
        title: recipe.name,
        description: recipe.description || '',
        image: Array.isArray(recipe.image) ? recipe.image[0] : recipe.image,
        author: recipe.author?.name || '',
        yield: recipe.recipeYield || '',
        cuisine: recipe.recipeCuisine || '',
        datePublished: recipe.datePublished || '',
        ingredients: (recipe.recipeIngredient || []).map(i => String(i).trim()).filter(Boolean),
        steps: (recipe.recipeInstructions || []).map(s => String(s.text || s).trim()).filter(Boolean),
        url: `https://cookpad.com/id/resep/${id}`
    }
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

let handler = async (m, { sock, text, reply, example, prefix }) => {
    const p = prefix || '.'
    const body = String(text || '').trim()
    if (!body) return example('nasi goreng   |   detail 26390975')

    // ===== .cookpad detail <id/link> =====
    const dm = body.match(/^(?:detail|resep)\s+(.+)$/i)
    if (dm) {
        let r
        try { r = await detail(dm[1]) } catch (e) { return reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}` : e.message}`) }

        const head =
            `🍳 *${r.title}*\n\n` +
            (r.author ? `👩‍🍳 ${r.author}\n` : '') +
            (r.yield ? `🍽️ Porsi: ${r.yield}\n` : '') +
            (r.datePublished ? `📅 ${String(r.datePublished).slice(0, 10)}\n` : '') +
            (r.description ? `\n${clip(r.description, 300)}\n` : '') +
            `\n🧂 *Bahan*\n${r.ingredients.map(i => `• ${i}`).join('\n')}\n\n🔗 ${r.url}`
        const steps = `👨‍🍳 *Langkah*\n\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}`

        if (r.image) {
            try { await sock.sendMessage(m.chat, { image: { url: r.image }, caption: clip(head, 1000) }, { quoted: m }) }
            catch { await reply(head) }
        } else await reply(head)
        return reply(clip(steps, 3800))
    }

    // ===== .cookpad <kata kunci> =====
    let list
    try { list = await search(body) } catch (e) { return reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}` : e.message}`) }
    if (!list.length) return reply(`Resep "${body}" tidak ditemukan.`)

    const top = list.slice(0, 8)
    const out =
        `🍲 *COOKPAD: ${body}*\n\n` +
        top.map((r, i) => `${i + 1}. *${r.title}*\n   👩‍🍳 ${r.author || '-'} | ⏱️ ${r.duration || '-'} | 🍽️ ${r.servings || '-'}\n   🆔 ${r.id}` +
            (r.ingredientsPreview.length ? `\n   🧂 ${clip(r.ingredientsPreview.join(', '), 90)}` : '')).join('\n\n') +
        `\n\nLihat resep lengkap: ${p}cookpad detail <id>`

    try {
        await sock.sendButtons(m.chat, {
            text: out,
            footer: global.namebot || 'Kaguya MD',
            ...(top[0].image ? { image: { url: top[0].image } } : {}),
            buttons: [{
                type: 'list',
                text: '📖 Pilih Resep',
                sections: [{ title: 'Hasil Cookpad', rows: top.map(r => ({ title: clip(r.title, 24), description: clip(`${r.author || '-'} • ${r.duration || '-'}`, 72), id: `${p}cookpad detail ${r.id}` })) }]
            }]
        }, { quoted: m })
    } catch {
        return reply(out)
    }
}

handler.command = ['cookpad']
handler.help = ['cookpad <resep>', 'cookpad detail <id/link>']
handler.tags = ['search']
handler.limit = true

export default handler
