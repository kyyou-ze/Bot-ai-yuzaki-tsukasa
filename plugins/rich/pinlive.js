import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "livenet": (module, exports, require) => {
// Penyalaan relay + tunnel milik fitur pinlive (server relay lokal WebSocket + tunnel cloudflared),
// supaya kartu di dalam chat bisa mengambil data lewat jaringan (sandbox kartu WA tidak boleh fetch biasa).
// start() aman dipanggil berkali-kali. Matikan dengan LIVENET=off (environment variable).
const pin = require('livenet/pinlive-relay'), pinT = require('livenet/pinlive-tunnel')

let started = false
function start() {
  if (started) return
  started = true
  if (String(process.env.LIVENET || '').toLowerCase() === 'off') { console.log('[livenet] LIVENET=off — pinlive tidak dinyalakan'); return }
  setTimeout(() => { try { pin.nyalakan(); pinT.nyalakan() } catch (e) { console.log('[pinlive] gagal nyala:', e.message) } }, 1000)
}
module.exports = { start, pin, pinT }
    },
    "livenet/pinlive-tunnel": (module, exports, require) => {
// ===========================================================================
// PINLIVE — tunnel
//
// Salinan pola dari lib/catur-tunnel.js dan lib/musiklive-tunnel.js,
// disesuaikan buat relay Pinlive (lib/pinlive-relay.js) yang jalan di port
// terpisah. Tidak dibuat satu tunnel gabungan dengan yang lain karena satu
// proses `cloudflared tunnel --url` cuma bisa mengarah ke satu port tujuan —
// jadi tiap relay (catur, musik, pin) punya proses cloudflared dan berkas
// URL-nya masing-masing, tapi semuanya boleh menyala bersamaan tanpa bentrok.
//
// Matikan penyalaan otomatis lewat PINLIVE_TUNNEL=off.
//
// Dipakai index.js:
//   const { bacaRelayPin } = require('./lib/pinlive-tunnel');
// ===========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pastikanCloudflared } = require('livenet/cloudflared');
const relay = require('livenet/pinlive-relay');


const URL_FILE = path.join(process.cwd(), 'database', 'runtime', 'livenet-pinlive-tunnel-url.txt');

let proses = null;
let sudahNyala = false;
let gagalBeruntun = 0;
const MAKS_GAGAL = 3;

function jadwalUlang() {
    if (gagalBeruntun >= MAKS_GAGAL) {
        console.log('⛔ [PINLIVE] tunnel gagal ' + MAKS_GAGAL + ' kali beruntun — menyerah. ' +
            'Perbaiki cloudflared lalu restart bot.');
        return;
    }
    setTimeout(jalankanCloudflared, 5000);
}

async function cariCloudflared() {
    const kandidat = [
        process.env.CLOUDFLARED_BIN,
        path.join(os.homedir(), 'cloudflared'),
        path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
        path.join(process.cwd(), 'cloudflared'),
        path.join(process.cwd(), 'bin', 'cloudflared'),
        '/usr/local/bin/cloudflared',
        '/usr/bin/cloudflared',
        '/usr/sbin/cloudflared',
        '/snap/bin/cloudflared',
        '/opt/cloudflared/cloudflared',
        '/opt/homebrew/bin/cloudflared'
    ].filter(Boolean);

    for (const j of kandidat) {
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const j = path.join(dir, 'cloudflared');
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    // Auto-download jika tidak ketemu
    return await pastikanCloudflared();
}

/** Ditulis ke log waktu tidak ketemu, biar jelas di mana saja sudah dicari. */
function tempatDicari() {
    return [
        'CLOUDFLARED_BIN (env)',
        '~/cloudflared', '~/.local/bin/cloudflared',
        './cloudflared', './bin/cloudflared',
        '/usr/local/bin', '/usr/bin', '/usr/sbin', '/snap/bin', '/opt/cloudflared', '/opt/homebrew/bin',
        'semua folder di PATH'
    ].join(', ');
}

function pastikanBisaDieksekusi(bin) {
    try { fs.accessSync(bin, fs.constants.X_OK); return true; } catch (e) { }
    try {
        fs.chmodSync(bin, 0o755);
        fs.accessSync(bin, fs.constants.X_OK);
        console.log('🔧 [PINLIVE] izin eksekusi cloudflared diperbaiki (chmod +x)');
        return true;
    } catch (e) {
        console.log('⚠️ [PINLIVE] cloudflared ada di ' + bin + ' tapi tidak bisa dieksekusi (' +
            (e && e.code || 'EACCES') + '). Jalankan: chmod +x ' + bin);
        return false;
    }
}

async function jalankanCloudflared() {
    if (proses) return;

    const bin = await cariCloudflared();
    if (!bin) {
        console.log('ℹ️ [PINLIVE] cloudflared tidak ketemu di mesin ini. Dicari di: ' + tempatDicari() + '.\n' +
            '   Pasang cloudflared di node ini, atau tunjuk lokasinya lewat CLOUDFLARED_BIN=/path/ke/cloudflared (environment variable).');
        return;
    }
    if (!pastikanBisaDieksekusi(bin)) return;

    let dapat = false, buf = '';
    const mulai = Date.now();
    try {
        proses = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + relay.PORT]);
    } catch (e) {
        console.log('⚠️ [PINLIVE] tunnel gagal dijalankan:', e && e.message);
        proses = null;
        return;
    }

    proses.on('error', (e) => {
        proses = null;
        console.log('⚠️ [PINLIVE] cloudflared gagal dijalankan: ' + (e && e.code || '') + ' ' + (e && e.message || ''));
        if (e && e.code === 'EACCES') console.log('   Perbaiki dengan: chmod +x ' + bin);
        jadwalUlang();
    });

    const baca = (chunk) => {
        buf += chunk.toString();
        if (buf.length > 40000) buf = buf.slice(-8000);
        const m = buf.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (m && !dapat) {
            dapat = true;
            const u = 'wss://' + m[0].slice('https://'.length);
            try {
                fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });
                fs.writeFileSync(URL_FILE, u);
            } catch (e) { }
            console.log('✅ [PINLIVE] tunnel aktif: ' + u);
        }
    };
    proses.stdout.on('data', baca);
    proses.stderr.on('data', baca);

    proses.on('exit', () => {
        proses = null;
        if (dapat) gagalBeruntun = 0;
        else if (Date.now() - mulai < 5000) gagalBeruntun++;
        // Alamat lama HARUS dihapus. Kalau berkasnya dibiarkan, kartu .spotifyx
        // berikutnya tetap menanam alamat tunnel yang sudah mati, dan pemakainya
        // cuma melihat "Menyambung ke server..." tanpa penjelasan. Lebih baik
        // kartunya jujur bilang servernya mati.
        try { fs.unlinkSync(URL_FILE); } catch (e) { }
        console.log('🔁 [PINLIVE] tunnel mati.');
        jadwalUlang();
    });

    setTimeout(() => {
        if (proses && !dapat) { try { proses.kill(); } catch (e) { } }
    }, 60000);
}

function nyalakan() {
    if (sudahNyala) return;
    sudahNyala = true;
    if (String(process.env.PINLIVE_TUNNEL || '').toLowerCase() === 'off') {
        console.log('ℹ️ [PINLIVE] PINLIVE_TUNNEL=off — tunnel tidak dinyalakan dari sini');
        return;
    }
    relay.saatSiap((aktif) => {
        if (!aktif) {
            console.log('⚠️ [PINLIVE] server pin live tidak jalan — tunnel dilewati');
            return;
        }
        jalankanCloudflared();
    });
}

/** URL relay buat ditanam di kartu, dibaca ulang tiap kartu dibuat (lihat catatan sama di catur-tunnel.js). */
function bacaRelayPin() {
    if (!relay.aktif()) return '';
    try {
        const u = fs.readFileSync(URL_FILE, 'utf8').trim();
        return /^wss?:\/\//.test(u) ? u : '';
    } catch (e) { return ''; }
}

