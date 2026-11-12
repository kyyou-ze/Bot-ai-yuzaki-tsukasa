import { jpmGroups, jpmCfg, jpmLoop, getMedia, mediaContent } from '../../lib/group/sosial.js'

// JPM ke grup pilihan, 3 langkah:
//   1) .jpmpilih            -> bot kirim daftar grup bernomor
//   2) balas nomor grup     -> mis. 1.2.3 atau 1,2,3 (ketik "batal" untuk membatalkan)
//   3) kirim pesan          -> teks, atau foto/video dengan caption, lalu dibroadcast
// Langkah 2 & 3 ditangani lewat customPrefix (pesan biasa dari owner di chat yang sama).

const TTL = 10 * 60 * 1000
const sessions = () => (global.__jpmPilih ||= {})

let handler = async (m, { sock, sender, jid, command, text, reply, isOwner }) => {
    // ─── langkah 1: perintah .jpmpilih ───
    if (command === 'jpmpilih') {
        const groups = await jpmGroups(sock)
        if (!groups.length) return reply('❌ Bot tidak berada di grup manapun.')

        sessions()[sender] = { step: 'nomor', chat: jid, groups: groups.map(g => ({ id: g.id, name: g.subject || g.id })), at: Date.now() }
        const rows = groups.map((g, i) => `*${i + 1}.* ${g.subject || g.id}`).join('\n')
        return reply(`*▢ JPM PILIH GRUP*\n• Total : ${groups.length} grup\n• Balas nomor grup, pisah titik/koma. Contoh: *1.2.3* atau *1,2,3*\n• Ketik *batal* untuk membatalkan\n\n${rows}`)
    }

    // ─── langkah 2 & 3: pesan biasa dari owner ───
    if (!isOwner) return false
    const st = sessions()[sender]
    if (!st || st.chat !== jid) return false
    if (Date.now() - st.at > TTL) { delete sessions()[sender]; return false }

    const input = (text || '').trim()
    if (/^(batal|cancel)$/i.test(input)) {
        delete sessions()[sender]
        return reply('✅ JPM pilih dibatalkan.')
    }

    if (st.step === 'nomor') {
        if (!/^[\d\s.,]+$/.test(input)) return false
        const picked = [...new Set(input.split(/[.,\s]+/).map(v => parseInt(v) - 1))]
            .filter(i => i >= 0 && i < st.groups.length)
            .map(i => st.groups[i])
        if (!picked.length) return reply('❌ Nomor tidak valid. Coba lagi.')

        sessions()[sender] = { ...st, step: 'pesan', picked, at: Date.now() }
        const names = picked.map((g, i) => `*${i + 1}.* ${g.name}`).join('\n')
        return reply(`*▢ GRUP DIPILIH*\n• Total : ${picked.length} grup\n\n${names}\n\n📝 Sekarang kirim pesan yang ingin di-broadcast (teks, atau foto/video dengan caption):`)
    }

    if (st.step === 'pesan') {
        delete sessions()[sender]
        const media = await getMedia(m)
        const delay = jpmCfg().delayJpm
        await reply(`*▢ JPM DIMULAI*\n• Target : ${st.picked.length} grup\n• Delay : ${delay}ms`)

        const { ok, fail } = await jpmLoop(st.picked, delay, g =>
            sock.sendMessage(g.id, media ? mediaContent(media, input) : { text: input }))

        return reply(`*▢ JPM SELESAI*\n• Berhasil : ${ok} grup\n• Gagal : ${fail} grup`)
    }

    return false
}

handler.command = ['jpmpilih']
handler.customPrefix = /^[\s\S]+/
handler.tags = ['jpm']
handler.owner = true

export default handler
