/**
 * Struk pembayaran untuk transaksi yang berhasil.
 * 1) Dibuat langsung di bot (lib/store/struk-image.js, memakai @napi-rs/canvas + font di lib/store/fonts).
 * 2) Kalau gagal, minta ke gateway (POST /api/maker/struk) lewat fungsi gateway() yang dikirim pemanggil.
 * File ini sengaja tidak mengimpor merchant.js supaya tidak ada import melingkar.
 */

// Kota dari QRIS statis (tag 60), dipakai kalau global.merchantGw.storeCity kosong
export function qrisCity() {
    try {
        const q = String(global.qrisStatic || '').replace(/[\r\n]+/g, '').trim()
        let i = 0
        while (i + 4 <= q.length) {
            const tag = q.slice(i, i + 2)
            const len = parseInt(q.slice(i + 2, i + 4), 10)
            if (Number.isNaN(len) || i + 4 + len > q.length) break
            if (tag === '60') return q.slice(i + 4, i + 4 + len)
            i += 4 + len
        }
    } catch { /* abaikan */ }
    return ''
}

/** Buat gambar struk (Buffer PNG). Melempar error kalau semua cara gagal. */
export async function renderStruk(payload, gateway) {
    let localErr = null
    try {
        const { generateStrukImage } = await import('./struk-image.js')
        const png = await generateStrukImage(payload)
        if (png?.length) return png
        localErr = new Error('hasil kosong')
    } catch (e) {
        localErr = e
    }

    if (typeof gateway === 'function') {
        try {
            const r = await gateway('/api/maker/struk', { method: 'POST', body: payload, timeout: 20_000 })
            if (r.ok && r.data?.base64) return Buffer.from(r.data.base64, 'base64')
            throw new Error(r.data?.error || `HTTP ${r.httpStatus}`)
        } catch (e) {
            throw new Error(`struk lokal gagal (${localErr?.message || localErr}); struk gateway gagal (${e?.message || e})`)
        }
    }
    throw localErr
}