module.exports = { nyalakan, bacaRelayPin, URL_FILE };
    },
    "livenet/pinlive-relay": (module, exports, require) => {
// ===========================================================================
// PINLIVE — server relay
//
// Pola dan mesin WebSocket-nya SENGAJA disalin dari lib/catur-relay.js dan
// lib/musiklive-relay.js (server HTTP+WS tulisan sendiri di atas modul bawaan
// Node, tanpa paket "ws") supaya konsisten dengan cara kartu game lain di bot
// ini menembus sandbox WhatsApp: kartu HTML richResponseMessage TIDAK BISA
// fetch/<img>/<video> ke URL luar (lihat catatan di scrape/richhtml.js) —
// satu-satunya jalan keluar yang terbukti jalan adalah WebSocket. Makanya
// thumbnail & gambar penuh Pinterest di sini TIDAK dikirim sebagai link,
// tapi dipompa sebagai potongan base64 lewat socket yang sama, lalu dirakit
// jadi Blob di kartunya sendiri.
//
// Beda dengan Spotifylive: tidak ada ruangan "dengerin bareng" - Pinlive
// murni sesi pencarian+lihat gambar sendirian, jadi bagian broadcast/room
// dari musiklive-relay.js sengaja tidak disalin ke sini.
//
// Kalau port-nya bentrok, fitur ini mati sendiri dan bot tetap jalan normal —
// modul ini tidak pernah melempar error ke pemanggilnya.
//
// Dipakai index.js:  require('./lib/pinlive-relay').nyalakan();
// ===========================================================================

const http = require('http');
const pinHttp = http;
const crypto = require('crypto');
const pinCrypto = crypto;
const { EventEmitter: pinEventsEmitter } = require('events');
const pinEvents = { EventEmitter: pinEventsEmitter };
const axios = require('axios');
const { searchPinterest } = require('livenet/pinterest');

const PINLIVE_PORT = parseInt(process.env.PINLIVE_PORT || '3941', 10);
const PIN_MAKS_PESAN = 400 * 1024;
const PIN_BONGKAH = 120 * 1024;              // ukuran satu potongan base64 gambar/video
const PIN_MAKS_GAMBAR = 8 * 1024 * 1024;     // batas ukuran gambar "orig" yang mau diambil
const PIN_MAKS_VIDEO = 20 * 1024 * 1024;     // batas ukuran video pin yang mau diambil
const PIN_MAKS_HASIL = 20;                   // sama dengan limit dipakai command .pin biasa
const PIN_BATAS_TOTAL_SESI = 200;            // batas atas total pin yang boleh ditumpuk per sesi gulir tanpa henti

// ---------------------------------------------------------------------------
// 1. SERVER WEBSOCKET MINIMAL (RFC 6455) — identik pola dengan catur-relay.js
// ---------------------------------------------------------------------------

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function pinBingkai(opcode, payload) {
    const len = payload.length;
    let head;
    if (len < 126) {
        head = Buffer.allocUnsafe(2);
        head[1] = len;
    } else if (len < 65536) {
        head = Buffer.allocUnsafe(4);
        head[1] = 126;
        head.writeUInt16BE(len, 2);
    } else {
        head = Buffer.allocUnsafe(10);
        head[1] = 127;
        head.writeUInt32BE(0, 2);
        head.writeUInt32BE(len, 6);
    }
    head[0] = 0x80 | opcode;
    return Buffer.concat([head, payload]);
}

/** Bungkus satu koneksi TCP jadi objek mirip soket ws: .send/.close/.on */
function pinSoket(socket) {
    const ws = new pinEvents.EventEmitter();
    ws.readyState = 1;
    ws.alive = true;

    let sisa = Buffer.alloc(0);
    let fragOp = 0;
    let fragBuf = [];
    let fragLen = 0;

    const tulis = (buf) => { try { if (!socket.destroyed) socket.write(buf); } catch (e) { } };

    ws.send = (teks) => {
        if (ws.readyState !== 1) return;
        tulis(pinBingkai(1, Buffer.from(String(teks), 'utf8')));
    };
    ws.ping = () => { if (ws.readyState === 1) tulis(pinBingkai(9, Buffer.alloc(0))); };
    ws.close = (kode) => {
        if (ws.readyState !== 1) return;
        const p = Buffer.allocUnsafe(2);
        p.writeUInt16BE(kode || 1000, 0);
        tulis(pinBingkai(8, p));
        ws.readyState = 3;
        try { socket.end(); } catch (e) { }
    };
    ws.terminate = () => { ws.readyState = 3; try { socket.destroy(); } catch (e) { } };

    const tutupPaksa = (kode) => { try { ws.close(kode); } catch (e) { } ws.terminate(); };

    const pesanUtuh = (opcode, data) => {
        if (opcode === 1) ws.emit('message', data.toString('utf8'));
    };

    socket.on('data', (chunk) => {
        sisa = sisa.length ? Buffer.concat([sisa, chunk]) : chunk;

        while (true) {
            if (sisa.length < 2) break;
            const b0 = sisa[0], b1 = sisa[1];
            const fin = (b0 & 0x80) !== 0;
            const opcode = b0 & 0x0f;
            const bermask = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f;
            let off = 2;

            if (len === 126) {
                if (sisa.length < 4) break;
                len = sisa.readUInt16BE(2); off = 4;
            } else if (len === 127) {
                if (sisa.length < 10) break;
                if (sisa.readUInt32BE(2) !== 0) return tutupPaksa(1009);
                len = sisa.readUInt32BE(6); off = 10;
            }

            if (len > PIN_MAKS_PESAN) return tutupPaksa(1009);
            if (!bermask) return tutupPaksa(1002);
            if (sisa.length < off + 4) break;

            const total = off + 4 + len;
            if (sisa.length < total) break;

            const mask = sisa.slice(off, off + 4);
            const mentah = sisa.slice(off + 4, total);
            const data = Buffer.allocUnsafe(len);
            for (let i = 0; i < len; i++) data[i] = mentah[i] ^ mask[i & 3];
            sisa = sisa.slice(total);

            if (opcode === 8) return tutupPaksa(1000);
            if (opcode === 9) { tulis(pinBingkai(10, data)); continue; }
            if (opcode === 10) { ws.alive = true; continue; }

            if (opcode === 0) {
                if (!fragOp) return tutupPaksa(1002);
                fragLen += len;
                if (fragLen > PIN_MAKS_PESAN) return tutupPaksa(1009);
                fragBuf.push(data);
                if (fin) {
                    const gabung = Buffer.concat(fragBuf, fragLen);
                    const op = fragOp;
                    fragOp = 0; fragBuf = []; fragLen = 0;
                    pesanUtuh(op, gabung);
                }
                continue;
            }

            if (opcode === 1 || opcode === 2) {
                if (fin) { pesanUtuh(opcode, data); continue; }
                fragOp = opcode; fragBuf = [data]; fragLen = len;
                continue;
            }

            return tutupPaksa(1002);
        }
    });

    const selesai = () => {
        if (ws.readyState === 3 && ws.sudahTutup) return;
        ws.sudahTutup = true;
        ws.readyState = 3;
        ws.emit('close');
    };
    socket.on('close', selesai);
    socket.on('end', selesai);
    socket.on('error', () => { try { socket.destroy(); } catch (e) { } selesai(); });

    return ws;
}

function pinKirim(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

// ---------------------------------------------------------------------------
// 2. PENCARIAN & PENGAMBILAN GAMBAR
// ---------------------------------------------------------------------------

async function pinAmbilBytes(url, batasByte) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        maxContentLength: batasByte,
        maxBodyLength: batasByte,
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return Buffer.from(res.data);
}

// Thumbnail grid dikirim langsung sebagai data URI (kecil, ~236px) - tidak
// perlu dipotong-potong seperti gambar penuh. Dicache per URL biar pencarian
// ulang kata kunci yang sama tidak menarik ulang gambar yang sudah pernah
// diambil.
const pinThumbCache = new Map();
const PIN_THUMB_CACHE_MAKS = 400;

async function pinAmbilThumb(url) {
    if (!url) return null;
    if (pinThumbCache.has(url)) return pinThumbCache.get(url);
    try {
        const buf = await pinAmbilBytes(url, 1.5 * 1024 * 1024);
        const b64 = 'data:image/jpeg;base64,' + buf.toString('base64');
        if (pinThumbCache.size >= PIN_THUMB_CACHE_MAKS) pinThumbCache.delete(pinThumbCache.keys().next().value);
        pinThumbCache.set(url, b64);
        return b64;
    } catch (e) {
        pinThumbCache.set(url, null);
        return null;
    }
}

// Saran tag di bawah kolom cari. Pinterest tidak selalu membocorkan daftar
// "related searches" yang stabil lewat endpoint yang dipakai di sini, jadi
// dibikin heuristik dari kata kuncinya sendiri - bukan hasil scrape asli.
function pinSaranTag(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const dasar = q.split(/\s+/)[0];
    return [`${q} aesthetic`, `${q} wallpaper`, `${q} hd`, `${dasar} art`].slice(0, 4);
}

async function pinTanganiCari(ws, q) {
    const query = String(q || '').trim();
    if (!query) return pinKirim(ws, { t: 'pl_err', m: 'Ketik kata kunci dulu.' });
    try {
        const hasil = await searchPinterest(query, { limit: PIN_MAKS_HASIL });
        if (!hasil.result.length) {
            return pinKirim(ws, { t: 'pl_kosong', q: query });
        }

        // Simpan hasil mentah di soket ini - dipakai lagi waktu kartu minta
        // gambar penuh/unduh berdasarkan index, tanpa perlu cari ulang.
        ws.pinHasil = hasil.result;
        ws.pinQuery = query;
        // Token halaman lanjutan + daftar id yang sudah pernah dikirim -
        // keduanya dipakai pinTanganiLanjut() di bawah waktu kartu gulir
        // sampai bawah dan minta batch pin berikutnya buat kata kunci yang
        // sama (lihat pl_lanjut).
        ws.pinBookmark = hasil.bookmark || null;
        ws.pinIdSet = new Set(hasil.result.map((p) => p.id).filter(Boolean));

        const thumbs = await Promise.all(hasil.result.map((p) => pinAmbilThumb(p.thumb)));

        pinKirim(ws, {
            t: 'pl_hasil',
            q: query,
            tags: pinSaranTag(query),
            // Kartu pakai ini buat tahu boleh tidaknya auto-muat lagi waktu
            // gulir sampai bawah tanpa perlu nunggu satu percobaan pl_lanjut
            // gagal dulu.
            habis: !ws.pinBookmark,
            list: hasil.result.map((p, i) => ({
                i,
                title: p.title,
                pinner: p.pinner,
                link: p.link,
                domain: p.domain,
                thumb: thumbs[i] || null,
                // Cuma penanda ada/tidaknya video (boolean) - URL video
                // aslinya TIDAK dikirim ke kartu, tetap disimpan di
                // ws.pinHasil server-side, baru diambil pas kartu minta
                // media index ini (sama pola dengan gambar "orig").
                video: !!p.video
            }))
        });
    } catch (e) {
        console.error('[PINLIVE] gagal cari:', e && e.message);
        pinKirim(ws, { t: 'pl_err', m: 'Pencarian gagal. Coba kata kunci lain.' });
    }
}

// Dipanggil waktu kartu gulir grid sampai (hampir) bawah dan minta batch pin
// BERIKUTNYA buat kata kunci yang sedang aktif, supaya orangnya tidak
// mentok cuma dapat PIN_MAKS_HASIL foto pertama - persis pola "muat lagi"
// feed Pinterest asli, tapi dipicu otomatis dari gulir kartu (lihat
// cobaMuatLanjut() di sisi HTML/JS kartunya).
async function pinTanganiLanjut(ws, q) {
    const query = String(q || '').trim();
    // Kartu sudah ganti kata kunci lain (atau belum pernah cari sama
    // sekali) selagi pesan ini di jalan - abaikan diam-diam, jangan
    // dianggap error. Sama polanya dengan pemeriksaan d.q di pinTanganiMedia.
    if (!query || query !== ws.pinQuery) return;

    if (!ws.pinBookmark || (ws.pinHasil || []).length >= PIN_BATAS_TOTAL_SESI) {
        return pinKirim(ws, { t: 'pl_habis', q: query });
    }

    try {
        const hasil = await searchPinterest(query, { limit: PIN_MAKS_HASIL, bookmark: ws.pinBookmark });
        // Balasan Pinterest baru sampai setelah kata kuncinya berganti lagi -
        // buang, jangan disentuh ke ws.pinHasil/ws.pinBookmark sama sekali.
        if (query !== ws.pinQuery) return;

        ws.pinBookmark = hasil.bookmark || null;

        const baru = hasil.result.filter((p) => p.id && !ws.pinIdSet.has(p.id));
        if (!baru.length) {
            // Pinterest kadang balikin isinya pin yang sudah pernah dikirim
            // waktu bookmark-nya sudah mepet ujung daftar - dianggap sudah
            // habis daripada kartu nampilin "memuat" terus tanpa hasil baru.
            return pinKirim(ws, { t: 'pl_habis', q: query });
        }

        const offsetMulai = ws.pinHasil.length;
        baru.forEach((p) => ws.pinIdSet.add(p.id));
        ws.pinHasil = ws.pinHasil.concat(baru);

        const thumbs = await Promise.all(baru.map((p) => pinAmbilThumb(p.thumb)));

        pinKirim(ws, {
            t: 'pl_hasil_tambahan',
            q: query,
            habis: !ws.pinBookmark,
            list: baru.map((p, k) => ({
                i: offsetMulai + k,
                title: p.title,
                pinner: p.pinner,
                link: p.link,
                domain: p.domain,
                thumb: thumbs[k] || null,
                video: !!p.video
            }))
        });
    } catch (e) {
        console.error('[PINLIVE] gagal muat lanjutan:', e && e.message);
        pinKirim(ws, { t: 'pl_err', m: 'Gagal memuat foto berikutnya. Coba gulir lagi.' });
    }
}

// Ambil & kirim media (gambar ATAU video) penuh punya satu pin, dipotong
// jadi bongkahan base64 kayak gambar sebelumnya - videonya juga dikirim data
// URI lewat WebSocket yang sama (sandbox kartu WhatsApp tidak bisa <video
// src="https://...">, lihat catatan di kepala file ini).
//
// kind: 'image' | 'video'. Kalau kind video tapi pin ini ternyata tidak
// punya video (atau gagal diambil), otomatis balik ke gambarnya (fallback)
// supaya kartu tetap nampilin sesuatu daripada mentok error - dan kartu
// dikasih tahu lewat flag `fallback:true` biar bisa kasih pesan yang jujur.
async function pinTanganiMedia(ws, i, kind, karenaGagal, q) {
    const idx = Number(i);
    const daftar = ws.pinHasil || [];
    const pin = daftar[idx];
    if (!pin) return pinKirim(ws, { t: 'pl_err', m: 'Pin tidak ditemukan, coba cari ulang.' });

    const mauVideo = kind === 'video' && !!pin.video;
    const fallbackDariVideo = !!karenaGagal || (kind === 'video' && !pin.video);

    if (!mauVideo && !pin.image) {
        return pinKirim(ws, { t: 'pl_err', m: 'Pin ini tidak punya media yang bisa ditampilkan.' });
    }

    const sumber = mauVideo ? pin.video : pin.image;
    const kindAkhir = mauVideo ? 'video' : 'image';
    const mime = mauVideo ? 'video/mp4' : 'image/jpeg';
    const batas = mauVideo ? PIN_MAKS_VIDEO : PIN_MAKS_GAMBAR;

    pinKirim(ws, { t: 'pl_media_proses', i: idx, kind: kindAkhir, q });
    try {
        const buf = await pinAmbilBytes(sumber, batas);
        const b64 = buf.toString('base64');
        const totalBongkah = Math.ceil(b64.length / PIN_BONGKAH) || 1;

        pinKirim(ws, {
            t: 'pl_media_meta',
            i: idx,
            kind: kindAkhir,
            mime,
            title: pin.title,
            pinner: pin.pinner,
            link: pin.link,
            // URL media aslinya, supaya tombol Salin di kartu bisa menyalin
            // alamat foto/video yang SEDANG ditampilkan - bukan cuma link
            // halaman Pinterest-nya. Kalau pin ini jatuh balik dari video ke
            // gambar, yang terkirim otomatis URL gambarnya (ikut `sumber`).
            media: sumber,
            fallback: fallbackDariVideo,
            totalBongkah,
            q
        });

        for (let c = 0; c < totalBongkah; c++) {
            if (ws.readyState !== 1) return;
            pinKirim(ws, { t: 'pl_media_bongkah', i: idx, kind: kindAkhir, c, data: b64.slice(c * PIN_BONGKAH, (c + 1) * PIN_BONGKAH), q });
        }
        pinKirim(ws, { t: 'pl_media_selesai', i: idx, kind: kindAkhir, q });
    } catch (e) {
        console.error('[PINLIVE] gagal ambil media penuh (' + kindAkhir + '):', e && e.message);
        if (mauVideo && pin.image) {
            // Video gagal diambil (mis. link video sudah kedaluwarsa) - coba
            // balik ke gambar biar kartu tidak mentok kosong.
            return pinTanganiMedia(ws, i, 'image', true, q);
        }
        pinKirim(ws, { t: 'pl_err', m: (mauVideo ? 'Video' : 'Gambar') + ' gagal diambil. Coba pin lain.' });
    }
}

// ---------------------------------------------------------------------------
// 3. KUNCI SESI — identik pola dengan Spotifylive (lihat catatan lengkap di
//    lib/musiklive-relay.js). Sengaja Map terpisah, BUKAN dipakai bareng,
//    supaya kunci Pinlive dan Spotifylive tidak bisa saling dipertukarkan.
// ---------------------------------------------------------------------------
const PIN_UMUR_KUNCI = 30 * 60 * 1000;
const PIN_UMUR_KUNCI_BEBAS = 24 * 60 * 60 * 1000;
const pinKunci = new Map(); // kunci -> { bot, sampai, buang }

function pinBuatKunci(botNumber, opts) {
    pinBersihkanKunci();
    const bebas = !!(opts && opts.bebas);
    const kunci = pinCrypto.randomBytes(9).toString('base64url');
    pinKunci.set(kunci, {
        bot: String(botNumber || ''),
        sampai: bebas ? 0 : Date.now() + PIN_UMUR_KUNCI,
        buang: Date.now() + (bebas ? PIN_UMUR_KUNCI_BEBAS : PIN_UMUR_KUNCI)
    });
    return kunci;
}

function pinBersihkanKunci() {
    const now = Date.now();
    for (const [k, v] of pinKunci) if ((v.buang || v.sampai) < now) pinKunci.delete(k);
}

function pinPakaiKunci(ws, kunci) {
    const v = pinKunci.get(String(kunci || ''));
    if (!v || (v.sampai && v.sampai < Date.now())) {
        pinKirim(ws, { t: 'pl_kunci_habis' });
        try { ws.close(); } catch (e) { }
        return;
    }
    ws.pinBot = v.bot;
    ws.pinSampai = v.sampai;
    pinKirim(ws, { t: 'pl_kunci_ok', sampai: v.sampai });
}

// ---------------------------------------------------------------------------
// 4. PENERUS PESAN
// ---------------------------------------------------------------------------

function pinTangani(ws, d) {
    if (d.t === 'pl_kunci') return pinPakaiKunci(ws, d.kunci);
    if (d.t === 'pl_cari') return void pinTanganiCari(ws, d.q);
    if (d.t === 'pl_lanjut') return void pinTanganiLanjut(ws, d.q);
    if (d.t === 'pl_media') return void pinTanganiMedia(ws, d.i, d.kind === 'video' ? 'video' : 'image', false, d.q);
    if (d.t === 'pl_ping') return pinKirim(ws, { t: 'pl_pong', ts: d.ts });
}

// ---------------------------------------------------------------------------
// 5. NYALAKAN SERVER
// ---------------------------------------------------------------------------

let pinAktifFlag = false;
let pinStatus = 'belum';
let pinAntreSiap = [];
const pinSemuaSoket = new Set();

function pinTetapkanStatus(st) {
    if (pinStatus !== 'belum') return;
    pinStatus = st;
    pinAktifFlag = (st === 'aktif');
    const antre = pinAntreSiap;
    pinAntreSiap = [];
    for (const fn of antre) { try { fn(pinAktifFlag); } catch (e) { } }
}

function pinNyalakanServer() {
    const srv = pinHttp.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (String(req.url || '/').split('?')[0] === '/pinlive/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('PINLIVE ok');
        } else { res.writeHead(404); res.end(); }
    });

    srv.on('upgrade', (req, socket) => {
        const kunci = req.headers['sec-websocket-key'];
        if (!kunci || String(req.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
            try { socket.destroy(); } catch (e) { }
            return;
        }
        const terima = pinCrypto.createHash('sha1').update(kunci + WS_MAGIC).digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + terima + '\r\n\r\n'
        );
        socket.setNoDelay(true);

        const ws = pinSoket(socket);
        pinSemuaSoket.add(ws);
        ws.pesanPerDetik = 0;

        ws.on('message', (teks) => {
            ws.pesanPerDetik++;
            let d;
            try { d = JSON.parse(teks); } catch (e) { return; }
            if (!d || typeof d.t !== 'string' || d.t.slice(0, 3) !== 'pl_') return;
            try { pinTangani(ws, d); }
            catch (e) {
                console.error('[PINLIVE] error:', e && e.message);
                pinKirim(ws, { t: 'pl_err', m: 'Ada yang salah di server. Coba lagi.' });
            }
        });

        ws.on('close', () => { pinSemuaSoket.delete(ws); });
    });

    srv.on('error', (e) => {
        if (e && e.code === 'EADDRINUSE') {
            console.log('⚠️ [PINLIVE] port ' + PINLIVE_PORT + ' sudah dipakai — fitur pin live mati, fitur lain tetap jalan.');
        } else {
            console.log('⚠️ [PINLIVE] server gagal:', e && e.message);
        }
        pinTetapkanStatus('gagal');
    });

    srv.listen(PINLIVE_PORT, () => {
        console.log('📌 [PINLIVE] server online siap di port ' + PINLIVE_PORT);
        pinTetapkanStatus('aktif');
    });
    return srv;
}

function pinDetak() {
    const jantung = setInterval(() => {
        for (const ws of pinSemuaSoket) {
            if (ws.alive === false) { ws.terminate(); pinSemuaSoket.delete(ws); continue; }
            ws.alive = false;
            ws.ping();
        }
    }, 30000);

    const perDetik = setInterval(() => {
        const now = Date.now();
        for (const ws of pinSemuaSoket) {
            if (ws.pesanPerDetik > 200) { ws.close(1008); pinSemuaSoket.delete(ws); }
            ws.pesanPerDetik = 0;
        }
        for (const ws of pinSemuaSoket) {
            if (ws.pinSampai && ws.pinSampai < now) {
                pinKirim(ws, { t: 'pl_kunci_habis' });
                try { ws.close(); } catch (e) { }
                pinSemuaSoket.delete(ws);
            }
        }
        pinBersihkanKunci();
    }, 1000);

    if (jantung.unref) jantung.unref();
    if (perDetik.unref) perDetik.unref();
}

let pinSudahNyala = false;

/** Nyalakan server pin live. Aman dipanggil berkali-kali. */
function nyalakan() {
    if (pinSudahNyala) return;
    pinSudahNyala = true;
    pinNyalakanServer();
    pinDetak();
}

/** Sama polanya dengan catur-relay.js/musiklive-relay.js: tunggu listen() selesai baru jawab. */
function saatSiap(fn) {
    if (pinStatus !== 'belum') return fn(pinAktifFlag);
    pinAntreSiap.push(fn);
}

module.exports = {
    nyalakan,
    buatKunci: pinBuatKunci,
    saatSiap,
    aktif: () => pinAktifFlag,
    PORT: PINLIVE_PORT
};
    },
    "livenet/pinterest": (module, exports, require) => {
/*
 * Module scraping khusus untuk pencarian Pin di Pinterest.
 * Dipakai untuk command WhatsApp: .pin <query>
 *
 * Cara kerja: ambil cookie awal dari halaman Pinterest, lalu panggil
 * endpoint internal "BaseSearchResource" milik Pinterest (dipakai oleh
 * fitur search di web mereka sendiri) buat dapetin hasil pencarian pin.
 */

const { CookieJar } = require('tough-cookie');

const PINTEREST_HOST = 'https://id.pinterest.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0';

// Urutan varian video yang lebih disukai - semuanya MP4 langsung (bukan
// manifest HLS). Diurutkan dari resolusi paling tinggi ke rendah supaya
// kualitasnya bagus tapi tetap wajar buat dikirim lewat WebSocket.
const VIDEO_KEY_PREFERENSI = ['V_720P', 'V_EXP7', 'V_EXP6', 'V_EXP5', 'V_EXP4', 'V_EXP3', 'V_EXP2', 'V_EXP1'];

function bukanManifestHls(key, url) {
    if (!url) return false;
    if (/hls/i.test(key)) return false;
    if (/\.m3u8(\?|$)/i.test(url)) return false;
    return true;
}

/**
 * Pilih URL video MP4 terbaik dari daftar varian video Pinterest.
 * Sengaja MENGHINDARI varian HLS (mis. V_HLSV4/V_HLSV3) karena itu manifest
 * (.m3u8) yang isinya daftar segmen - bukan file video utuh, jadi tidak bisa
 * diputar langsung dari data URI base64 seperti yang dipakai pinlive-relay.
 * @param {object|null|undefined} videoList - pin.videos.video_list dari Pinterest.
 * @returns {string|null}
 */
function pickBestVideoUrl(videoList) {
    if (!videoList || typeof videoList !== 'object') return null;

    for (const key of VIDEO_KEY_PREFERENSI) {
        const v = videoList[key];
        if (v && v.url && bukanManifestHls(key, v.url)) return v.url;
    }
    // Fallback: cari varian lain apa saja yang bukan HLS.
    for (const key of Object.keys(videoList)) {
        const v = videoList[key];
        if (v && v.url && bukanManifestHls(key, v.url)) return v.url;
    }
    return null;
}

/**
 * Cari pin di Pinterest berdasarkan kata kunci.
 * @param {string} query - Kata kunci pencarian.
 * @param {object} [opts]
 * @param {number} [opts.limit=20] - Maksimal jumlah hasil yang dikembalikan.
 * @param {string|null} [opts.bookmark=null] - Token halaman lanjutan dari
 *   panggilan sebelumnya (lihat field `bookmark` di hasil kembalian). Kirim
 *   ulang token ini buat dapat batch pin BERIKUTNYA dari kata kunci yang
 *   sama, bukan hasil yang sama diulang - dipakai buat "gulir tanpa habis"
 *   di kartu Pinlive. Kosongkan (default) buat halaman pertama.
 * @returns {Promise<{status:string, code:number, input:string, total:number, result:object[], bookmark:string|null}>}
 */
async function searchPinterest(query, { limit = 20, bookmark = null } = {}) {
    const q = String(query || '').trim();
    if (!q) throw new Error("Query pencarian wajib diisi.");

    const jar = new CookieJar();

    // 1. Ambil cookie awal dari halaman utama Pinterest (dibutuhkan biar request search dianggap valid)
    const initRes = await fetch(`${PINTEREST_HOST}/`, {
        method: 'GET',
        headers: {
            'user-agent': UA,
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
        },
    });

    const setCookies = typeof initRes.headers.getSetCookie === 'function' ? initRes.headers.getSetCookie() : [];
    if (setCookies && setCookies.length) {
        for (const c of setCookies) {
            try { await jar.setCookie(c, PINTEREST_HOST); } catch (e) { /* cookie invalid, skip */ }
        }
    }

    const cookieString = await jar.getCookieString(PINTEREST_HOST);

    // 2. Susun payload sesuai format request search resource Pinterest
    const sourceUrl = '/search/pins/?q=' + encodeURIComponent(q) + '&rs=typed';
    const dataPayload = JSON.stringify({
        options: {
            query: q,
            scope: 'pins',
            appliedProductFilters: '---',
            domains: null,
            user: null,
            seoDrawerEnabled: false,
            applied_unified_filters: null,
            auto_correction_disabled: false,
            journey_depth: null,
            source_id: null,
            source_module_id: null,
            source_url: sourceUrl,
            static_feed: false,
            selected_one_bar_modules: null,
            query_pin_sigs: null,
            page_size: null,
            price_max: null,
            price_min: null,
            query_image_pins: null,
            request_params: null,
            top_pin_ids: null,
            article: null,
            corpus: null,
            customized_rerank_type: null,
            filters: null,
            rs: 'typed',
            redux_normalize_feed: true,
            // Endpoint internal ini (BaseSearchResource) sama seperti yang dipakai
            // Pinterest sendiri buat "muat lagi" waktu kamu gulir ke bawah di web -
            // token bookmark dari respons sebelumnya dikirim balik lewat array ini
            // supaya dapat batch pin BERIKUTNYA. Array kosong = halaman pertama.
            bookmarks: bookmark ? [bookmark] : []
        },
        context: {}
    });

    const url = `${PINTEREST_HOST}/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(dataPayload)}&_=${Date.now()}`;

    // 3. Panggil endpoint pencarian
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'user-agent': UA,
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'referer': `${PINTEREST_HOST}/`,
            'x-requested-with': 'XMLHttpRequest',
            'x-app-version': '8048c97',
            'x-pinterest-appstate': 'active',
            'x-pinterest-source-url': '/',
            'x-pinterest-pws-handler': 'www/index.js',
            'screen-dpr': '1.25',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'cookie': cookieString
        },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = null; }

    const status = data && data.resource_response && data.resource_response.status === 'success' ? 'success' : 'failed';
    const rawResults = (data && data.resource_response && data.resource_response.data && data.resource_response.data.results) || [];

    // Token buat batch berikutnya. Pinterest naruhnya di beberapa lokasi
    // tergantung versi endpoint - dicoba berurutan. Waktu hasil BENAR-BENAR
    // habis, Pinterest balikin string "-end-" (bukan null/kosong), jadi itu
    // sengaja disamakan dengan "tidak ada lagi".
    const bookmarkMentah =
        (data && data.resource_response && data.resource_response.bookmark) ||
        (data && data.resource_response && data.resource_response.data && data.resource_response.data.bookmark) ||
        null;
    const bookmarkLanjut = (bookmarkMentah && bookmarkMentah !== '-end-') ? bookmarkMentah : null;

    const result = rawResults
        .map((pin) => ({
            id: pin.id,
            title: pin.grid_title || pin.title || null,
            description: pin.description || null,
            // "orig" dipakai buat unduhan/tampilan penuh (bisa beberapa MB).
            image: (pin.images && pin.images.orig && pin.images.orig.url) || null,
            // "thumb" khusus buat grid pencarian - jauh lebih kecil, supaya kartu
            // Pinlive tidak perlu menarik gambar orig cuma buat kotak kecil.
            // Pinterest biasanya punya beberapa varian ukuran; ambil yang paling
            // kecil yang tersedia, baru naik kalau tidak ada.
            thumb: (pin.images && (
                (pin.images['236x'] && pin.images['236x'].url) ||
                (pin.images['474x'] && pin.images['474x'].url) ||
                (pin.images['170x'] && pin.images['170x'].url) ||
                (pin.images.orig && pin.images.orig.url)
            )) || null,
            link: pin.link || null,
            domain: pin.domain || null,
            pinner: (pin.pinner && pin.pinner.full_name) || null,
            username: (pin.pinner && pin.pinner.username) || null,
            likes: (pin.reaction_counts && pin.reaction_counts['1']) || 0,
            created_at: pin.created_at || null,
            // Sebagian pin punya video (pin.videos.video_list, beberapa resolusi).
            // Dipakai buat fitur .pinx video - lihat pickBestVideoUrl() di
            // bawah. PENTING: harus MP4 langsung, BUKAN manifest HLS (.m3u8),
            // karena videonya dikirim lewat WebSocket sebagai data URI
            // (base64 utuh) - <video> tidak bisa memutar manifest HLS dari
            // data URI (butuh hls.js/native HLS Safari buat streaming
            // segmen), jadi kalau kepilih HLS video-nya kelihatan "ga bisa"
            // diputar sama sekali.
            video: pickBestVideoUrl(pin.videos && pin.videos.video_list) || null,
        }))
        .filter((r) => r.image)
        .slice(0, limit);

    return {
        status,
        code: res.status,
        input: q,
        total: result.length,
        result,
        // null artinya jangan diminta lagi (query ini sudah tidak punya
        // halaman lanjutan) - pemanggil (pinlive-relay.js) memakai ini buat
        // tahu kapan harus berhenti auto-muat & bilang "sudah habis".
        bookmark: bookmarkLanjut,
    };
}

module.exports = { searchPinterest, pickBestVideoUrl };
    },
    "livenet/cloudflared": (module, exports, require) => {
// ===========================================================================
// AUTO CLOUDFLARED — Download & install cloudflared otomatis
// Dipakai oleh semua tunnel (ytlive, spotifylive, pinlive)
// Tidak perlu wget/curl manual — download pakai https bawaan Node.js
// ===========================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');


// Lokasi cloudflared yang akan didownload
const CLOUDFLARED_PATH = path.join(process.cwd(), 'cloudflared');

// URL download cloudflared linux amd64
const CLOUDFLARED_ARCH = process.arch === 'arm64' ? 'arm64' : process.arch === 'arm' ? 'arm' : 'amd64';
const CLOUDFLARED_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-' + CLOUDFLARED_ARCH;

function sudahAda() {
    try {
        if (!fs.existsSync(CLOUDFLARED_PATH)) return false;
        fs.accessSync(CLOUDFLARED_PATH, fs.constants.X_OK);
        return true;
    } catch (e) {
        return false;
    }
}

function downloadFile(url, tujuan, redirect = 0) {
    return new Promise((selesai, gagal) => {
        if (redirect > 5) return gagal(new Error('Terlalu banyak redirect'));

        https.get(url, { headers: { 'User-Agent': 'cloudflared-installer/1.0' } }, (res) => {
            // Ikuti redirect
            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                const loc = res.headers.location;
                res.resume();
                if (!loc) return gagal(new Error('Redirect tanpa Location header'));
                return downloadFile(loc, tujuan, redirect + 1).then(selesai).catch(gagal);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return gagal(new Error('HTTP ' + res.statusCode));
            }

            const file = fs.createWriteStream(tujuan);
            let total = 0;
            res.on('data', (d) => { total += d.length; });
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                selesai(total);
            });
            file.on('error', (e) => {
                try { fs.unlinkSync(tujuan); } catch (x) { }
                gagal(e);
            });
        }).on('error', gagal);
    });
}

async function pastikanCloudflared() {
    if (process.platform !== 'linux') {
        console.log('ℹ️ [AUTO-CF] auto-download hanya untuk Linux. Pasang cloudflared manual atau isi environment variable CLOUDFLARED_BIN.');
        return null;
    }
    if (sudahAda()) {
        console.log('✅ [AUTO-CF] cloudflared sudah ada di ' + CLOUDFLARED_PATH);
        return CLOUDFLARED_PATH;
    }

    console.log('⬇️  [AUTO-CF] cloudflared tidak ketemu, download otomatis...');
    try {
        const bytes = await downloadFile(CLOUDFLARED_URL, CLOUDFLARED_PATH);
        fs.chmodSync(CLOUDFLARED_PATH, 0o755);
        console.log('✅ [AUTO-CF] cloudflared berhasil didownload (' + Math.round(bytes / 1048576) + ' MB)');
        return CLOUDFLARED_PATH;
    } catch (e) {
        console.error('❌ [AUTO-CF] gagal download cloudflared:', e.message);
        return null;
    }
}

module.exports = { pastikanCloudflared, CLOUDFLARED_PATH };
    },
    "htmlcard": (module, exports, require) => {
// Pengirim kartu HTML (rich response) untuk Kaguya.
// Kartu statis: semua data ditanam di HTML, tanpa fetch (sandbox WA memblokir jaringan).
const DEFAULT_BOT_JID = "867051314767696@bot"
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]
const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("")
const randomResponseId = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`

function buildRichHtmlPayload(html, title = "Card", opts = {}) {
  // opts.quoted = objek pesan (m) yang mau di-reply: kutipannya tampil di dalam kartu, seperti balasan biasa
  const q = require('./dquote').quoteOf(opts.quoted), qCtx = q && q.message ? { stanzaId: q.key.id, participant: q.key.participant || q.sender, remoteJid: q.chat, quotedMessage: q.message } : {}
  return {
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { capabilityMetadata: { capabilities: KAPABILITAS } } },
    botForwardedMessage: { message: { richResponseMessage: {
      messageType: 1,
      submessages: [{ messageType: 2, messageText: title }],
      unifiedResponse: { data: Buffer.from(JSON.stringify({
        response_id: randomResponseId(),
        sections: [{ view_model: { primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", payload: html, trusted_sources: [] }, __typename: "GenAISingleLayoutViewModel" } }],
      })).toString("base64") },
      contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: DEFAULT_BOT_JID }, forwardOrigin: 4, ...qCtx },
    } } },
  }
}

async function sendHtmlCard(sock, m, html, title, emoji = "✨", opts = {}) {
  try {
    await sock.relayMessage(m.chat, buildRichHtmlPayload(html, title, opts), {})
    try { await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) } catch {}
    return true
  } catch (err) {
    console.error(`[HTMLCARD:${title}] gagal kirim:`, err.message)
    await sock.sendMessage(m.chat, { text: "❌ Kartu gagal dikirim. Fitur ini butuh WhatsApp versi terbaru." }, { quoted: m })
    return false
  }
}

const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028|\u2029/g, "")
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

const BASE_CSS = String.raw`
:root{--bg:#0f1115;--card:#181b22;--card2:#20242d;--ink:#fff;--soft:#a3aab8;--line:#2b303b;--acc:#22c55e;--acc2:#16a34a;--warn:#f59e0b;--red:#ef4444;--blue:#3b82f6;--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
.app{width:100%;max-width:380px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(180deg,#232733 0%,#171a21 30%,var(--bg) 70%);box-shadow:0 18px 40px rgba(0,0,0,.55);padding:14px 12px 16px;}
.top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.logo{width:30px;height:30px;border-radius:9px;background:var(--acc);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px;}
.meta{min-width:0;flex:1;}
.title{font-size:14px;font-weight:800;}
.sub{font-size:10.5px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{flex:none;border:1px solid var(--line);background:var(--card);color:var(--soft);border-radius:20px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;}
.chip.on{background:var(--acc);border-color:var(--acc);color:#04130a;}
.btn{border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;cursor:pointer;background:var(--acc);color:#04130a;}
.btn.alt{background:var(--card2);color:var(--ink);border:1px solid var(--line);}
.btn.red{background:var(--red);color:#fff;}
.inp{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);font-size:14px;outline:none;font-family:var(--sys);}
.inp:focus{border-color:var(--acc);}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;}
.row{display:flex;gap:8px;align-items:center;}
.muted{color:var(--soft);font-size:11px;}
.hide{display:none!important;}
`;

module.exports = { buildRichHtmlPayload, sendHtmlCard, safeJson, escapeHtml, BASE_CSS }
    },
    "dquote": (module, exports, require) => {
// kutipan untuk kartu HTML: pakai pesan user apa adanya (header palsu bisnis tidak dipakai)
const quoteOf = (q) => { try { return q && q.key && q.message && q.chat ? q : null } catch { return null } }
module.exports = { quoteOf, apply: (o) => o, enabled: () => false }
    },
    "cards/pinlive": (module, exports, require) => {
    // ===========================================================================
    // KARTU PINLIVE — cari & lihat gambar Pinterest langsung di dalam kartu
    //
    // Pola SENGAJA disalin dari buildMusikLiveHtml di atas: satu WebSocket ke
    // relay-nya sendiri (lib/pinlive-relay.js), URL dibaca ulang tiap kartu
    // dibuat lewat bacaRelayPin() karena alamat trycloudflare berubah tiap
    // tunnel restart. Tidak ada ruangan "bareng" seperti Spotifylive - Pinlive
    // murni sesi cari+lihat sendirian.
    //
    // Thumbnail & gambar penuh TIDAK bisa dimuat lewat <img src="https://...">
    // biasa - sandbox kartu WA memblokir permintaan jaringan biasa (lihat
    // catatan di scrape/richhtml.js). Makanya keduanya dikirim lewat WebSocket
    // yang sama (thumbnail langsung sebagai data URI, gambar penuh dipotong jadi
    // beberapa bongkah base64), lalu kartu ini merakitnya jadi <img>/Blob URL.
    //
    // Tampilan meniru gaya app Pinterest: kolom cari + tombol "Cari" merah, deret
    // chip tag saran, grid dua kolom, dan layar detail dengan penghitung index,
    // tombol salin link, dan tombol unduh. Naik/turun dipakai buat pindah kartu
    // (bukan gulir jari) - alasannya sama dengan kenapa Spotifylive pakai tombol
    // buat daftar lagu: gulir jari tidak bisa diandalkan di dalam kartu WA.
    // ===========================================================================

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildPinLiveHtml(opts = {}) {
        const botName = escapeHtml(opts.botName || 'Bot');
        const playerName = escapeHtml(opts.playerName || 'Kamu');

        const relayUrl = String(opts.relayUrl || '').trim();
        const konfig = JSON.stringify({
            url: /^wss?:\/\//.test(relayUrl) ? relayUrl : '',
            nama: opts.playerName || 'Pemain',
            // Kunci sesi 30 menit. Dibuat bot lewat pinliveRelay.buatKunci(), dan
            // server memutus sambungan begitu kuncinya lewat masa berlaku.
            kunci: String(opts.kunci || '')
        });

        return `
    <style>
    :root{
      --bg:#0b0b0b; --card:#141414; --card-2:#1c1c1c;
      --ink:#ffffff; --ink-soft:#b8b8b8; --muted:#8a8a8a;
      --red:#e60023; --red-hi:#ff2440; --line:#2a2a2a;
      --sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    }
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
    html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
    .stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
    
    .app{
      width:100%;max-width:380px;border-radius:16px;overflow:hidden;position:relative;
      background:linear-gradient(180deg,#232323 0%,#161616 26%,var(--bg) 62%);
      box-shadow:0 18px 40px rgba(0,0,0,.55);
      padding:14px 12px 16px;
    }
    
    /* ---------- header ---------- */
    .top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
    .top__logo{width:24px;height:24px;border-radius:50%;background:var(--red);flex:none;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;}
    .top__meta{min-width:0;flex:1;}
    .top__title{font-size:13px;font-weight:800;letter-spacing:.01em;}
    .top__sub{font-size:10.5px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
    .top__badge{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--red-hi);border:1px solid rgba(230,0,35,.45);border-radius:20px;padding:3px 8px;flex:none;}
    
    .status{font-size:10.5px;color:var(--muted);margin-bottom:10px;min-height:13px;transition:color .2s;}
    .status.wait{color:#e0b34d;}
    .status.bad{color:#ff6b6b;}
    
    /* ---------- kolom cari ---------- */
    .searchbar{display:flex;gap:8px;margin-bottom:10px;}
    .searchbar input{
      flex:1;min-width:0;background:var(--card-2);border:1px solid var(--line);border-radius:24px;
      padding:10px 14px;color:var(--ink);font-size:13px;outline:none;
    }
    .searchbar input::placeholder{color:var(--muted);}
    .searchbar button{
      flex:none;background:var(--red);color:#fff;border:none;border-radius:24px;
      padding:0 18px;font-size:12.5px;font-weight:800;cursor:pointer;
    }
    .searchbar button:active{background:var(--red-hi);}
    .searchbar button:disabled{opacity:.5;}
    
    .tags{display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:2px;scrollbar-width:none;}
    .tags::-webkit-scrollbar{display:none;}
    .tag{
      flex:none;background:var(--card-2);border:1px solid var(--line);color:var(--ink-soft);
      font-size:10.5px;font-weight:600;border-radius:16px;padding:6px 11px;cursor:pointer;white-space:nowrap;
    }
    .tag:active{background:#292929;}
    
    /* ---------- grid hasil ----------
       Dulu dipaging 6/halaman lewat tombol naik/turun (gulir jari dianggap
       tidak diandalkan di kartu WA). Sekarang grid-nya sendiri yang jadi area
       gulir (overflow-y:auto internal, BUKAN gulir dokumen/halaman penuh) -
       nested scroll begini jauh lebih konsisten ditangkap webview kartu
       dibanding gulir di level halaman, dan tetap dilengkapi kartu yang masuk
       dengan animasi halus (bukan main ganti isi tiba-tiba/kaku). Waktu gulir
       sampai (hampir) dasar, kartu otomatis minta batch pin berikutnya ke
       server (lihat cobaMuatLanjut) - jadi tidak mentok cuma di sejumlah kecil
       foto pertama saja. */
    .gridwrap{position:relative;}
    .grid{
      display:grid;grid-template-columns:1fr 1fr;gap:8px;min-height:120px;
      /* Piksel, BUKAN vh. Di WebView kartu WA tinggi viewport ditentukan isi
         kartu bukan layar HP, jadi 58vh bikin grid-nya kependekan - cuma
         kebagian dua baris foto. 560px kira-kira 4 baris, mirip galeri
         Pinterest di HP. */
      max-height:560px;overflow-y:auto;overscroll-behavior:contain;
      scroll-behavior:smooth;-webkit-overflow-scrolling:touch;
      padding-bottom:2px;
    }
    .grid::-webkit-scrollbar{width:4px;}
    .grid::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px;}
    
    /* sepasang tombol kecil naik/turun di bawah grid - gulir jari kadang tidak
       diambil webview kartu WA (kena rebut daftar pesan), jadi ini jalan
       cadangan yang selalu bisa dipakai. Cuma muncul kalau grid-nya memang
       lebih tinggi dari area yang kelihatan (lihat is-on di gulirGrid()). */
    .grid-gulir{display:none;align-items:center;justify-content:center;gap:8px;margin:6px 0 2px;}
    .grid-gulir.is-on{display:flex;}
    .grid-gulir button{
      width:26px;height:22px;border:none;border-radius:7px;cursor:pointer;padding:0;
      background:var(--card-2);border:1px solid var(--line);color:var(--ink-soft);
      font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;
    }
    .grid-gulir button:active{background:#292929;}
    .grid-gulir button:disabled{opacity:.3;}
    .grid-gulir__info{font-size:10px;color:var(--muted);min-width:26px;text-align:center;}
    .pin-card{
      border-radius:12px;overflow:hidden;background:var(--card-2);border:1px solid var(--line);
      cursor:pointer;position:relative;aspect-ratio:3/4;
      opacity:0;transform:translateY(12px) scale(.97);
      transition:opacity .34s ease, transform .34s ease;
    }
    .pin-card.masuk{opacity:1;transform:translateY(0) scale(1);}
    .pin-card img{width:100%;height:100%;object-fit:cover;display:block;}
    .pin-card .ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px;}
    .pin-card .cap{
      position:absolute;left:0;right:0;bottom:0;padding:14px 8px 6px;
      background:linear-gradient(180deg,transparent,rgba(0,0,0,.75));
      font-size:9.5px;color:#fff;font-weight:600;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .pin-card .vbadge{
      position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;
      background:rgba(20,20,20,.75);color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;
    }
    
    /* status di bawah grid: "memuat foto lain..." atau "sudah semua ditampilkan" */
    .gridstatus{font-size:10.5px;color:var(--muted);text-align:center;padding:9px 4px 2px;min-height:15px;}
    .gridstatus .dot{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--muted);margin-left:3px;animation:pinDot 1s infinite ease-in-out;}
    .gridstatus .dot:nth-child(2){animation-delay:.15s;}
    .gridstatus .dot:nth-child(3){animation-delay:.3s;}
    @keyframes pinDot{0%,80%,100%{opacity:.25;transform:translateY(0);}40%{opacity:1;transform:translateY(-2px);}}
    
    .empty,.hint{font-size:11.5px;color:var(--muted);text-align:center;padding:26px 10px;}
    
    /* ---------- layar detail ---------- */
    .detail{position:absolute;inset:0;background:var(--bg);border-radius:16px;display:none;flex-direction:column;padding:12px;z-index:20;}
    .detail.show{display:flex;}
    .detail__top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
    .detail__back{flex:none;width:28px;height:28px;border-radius:50%;background:var(--card-2);border:1px solid var(--line);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;}
    .detail__count{flex:1;text-align:center;font-size:11.5px;color:var(--ink-soft);font-weight:700;}
    .detail__copy{flex:none;height:28px;border-radius:14px;background:var(--red);color:#fff;border:none;padding:0 12px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:5px;}
    .detail__copy:disabled{opacity:.55;}
    
    .detail__stage{flex:1;position:relative;border-radius:12px;overflow:hidden;background:var(--card-2);display:flex;align-items:center;justify-content:center;}
    .detail__stage img,.detail__stage video{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .28s ease;}
    .detail__stage img.masuk,.detail__stage video.masuk{opacity:1;}
    .detail__stage .loading{font-size:11px;color:var(--ink-soft);}
    .detail__nav{position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:8px;}
    .detail__nav button{width:34px;height:34px;border-radius:50%;border:none;background:rgba(20,20,20,.82);color:#fff;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.4);}
    .detail__nav button:disabled{opacity:.35;}
    .detail__caption{margin-top:8px;font-size:10.5px;color:var(--ink-soft);}
    .detail__caption b{color:var(--ink);}
    
    .toast{
      position:absolute;left:50%;bottom:14px;transform:translateX(-50%) translateY(10px);
      background:rgba(20,20,20,.92);border:1px solid var(--line);color:#fff;font-size:11px;font-weight:600;
      padding:8px 14px;border-radius:20px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:30;
    }
    .toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
    
    .mati{display:none;margin-top:10px;font-size:10.5px;color:#ff8a8a;text-align:center;line-height:1.5;}
    </style>
    
    <div class="stage">
      <div class="app" id="app">
    
        <div class="top">
          <div class="top__logo">P</div>
          <div class="top__meta">
            <div class="top__title">Pinlive — ${botName}</div>
            <div class="top__sub" id="sub">Pencarian gambar Pinterest langsung</div>
          </div>
          <div class="top__badge">LIVE</div>
        </div>
    
        <div class="status" id="status">Menyambung ke server...</div>
    
        <div class="searchbar">
          <input id="in-q" type="text" placeholder="Cari sesuatu di Pinterest..." maxlength="80" />
          <button id="btn-cari">Cari</button>
        </div>
        <div class="tags" id="tags" style="display:none;"></div>
    
        <div class="gridwrap">
          <div class="grid" id="grid"></div>
        </div>
        <div class="grid-gulir" id="grid-gulir">
          <button id="grid-atas" title="Ke atas">▲</button>
          <span class="grid-gulir__info" id="grid-gulir-info"></span>
          <button id="grid-bawah" title="Ke bawah">▼</button>
        </div>
        <div class="gridstatus" id="gstatus" style="display:none;"></div>
        <div class="hint" id="hint">Ketik kata kunci lalu tekan Cari untuk mulai.</div>
    
        <div class="detail" id="detail">
          <div class="detail__top">
            <div class="detail__back" id="d-back">←</div>
            <div class="detail__count" id="d-count">1/1</div>
            <button class="detail__copy" id="d-copy">📋 Salin</button>
          </div>
          <div class="detail__stage" id="d-stage"><span class="loading">Menyiapkan...</span></div>
          <div class="detail__nav">
            <button id="d-up">▲</button>
            <button id="d-down">▼</button>
          </div>
          <div class="detail__caption" id="d-cap"></div>
        </div>
    
        <div class="toast" id="toast"></div>
        <div class="mati" id="mati"><span>Server tidak menjawab.</span></div>
      </div>
    </div>
    
    <script>
    (function(){
      var CFG = ${konfig};
      var $ = function(id){ return document.getElementById(id); };
    
      var ws = null, nyambung = false, ulangSambung = 0, timerSambung = null, sesiMati = false;
    
      var currentList = [];   // {i,title,pinner,link,domain,thumb}
      var currentQuery = '';
    
      // Grid sekarang gulir menerus (bukan dipaging tombol naik/turun lagi) -
      // habisHasil menandai kata kunci ini sudah tidak punya batch lanjutan di
      // Pinterest sama sekali, sedangMuatLanjut mengunci supaya gulir yang
      // dipicu berkali-kali dalam sedetik tidak numpuk beberapa pl_lanjut
      // sekaligus ke server.
      var habisHasil = false;
      var sedangMuatLanjut = false;
    
      var detailOpen = false;
      var detailIndex = -1;
      // true selagi layar detail lagi nunggu batch lanjutan (dipicu dari tombol
      // "▼" pas sudah di foto terakhir yang termuat) supaya begitu batch itu
      // sampai, kartu bisa lanjut otomatis ke foto berikutnya tanpa orangnya
      // harus balik ke grid dulu buat "mancing" batch itu turun.
      var detailTungguLanjut = false;
      var mediaCache = {};     // i -> {kind:'image'|'video', mime, url, chunks:[], total, diterima}
    
      function setStatus(t, kls){
        var el = $('status');
        el.textContent = t || '';
        el.className = 'status' + (kls ? ' ' + kls : '');
      }
    
      function toast(msg){
        var t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(function(){ t.classList.remove('show'); }, 1600);
      }
    
      function kirim(o){ try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch(e){} }
    
      function sambung(){
        if (!CFG.url) { setStatus('Alamat server belum siap. Coba lagi sebentar.', 'bad'); return; }
        if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
        setStatus(ulangSambung ? 'Menyambung ulang...' : 'Menyambung ke server...', 'wait');
        try { ws = new WebSocket(CFG.url); } catch(e){ jadwalSambungUlang(); return; }
    
        (function(sock){
          setTimeout(function(){
            if (sock && sock.readyState === 0){ try { sock.close(); } catch(e){} }
          }, 9000);
        })(ws);
    
        ws.onopen = function(){
          kirim({ t:'pl_kunci', kunci: CFG.kunci || '' });
          nyambung = true; ulangSambung = 0;
          setStatus('Tersambung. Ketik kata kunci di atas.', null);
        };
        ws.onclose = function(){ nyambung = false; jadwalSambungUlang(); };
        ws.onerror = function(){ try { ws.close(); } catch(e){} };
        ws.onmessage = function(ev){
          var d; try { d = JSON.parse(ev.data); } catch(e){ return; }
          if (!d || String(d.t).slice(0,3) !== 'pl_') return;
          terima(d);
        };
      }
    
      function jadwalSambungUlang(){
        if (sesiMati) return;
        if (timerSambung || !CFG.url) return;
        ulangSambung++;
        var jeda = Math.min(1000 * ulangSambung, 8000);
        if (ulangSambung >= 3){
          setStatus('Server tidak menjawab. Kartu ini mungkin kedaluwarsa.', 'bad');
          $('mati').style.display = '';
          $('mati').firstElementChild.textContent = 'Alamat server di kartu ini sudah tidak hidup - alamatnya berubah tiap bot restart, jadi kartu lama (apalagi hasil diteruskan) tidak bisa nyambung lagi. Kirim ulang perintah .pinx buat dapat kartu baru.';
        } else {
          setStatus('Koneksi putus. Mencoba lagi...', 'bad');
        }
        timerSambung = setTimeout(function(){ timerSambung = null; sambung(); }, jeda);
      }
    
      function terima(d){
        if (d.t === 'pl_kunci_ok') { return; }
        if (d.t === 'pl_kunci_habis') {
          sesiMati = true;
          setStatus('Sesi kartu ini sudah habis.', 'bad');
          $('mati').style.display = '';
          $('mati').firstElementChild.textContent = 'Sesi kartu ini berlaku 30 menit dan sudah habis. Kirim .pinx lagi buat kartu baru.';
          return;
        }
        if (d.t === 'pl_err') {
          setStatus(d.m || 'Terjadi kesalahan.', 'bad');
          $('btn-cari').disabled = false;
          // Gagal di tengah auto-muat-lanjut (baik dipicu gulir grid maupun
          // tombol "▼" di layar detail) - lepas kuncinya sekarang juga
          // daripada nunggu batas waktu jaga-jaga di cobaMuatLanjut, supaya
          // orangnya bisa langsung coba gulir/tekan lagi.
          if (sedangMuatLanjut) { sedangMuatLanjut = false; sembunyikanStatusGrid(); }
          if (detailTungguLanjut) { detailTungguLanjut = false; renderDetailFrame(); }
          return;
        }
        if (d.t === 'pl_kosong') {
          $('btn-cari').disabled = false;
          currentList = [];
          habisHasil = true;
          sedangMuatLanjut = false;
          $('grid').innerHTML = '';
          sembunyikanStatusGrid();
          $('hint').style.display = '';
          $('hint').textContent = 'Tidak ada hasil untuk "' + d.q + '". Coba kata kunci lain.';
          return;
        }
        if (d.t === 'pl_hasil') { onHasil(d); return; }
        if (d.t === 'pl_hasil_tambahan') { onHasilTambahan(d); return; }
        if (d.t === 'pl_habis') { onHabis(d); return; }
        if (d.t === 'pl_media_proses') { onMediaProses(d); return; }
        if (d.t === 'pl_media_meta') { onMediaMeta(d); return; }
        if (d.t === 'pl_media_bongkah') { onMediaBongkah(d); return; }
        if (d.t === 'pl_media_selesai') { onMediaSelesai(d); return; }
      }
    
      function onHasil(d){
        $('btn-cari').disabled = false;
        currentQuery = d.q;
        currentList = d.list || [];
        habisHasil = !!d.habis;
        sedangMuatLanjut = false;
        $('sub').textContent = 'Hasil untuk "' + d.q + '" (' + currentList.length + ')';
        setStatus('Ketuk salah satu gambar untuk melihat penuh.', null);
        $('hint').style.display = 'none';
    
        // PENTING: bersihkan cache media & tutup layar detail tiap hasil
        // pencarian baru datang. Tanpa ini, index (0,1,2,...) dipakai ulang
        // tiap pencarian baru, jadi kalau sebelumnya pernah buka detail index 0
        // di kata kunci lama, kartu bisa nampilin gambar/video LAMA itu lagi
        // waktu index 0 dibuka di hasil pencarian yang baru - caption benar
        // (diambil dari currentList terbaru) tapi gambarnya nyasar punya yang
        // lama.
        mediaCache = {};
        if (detailOpen) tutupDetail();
    
        var tagsEl = $('tags');
        tagsEl.innerHTML = '';
        (d.tags || []).forEach(function(tag){
          var chip = document.createElement('div');
          chip.className = 'tag';
          chip.textContent = tag;
          chip.onclick = function(){ $('in-q').value = tag; mulaiCari(tag); };
          tagsEl.appendChild(chip);
        });
        tagsEl.style.display = (d.tags && d.tags.length) ? 'flex' : 'none';
    
        var grid = $('grid');
        grid.innerHTML = '';
        grid.scrollTop = 0;
        sembunyikanStatusGrid();
        tambahKartu(currentList);
        if (habisHasil) tampilkanStatusHabis();
        gulirGrid.perbarui();
      }
    
      // Bikin satu elemen kartu pin buat grid - dipisah dari tambahKartu supaya
      // bisa dipakai baik waktu render hasil pencarian baru maupun waktu
      // menyisipkan batch tambahan hasil gulir ke bawah (pl_hasil_tambahan).
      function buatKartuPin(p){
        var card = document.createElement('div');
        card.className = 'pin-card';
        if (p.thumb) {
          var img = document.createElement('img');
          img.src = p.thumb;
          card.appendChild(img);
        } else {
          var ph = document.createElement('div');
          ph.className = 'ph';
          ph.textContent = 'Gagal muat';
          card.appendChild(ph);
        }
        if (p.video) {
          var vb = document.createElement('div');
          vb.className = 'vbadge';
          vb.textContent = '▶';
          card.appendChild(vb);
        }
        if (p.title) {
          var cap = document.createElement('div');
          cap.className = 'cap';
          cap.textContent = p.title;
          card.appendChild(cap);
        }
        card.onclick = function(){ bukaDetail(p.i); };
        return card;
      }
    
      // Tambah kartu ke grid TANPA membuang isi yang sudah ada (dipakai baik
      // buat render awal maupun nyisip batch baru pas gulir sampai bawah), lalu
      // kasih animasi masuk halus (fade + naik dikit) - bukan main muncul
      // langsung kaku. Class 'masuk' sengaja ditambahkan sesudah frame
      // berikutnya (double rAF) supaya browser sempat "melihat" dulu state
      // awalnya (opacity 0) sebelum transisi CSS-nya jalan; kalau class-nya
      // ditambah di frame yang sama, browser bisa menggabungnya jadi satu
      // render dan transisinya tidak kelihatan sama sekali.
      function tambahKartu(list){
        if (!list || !list.length) return;
        var grid = $('grid');
        var elBaru = list.map(function(p){
          var card = buatKartuPin(p);
          grid.appendChild(card);
          return card;
        });
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            elBaru.forEach(function(el){ el.classList.add('masuk'); });
          });
        });
      }
    
      function sembunyikanStatusGrid(){
        $('gstatus').style.display = 'none';
      }
      function tampilkanStatusMuat(){
        var el = $('gstatus');
        el.style.display = '';
        el.className = 'gridstatus';
        el.innerHTML = 'Memuat foto lain<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      }
      function tampilkanStatusHabis(){
        var el = $('gstatus');
        el.style.display = '';
        el.className = 'gridstatus';
        el.textContent = 'Sudah semua foto ditampilkan untuk kata kunci ini.';
      }
    
      // Sepasang tombol kecil "Ke atas"/"Ke bawah" di bawah grid - cadangan
      // buat gulir jari yang kadang tidak diambil webview kartu WA. Tombolnya
      // cuma tampil kalau isi grid memang lebih tinggi dari area yang
      // kelihatan, dan nonaktif sendiri pas sudah mentok atas/bawah. Dipanggil
      // ulang (perbarui) tiap grid digulir dan tiap ada kartu baru masuk.
      function pasangGulirGrid(){
        var el = $('grid');
        function perbarui(){
          var bisa = el.scrollHeight - el.clientHeight > 4;
          $('grid-gulir').className = 'grid-gulir' + (bisa ? ' is-on' : '');
          if (!bisa) return;
          $('grid-atas').disabled = el.scrollTop <= 1;
          $('grid-bawah').disabled = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
          var hal = Math.max(1, Math.ceil(el.scrollHeight / Math.max(1, el.clientHeight)));
          var kini = Math.min(hal, Math.floor(el.scrollTop / Math.max(1, el.clientHeight)) + 1);
          $('grid-gulir-info').textContent = kini + '/' + hal;
        }
        function geser(arah){
          el.scrollTop += arah * Math.max(80, el.clientHeight - 40);
          setTimeout(perbarui, 260);
        }
        $('grid-atas').addEventListener('click', function(){ geser(-1); });
        $('grid-bawah').addEventListener('click', function(){ geser(1); });
        return { perbarui: perbarui };
      }
      var gulirGrid = pasangGulirGrid();
    
      // Dipanggil waktu grid digulir sampai (hampir) dasar. Terkunci lewat
      // sedangMuatLanjut supaya beberapa event scroll beruntun dalam sedetik
      // tidak numpuk beberapa permintaan pl_lanjut sekaligus ke server.
      function cobaMuatLanjut(){
        if (sedangMuatLanjut || habisHasil) return;
        if (!nyambung || !currentQuery || !currentList.length) return;
        sedangMuatLanjut = true;
        tampilkanStatusMuat();
        kirim({ t:'pl_lanjut', q: currentQuery });
        // Jaga-jaga kalau balasannya nyasar/hilang total (mis. koneksi putus
        // persis waktu itu, tanpa sempat kirim pl_err/pl_habis) - lepas kunci
        // gulirnya sendiri setelah beberapa detik supaya percobaan berikutnya
        // masih bisa jalan. Kalau ternyata sudah dijawab lebih dulu (lewat
        // onHasilTambahan/onHabis/pl_err), flag-flag ini sudah balik false
        // duluan jadi blok di bawah tidak melakukan apa-apa.
        setTimeout(function(){
          sedangMuatLanjut = false;
          if (detailTungguLanjut) {
            detailTungguLanjut = false;
            renderDetailFrame();
            toast('Gagal memuat foto berikutnya. Coba lagi.');
          }
        }, 12000);
      }
    
      $('grid').addEventListener('scroll', function(){
        var g = $('grid');
        if (g.scrollTop + g.clientHeight >= g.scrollHeight - 90) cobaMuatLanjut();
        gulirGrid.perbarui();
      }, { passive: true });
    
      function onHasilTambahan(d){
        if (d.q !== currentQuery) return;
        sedangMuatLanjut = false;
        var mulaiDari = currentList.length;
        currentList = currentList.concat(d.list || []);
        tambahKartu(d.list || []);
    
        if (d.habis) { habisHasil = true; tampilkanStatusHabis(); }
        else { sembunyikanStatusGrid(); }
        gulirGrid.perbarui();
    
        // Layar detail lagi nunggu batch ini buat lanjut otomatis (lihat
        // $('d-down').onclick) - begitu ada foto baru, langsung pindah ke foto
        // pertama dari batch barunya tanpa orangnya perlu balik ke grid dulu.
        if (detailOpen && detailTungguLanjut && (d.list || []).length) {
          detailTungguLanjut = false;
          detailIndex = mulaiDari;
          renderDetailFrame();
          mintaMedia(detailIndex);
        } else if (detailOpen) {
          renderDetailFrame(); // total & status tombol "▼" ikut ter-update
        }
      }
    
      function onHabis(d){
        if (d.q !== currentQuery) return;
        sedangMuatLanjut = false;
        habisHasil = true;
        tampilkanStatusHabis();
        if (detailOpen && detailTungguLanjut) {
          detailTungguLanjut = false;
          renderDetailFrame();
          toast('Sudah foto terakhir untuk kata kunci ini.');
        }
      }
    
      function mulaiCari(q){
        q = String(q || '').trim();
        if (!q) return;
        if (!nyambung) { setStatus('Belum tersambung ke server, tunggu sebentar...', 'wait'); return; }
        $('btn-cari').disabled = true;
        setStatus('Mencari "' + q + '"...', 'wait');
        kirim({ t:'pl_cari', q: q });
      }
      $('btn-cari').onclick = function(){ mulaiCari($('in-q').value); };
      $('in-q').addEventListener('keydown', function(ev){ if (ev.key === 'Enter') mulaiCari($('in-q').value); });
    
      // ---------------- detail ----------------
      function bukaDetail(i){
        detailOpen = true;
        detailIndex = i;
        $('detail').classList.add('show');
        renderDetailFrame();
        mintaMedia(i);
      }
      function tutupDetail(){
        detailOpen = false;
        $('detail').classList.remove('show');
        // Hentikan video yang lagi jalan biar tidak nyanyi di belakang layar
        // waktu kartu ditutup.
        var v = $('d-stage').querySelector('video');
        if (v) { try { v.pause(); } catch(e){} }
      }
      $('d-back').onclick = tutupDetail;
    
      function renderDetailFrame(){
        var total = currentList.length;
        $('d-count').textContent = (detailIndex + 1) + '/' + total;
        $('d-up').disabled = (detailIndex <= 0);
        // Tombol "▼" TETAP aktif di foto terakhir yang sudah termuat selama
        // kata kunci ini masih mungkin punya batch lanjutan (belum habisHasil) -
        // menekannya di posisi itu memicu auto-muat lewat handler di bawah,
        // bukan cuma dikunci diam kalau grid-nya sendiri belum tahu sudah habis
        // atau belum.
        $('d-down').disabled = (detailIndex >= total - 1) && habisHasil;
        var p = currentList[detailIndex] || {};
        $('d-cap').innerHTML = (p.title ? '<b>' + escapeHtmlJs(p.title) + '</b><br>' : '') + (p.pinner ? 'oleh ' + escapeHtmlJs(p.pinner) : '');
        // Link pin sudah ada dari hasil pencarian - tidak perlu nunggu gambar
        // atau videonya kelar dimuat buat bisa disalin.
        $('d-copy').disabled = !p.link;
      }
    
      function escapeHtmlJs(s){
        return String(s).replace(/[&<>"']/g, function(c){
          return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
      }
    
      $('d-up').onclick = function(){ if (detailIndex > 0) { detailIndex--; renderDetailFrame(); mintaMedia(detailIndex); } };
      $('d-down').onclick = function(){
        if (detailIndex < currentList.length - 1) {
          detailIndex++; renderDetailFrame(); mintaMedia(detailIndex);
          return;
        }
        // Sudah di foto terakhir yang termuat. Kalau kata kuncinya masih punya
        // sisa di Pinterest, tarik dulu batch berikutnya di belakang layar lalu
        // lanjut otomatis begitu sampai (lihat onHasilTambahan) - jadi orangnya
        // tidak perlu keluar ke grid dulu cuma buat "mancing" batch berikutnya
        // turun.
        if (habisHasil) { toast('Sudah foto terakhir untuk kata kunci ini.'); return; }
        detailTungguLanjut = true;
        $('d-down').disabled = true;
        toast('Memuat foto berikutnya...');
        cobaMuatLanjut();
      };
    
      $('d-copy').onclick = function(){
        var p = currentList[detailIndex];
        if (!p) return;
    
        // Yang disalin adalah URL foto/video yang SEDANG ditampilkan, bukan link
        // halaman Pinterest-nya. Alamat media itu baru diketahui setelah server
        // mengirim meta, jadi diambil dari cache media - dengan link halaman
        // sebagai cadangan kalau medianya belum sempat dimuat.
        var c = mediaCache[detailIndex];
        var alamat = (c && c.media) || p.link;
        if (!alamat) { toast('Pin ini tidak punya link sumber.'); return; }
    
        var label = (c && c.media)
          ? (c.kind === 'video' ? 'Link video disalin' : 'Link foto disalin')
          : 'Link pin disalin';
        salinTeks(alamat, function(ok){ toast(ok ? label : 'Gagal menyalin link'); });
      };
    
      // Coba execCommand('copy') dulu (cara lama, paling luas didukung di
      // webview terbatas kayak kartu interaktif WhatsApp) - baru kalau itu
      // gagal, coba clipboard API modern. PENTING: navigator.clipboard.writeText
      // di sebagian webview bisa melempar error LANGSUNG (bukan Promise
      // ditolak) begitu dipanggil - jadi harus dibungkus try/catch juga,
      // supaya tidak berhenti diam-diam sebelum sempat coba cara cadangan.
      function salinTeks(teks, cb){
        cb = cb || function(){};
    
        if (fallbackSalin(teks)) { cb(true); return; }
    
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            var sudahDijawab = false;
            var jawab = function(ok){ if (sudahDijawab) return; sudahDijawab = true; cb(ok); };
            try {
              navigator.clipboard.writeText(teks).then(function(){ jawab(true); }).catch(function(){ jawab(false); });
            } catch(e) { jawab(false); return; }
            setTimeout(function(){ jawab(false); }, 700);
            return;
          }
        } catch(e){}
        cb(false);
      }
    
      function fallbackSalin(teks){
        try {
          var ta = document.createElement('textarea');
          ta.value = teks;
          ta.style.position = 'fixed';
          ta.style.top = '0';
          ta.style.left = '0';
          ta.style.opacity = '0';
          ta.setAttribute('readonly', '');
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, teks.length);
          var ok = false;
          try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
          document.body.removeChild(ta);
          return !!ok;
        } catch(e){ return false; }
      }
    
      function mintaMedia(i){
        var stage = $('d-stage');
        var p = currentList[i] || {};
        var kind = p.video ? 'video' : 'image';
        var c = mediaCache[i];
        if (c && c.url) {
          tampilkanMedia(c);
          return;
        }
        stage.innerHTML = '<span class="loading">' + (kind === 'video' ? 'Menyiapkan video...' : 'Menyiapkan gambar...') + '</span>';
        kirim({ t:'pl_media', i: i, kind: kind, q: currentQuery });
      }
    
      // Ganti media di layar detail dengan crossfade halus (elemen dibuat lewat
      // DOM API, bukan innerHTML string, supaya bisa dipasangi event load/loadeddata
      // buat memicu class 'masuk' - baru pudar-masuk begitu medianya benar-benar
      // siap ditampilkan, bukan main muncul kaku begitu src dipasang).
      function tampilkanMedia(c){
        var stage = $('d-stage');
        stage.innerHTML = '';
        var el;
        if (c.kind === 'video') {
          el = document.createElement('video');
          el.src = c.url;
          el.controls = true;
          el.playsInline = true;
          el.preload = 'auto';
        } else {
          el = document.createElement('img');
          el.src = c.url;
        }
        stage.appendChild(el);
    
        var tandaiMasuk = function(){ el.classList.add('masuk'); };
        el.addEventListener(c.kind === 'video' ? 'loadeddata' : 'load', tandaiMasuk, { once: true });
        // Data URI base64 biasanya sudah siap dalam hitungan milidetik, tapi
        // jaga-jaga kalau event load-nya entah kenapa tidak pernah nembak di
        // sebagian webview kartu - paksa tetap muncul lewat timeout singkat
        // supaya gambarnya tidak nyangkut transparan selamanya.
        setTimeout(tandaiMasuk, 400);
      }
    
      function onMediaProses(d){
        // Buang balasan "nyasar" dari pencarian sebelumnya (lihat catatan di
        // onHasil) - kalau query di balasan sudah tidak sama dengan yang aktif
        // sekarang, abaikan total, jangan disentuh cache/tampilan sama sekali.
        if (d.q !== currentQuery) return;
        if (d.i !== detailIndex) return;
        $('d-stage').innerHTML = '<span class="loading">' + (d.kind === 'video' ? 'Menyiapkan video...' : 'Menyiapkan gambar...') + '</span>';
      }
      function onMediaMeta(d){
        if (d.q !== currentQuery) return;
        mediaCache[d.i] = { kind: d.kind, mime: d.mime, media: d.media || null, chunks: new Array(d.totalBongkah), total: d.totalBongkah, diterima: 0, url: null };
        if (d.i === detailIndex && d.fallback) {
          toast(d.kind === 'image' ? 'Video tidak tersedia, menampilkan gambar' : 'Memuat ulang media');
        }
      }
      function onMediaBongkah(d){
        if (d.q !== currentQuery) return;
        var c = mediaCache[d.i];
        if (!c) return;
        c.chunks[d.c] = d.data;
        c.diterima++;
        if (d.i === detailIndex && c.total > 1) {
          var pct = Math.round((c.diterima / c.total) * 100);
          var lbl = $('d-stage').querySelector('.loading');
          if (lbl) lbl.textContent = (c.kind === 'video' ? 'Memuat video... ' : 'Memuat gambar... ') + pct + '%';
        }
      }
      function onMediaSelesai(d){
        if (d.q !== currentQuery) return;
        var c = mediaCache[d.i];
        if (!c) return;
        var b64 = c.chunks.join('');
        c.url = 'data:' + c.mime + ';base64,' + b64;
        c.chunks = null;
        if (d.i === detailIndex) tampilkanMedia(c);
      }
    
      sambung();
    })();
    </script>
    `;
    }

    module.exports = { buildPinLiveHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Pinlive — cari & lihat gambar/video Pinterest langsung di dalam kartu WhatsApp
//   .pinx
const LN = require('../../lib/livenet')
const { buildPinLiveHtml } = require('../../lib/cards/pinlive')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'pinx',
  alias: [],
  category: 'rich',
  desc: 'Cari & lihat gambar/video Pinterest langsung di dalam kartu WhatsApp',
  run: async ({ sock, m, reply, pushname }) => {
    LN.start()
    if (!LN.pin.aktif()) return reply('⚠️ Server Pinlive belum siap. Tunggu beberapa detik lalu coba lagi.')
    const relayUrl = LN.pinT.bacaRelayPin()
    if (!relayUrl) return reply('⚠️ Tunnel Pinlive belum terbentuk. Tunggu sebentar (cloudflared sedang menyala), lalu coba lagi.')
    const kunci = LN.pin.buatKunci(m.sender, { bebas: false })
    const botName = (sock.user && sock.user.name) || global.namebot || 'Kaguya'
    const html = buildPinLiveHtml({ botName, playerName: pushname || m.sender.split('@')[0], relayUrl, kunci })
    await sendHtmlCard(sock, m, html, `Pinlive - ${botName}`, '📌')
  },
}
    }

dioRegister("rich/pinlive", feature, libs)

let handler = (m, ctx) => dioRun("rich/pinlive", m, ctx)

handler.command = ['pinx']
handler.help = ['pinx']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'pinlive', { subs: false })
