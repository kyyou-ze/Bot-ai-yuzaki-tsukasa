import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "livenet": (module, exports, require) => {
// Penyalaan relay + tunnel milik fitur ytlive (server relay lokal WebSocket + tunnel cloudflared),
// supaya kartu di dalam chat bisa mengambil data lewat jaringan (sandbox kartu WA tidak boleh fetch biasa).
// start() aman dipanggil berkali-kali. Matikan dengan LIVENET=off (environment variable).
const yt = require('livenet/ytlive-relay'), ytT = require('livenet/ytlive-tunnel')

let started = false
function start() {
  if (started) return
  started = true
  if (String(process.env.LIVENET || '').toLowerCase() === 'off') { console.log('[livenet] LIVENET=off — ytlive tidak dinyalakan'); return }
  setTimeout(() => { try { yt.nyalakan(); ytT.nyalakan() } catch (e) { console.log('[ytlive] gagal nyala:', e.message) } }, 1000)
}
module.exports = { start, yt, ytT }
    },
    "livenet/ytlive-relay": (module, exports, require) => {
// ===========================================================================
// YTLIVE RELAY — diambil PERSIS dari lib/ytlive-relay.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const axios = require('axios');
const { searchYoutube } = require('livenet/youtube-search');
const { youtubeNeoxr } = require('livenet/ytneoxr');
const { durasiKeDetik, detikKeTeks, durasiDariBerkas, alirkanFmp4, hitungAnggaran, ambilSlotFfmpeg, statusFfmpeg } = require('livenet/yt-padat');

// Baca key neoxr dari config.js (global.apikey.neoxr)
let _neoxrKey = null;
async function getNeoxrKey() {
    if (_neoxrKey) return _neoxrKey;
    try {
        let k = (global.apikey && global.apikey.neoxr) || '';
        if (Array.isArray(k)) k = k[0] || '';
        k = String(k).trim();
        if (k) { _neoxrKey = k; return k; }
    } catch (e) { }
    return '';
}


const YTLIVE_PORT = parseInt(process.env.YTLIVE_PORT || '3942', 10);
const YT_MAKS_PESAN = 400 * 1024;
const YT_BONGKAH = 120 * 1024;
const YT_MAKS_DETIK = parseInt(process.env.YTLIVE_MAKS_MENIT || '30', 10) * 60;
const YT_MAKS_UNDUH = 250 * 1024 * 1024;
const YT_MAKS_KIRIM = 60 * 1024 * 1024;
const YT_AMBANG_PADAT = 30 * 1024 * 1024;
const YT_MAKS_HASIL = 20;

// ---------------------------------------------------------------------------
// 1. SERVER WEBSOCKET MINIMAL (RFC 6455)
// ---------------------------------------------------------------------------
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function ytBingkai(opcode, payload) {
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

function ytSoket(socket) {
    const ws = new EventEmitter();
    ws.readyState = 1;
    ws.alive = true;

    let sisa = Buffer.alloc(0);
    let fragOp = 0;
    let fragBuf = [];
    let fragLen = 0;

    const tulis = (buf) => { try { if (!socket.destroyed) socket.write(buf); } catch (e) { } };

    ws.send = (teks) => {
        if (ws.readyState !== 1) return;
        tulis(ytBingkai(1, Buffer.from(String(teks), 'utf8')));
    };

    ws.soket = socket;
    ws.antreanTulis = () => (socket.destroyed ? 0 : socket.writableLength || 0);
    ws.ping = () => { if (ws.readyState === 1) tulis(ytBingkai(9, Buffer.alloc(0))); };
    ws.close = (kode) => {
        if (ws.readyState !== 1) return;
        const p = Buffer.allocUnsafe(2);
        p.writeUInt16BE(kode || 1000, 0);
        tulis(ytBingkai(8, p));
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

            if (len > YT_MAKS_PESAN) return tutupPaksa(1009);
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
            if (opcode === 9) { tulis(ytBingkai(10, data)); continue; }
            if (opcode === 10) { ws.alive = true; continue; }

            if (opcode === 0) {
                if (!fragOp) return tutupPaksa(1002);
                fragLen += len;
                if (fragLen > YT_MAKS_PESAN) return tutupPaksa(1009);
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

function ytKirim(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

// ---------------------------------------------------------------------------
// 1b. JATAH UNDUH VIDEO PER NOMOR BOT
// ---------------------------------------------------------------------------
let ytHookJatah = null;

function ytPasangJatah(hook) {
    ytHookJatah = (hook && typeof hook.cek === 'function') ? hook : null;
}

const YT_JATAH_BEBAS = { bebas: true, sisa: Infinity, batas: Infinity, nama: '' };

function ytCekJatah(bot) {
    if (!ytHookJatah) return YT_JATAH_BEBAS;
    try {
        const j = ytHookJatah.cek(String(bot || ''));
        if (!j || j.bebas) return YT_JATAH_BEBAS;
        return {
            bebas: false,
            sisa: Math.max(0, Number(j.sisa) || 0),
            batas: Math.max(0, Number(j.batas) || 0),
            nama: String(j.nama || 'Free')
        };
    } catch (e) {
        console.error('[YTLIVE] hook cek jatah gagal:', e && e.message);
        return YT_JATAH_BEBAS;
    }
}

function ytPakaiJatah(bot) {
    if (!ytHookJatah || typeof ytHookJatah.pakai !== 'function') return;
    try { ytHookJatah.pakai(String(bot || '')); }
    catch (e) { console.error('[YTLIVE] hook pakai jatah gagal:', e && e.message); }
}

function ytKirimJatah(ws) {
    const j = ytCekJatah(ws.ytBot);
    ytKirim(ws, {
        t: 'yl_jatah',
        bebas: j.bebas,
        sisa: j.bebas ? -1 : j.sisa,
        batas: j.bebas ? -1 : j.batas,
        nama: j.nama
    });
}

// ---------------------------------------------------------------------------
// 2. PENCARIAN & PENGAMBILAN VIDEO
// ---------------------------------------------------------------------------
async function ytAmbilBytes(url, batasByte) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: batasByte,
        maxBodyLength: batasByte,
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return Buffer.from(res.data);
}

const ytThumbCache = new Map();
const YT_THUMB_CACHE_MAKS = 400;

async function ytAmbilThumb(url) {
    if (!url) return null;
    if (ytThumbCache.has(url)) return ytThumbCache.get(url);
    try {
        const buf = await ytAmbilBytes(url, 1.5 * 1024 * 1024);
        const b64 = 'data:image/jpeg;base64,' + buf.toString('base64');
        if (ytThumbCache.size >= YT_THUMB_CACHE_MAKS) ytThumbCache.delete(ytThumbCache.keys().next().value);
        ytThumbCache.set(url, b64);
        return b64;
    } catch (e) {
        ytThumbCache.set(url, null);
        return null;
    }
}

async function ytTanganiCari(ws, q) {
    const query = String(q || '').trim();
    if (!query) return ytKirim(ws, { t: 'yl_err', m: 'Ketik kata kunci dulu.' });
    try {
        const hasil = await searchYoutube(query);
        const list = hasil.slice(0, YT_MAKS_HASIL);
        ws.ytHasil = list;
        ws.ytQuery = query;

        const thumbs = await Promise.all(list.map((v) => ytAmbilThumb(v.thumbnail)));

        ytKirim(ws, {
            t: 'yl_hasil',
            q: query,
            list: list.map((v, i) => ({
                i,
                title: v.title,
                channel: v.channel,
                duration: v.duration,
                views: v.views,
                datePassed: v.datePassed,
                thumb: thumbs[i] || null
            }))
        });
    } catch (e) {
        console.error('[YTLIVE] gagal cari:', e && e.message);
        ytKirim(ws, { t: 'yl_err', m: 'Pencarian gagal. Coba kata kunci lain.' });
    }
}

async function ytAmbilKeBerkas(video, tujuan) {
    const neoxrKey = await getNeoxrKey();
    if (!neoxrKey) {
        throw new Error('API key neoxr belum diisi (apikey.neoxr di config.js).');
    }
    const neo = await youtubeNeoxr(video.url, { quality: '360p', apikey: neoxrKey });
    await ytUnduhUrlKeBerkas(neo.download_url, tujuan, YT_MAKS_UNDUH);
    return { title: neo.title || video.title, sumber: 'neoxr' };
}

function ytUnduhUrlKeBerkas(url, tujuan, maksByte) {
    return new Promise((selesai, gagal) => {
        axios.get(url, {
            responseType: 'stream',
            timeout: 60000,
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }).then((res) => {
            let total = 0;
            let batal = false;
            const keluar = fs.createWriteStream(tujuan);
            res.data.on('data', (d) => {
                total += d.length;
                if (total > maksByte && !batal) {
                    batal = true;
                    try { res.data.destroy(); } catch (e) { }
                    keluar.destroy();
                    gagal(new Error('maxContentLength: sumber melebihi batas ukuran.'));
                }
            });
            res.data.on('error', (e) => { if (!batal) { batal = true; gagal(e); } });
            keluar.on('error', (e) => { if (!batal) { batal = true; gagal(e); } });
            keluar.on('finish', () => { if (!batal) selesai({ bytes: total }); });
            res.data.pipe(keluar);
        }).catch(gagal);
    });
}

const YT_DIR_TMP = path.join(process.cwd(), 'database', 'tmp', 'yt');

function ytBersihkanSisa() {
    try {
        if (!fs.existsSync(YT_DIR_TMP)) return;
        let n = 0;
        for (const nama of fs.readdirSync(YT_DIR_TMP)) {
            fs.rmSync(path.join(YT_DIR_TMP, nama), { recursive: true, force: true });
            n++;
        }
        if (n) console.log(`[YTLIVE] ${n} sisa berkas sementara dibersihkan.`);
    } catch (e) { }
}

const YT_BONGKAH_MENTAH = 90 * 1024;
const YT_ANTREAN_MAKS = 2 * 1024 * 1024;

function ytAlirkan(ws, idx, q, anak, batasByte) {
    return new Promise((selesai, gagal) => {
        let sisa = Buffer.alloc(0);
        let nomor = 0;
        let total = 0;
        let beres = false;
        let dijeda = false;
        let galat = '';

        const tutup = (err) => {
            if (beres) return;
            beres = true;
            try { anak.kill('SIGKILL'); } catch (e) { }
            err ? gagal(err) : selesai({ potongan: nomor, bytes: total });
        };

        const kirimPotongan = (buf) => {
            ytKirim(ws, { t: 'yl_media_bongkah', i: idx, c: nomor++, data: buf.toString('base64'), q });
        };

        anak.stdout.on('data', (d) => {
            if (beres) return;
            if (ws.readyState !== 1) return tutup(new Error('Kartu menutup sambungan.'));

            total += d.length;
            if (total > batasByte) return tutup(new Error('maxContentLength: aliran melebihi batas ukuran.'));

            sisa = sisa.length ? Buffer.concat([sisa, d]) : d;

            while (sisa.length >= YT_BONGKAH_MENTAH) {
                const ambil = Math.floor(YT_BONGKAH_MENTAH / 3) * 3;
                kirimPotongan(sisa.subarray(0, ambil));
                sisa = sisa.subarray(ambil);
            }

            if (ws.antreanTulis && !dijeda && ws.antreanTulis() > YT_ANTREAN_MAKS) {
                dijeda = true;
                anak.stdout.pause();
                const periksa = () => {
                    if (beres) return;
                    if (ws.readyState !== 1) return tutup(new Error('Kartu menutup sambungan.'));
                    if (ws.antreanTulis() <= YT_ANTREAN_MAKS / 2) {
                        dijeda = false;
                        anak.stdout.resume();
                    } else {
                        setTimeout(periksa, 30);
                    }
                };
                setTimeout(periksa, 30);
            }
        });

        anak.stderr.on('data', (d) => { galat += d.toString(); if (galat.length > 4000) galat = galat.slice(-4000); });
        anak.on('error', (e) => tutup(new Error(`ffmpeg tidak bisa dijalankan: ${e.message}`)));
        anak.on('close', (kode) => {
            if (beres) return;
            if (kode !== 0) {
                const baris = galat.trim().split('\n').filter(Boolean).pop() || `kode ${kode}`;
                return tutup(new Error(`ffmpeg gagal: ${baris}`));
            }
            if (sisa.length) kirimPotongan(sisa);
            if (!total) return tutup(new Error('ffmpeg tidak mengeluarkan data apa pun.'));
            tutup(null);
        });
    });
}

async function ytTanganiMedia(ws, i, q) {
    const idx = Number(i);
    const daftar = ws.ytHasil || [];
    const video = daftar[idx];
    if (!video) return ytKirim(ws, { t: 'yl_err', m: 'Video tidak ditemukan, coba cari ulang.' });

    if (ws.ytSibuk) {
        return ytKirim(ws, { t: 'yl_err', i: idx, q, m: 'Masih ada video yang sedang diunduh. Tunggu sampai selesai.' });
    }

    const kunciVideo = String(video.url || ('#' + idx));
    const sudahDibayar = !!(ws.ytDibayar && ws.ytDibayar.has(kunciVideo));

    const jatah = ytCekJatah(ws.ytBot);
    if (!jatah.bebas && !sudahDibayar && jatah.sisa <= 0) {
        return ytKirim(ws, { t: 'yl_limit', i: idx, q, batas: jatah.batas, nama: jatah.nama });
    }

    ws.ytSibuk = true;
    fs.mkdirSync(YT_DIR_TMP, { recursive: true });
    const dir = fs.mkdtempSync(path.join(YT_DIR_TMP, 'v-'));
    const berkas = path.join(dir, 'sumber.mp4');
    const bersihkan = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } };

    ytKirim(ws, { t: 'yl_media_proses', i: idx, q });
    try {
        let detik = durasiKeDetik(video.duration);
        if (detik && detik > YT_MAKS_DETIK) {
            bersihkan();
            return ytKirim(ws, {
                t: 'yl_err',
                i: idx,
                m: `Video ${detikKeTeks(detik)} - batasnya ${Math.round(YT_MAKS_DETIK / 60)} menit. Coba video lain.`
            });
        }

        const sumber = await ytAmbilKeBerkas(video, berkas);
        const ukuran = fs.statSync(berkas).size;

        if (!jatah.bebas && !sudahDibayar) {
            ytPakaiJatah(ws.ytBot);
            if (!ws.ytDibayar) ws.ytDibayar = new Set();
            ws.ytDibayar.add(kunciVideo);
            ytKirimJatah(ws);
        }

        let opsi, mutu;
        if (ukuran <= YT_AMBANG_PADAT) {
            opsi = { salin: true };
            mutu = '360p';
        } else {
            if (!detik) {
                console.log(`[YTLIVE] durasi "${video.duration}" tidak terbaca, dibaca dari berkasnya.`);
                detik = await durasiDariBerkas(berkas);
            }
            if (!detik) throw new Error('Durasi video tidak terbaca dari berkasnya, tidak bisa hitung bitrate.');
            const anggaran = hitungAnggaran(detik, YT_MAKS_KIRIM);
            opsi = { salin: false, videoKbps: anggaran.videoKbps, tinggi: anggaran.tinggi };
            mutu = `${anggaran.tinggi}p`;
            console.log(`[YTLIVE] ${Math.round(ukuran / 1048576)} MB (${sumber.sumber}), dialirkan sambil dipadatkan ke ${anggaran.tinggi}p @ ${anggaran.videoKbps}kbps ...`);
        }

        ytKirim(ws, {
            t: 'yl_media_meta',
            i: idx,
            mime: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
            title: sumber.title || video.title,
            channel: video.channel,
            quality: mutu,
            alir: true,
            q
        });

        let lepasSlot = null;
        if (!opsi.salin) {
            const antrean = statusFfmpeg();
            if (antrean.jalan >= antrean.maks) {
                console.log(`[YTLIVE] menunggu slot encode (${antrean.jalan}/${antrean.maks} jalan, ${antrean.antre} mengantre) ...`);
            }
            lepasSlot = await ambilSlotFfmpeg();
        }

        try {
            const anak = alirkanFmp4(berkas, opsi);
            const hasil = await ytAlirkan(ws, idx, q, anak, YT_MAKS_KIRIM);
            ytKirim(ws, { t: 'yl_media_selesai', i: idx, total: hasil.potongan, q });
            console.log(`[YTLIVE] selesai: ${hasil.potongan} potongan, ${Math.round(hasil.bytes / 1048576)} MB`);
        } finally {
            if (lepasSlot) lepasSlot();
        }
    } catch (e) {
        console.error('[YTLIVE] gagal ambil video:', e && e.message);
        const kelewatBatas = /maxContentLength|maxBodyLength|terlalu panjang/i.test(String(e && e.message));
        ytKirim(ws, {
            t: 'yl_err',
            i: idx,
            m: kelewatBatas ? 'Video ini kepanjangan/kebesaran buat diputar di kartu. Coba video lain.' : 'Video gagal diambil. Coba video lain.'
        });
    } finally {
        ws.ytSibuk = false;
        bersihkan();
    }
}

// ---------------------------------------------------------------------------
// 3. KUNCI SESI
// ---------------------------------------------------------------------------
const YT_UMUR_KUNCI = 30 * 60 * 1000;
const YT_UMUR_KUNCI_BEBAS = 24 * 60 * 60 * 1000;
const ytKunci = new Map();

function ytBuatKunci(botNumber, opts) {
    ytBersihkanKunci();
    const bebas = !!(opts && opts.bebas);
    const kunci = crypto.randomBytes(9).toString('base64url');
    ytKunci.set(kunci, {
        bot: String(botNumber || ''),
        sampai: bebas ? 0 : Date.now() + YT_UMUR_KUNCI,
        buang: Date.now() + (bebas ? YT_UMUR_KUNCI_BEBAS : YT_UMUR_KUNCI)
    });
    return kunci;
}

function ytBersihkanKunci() {
    const now = Date.now();
    for (const [k, v] of ytKunci) if ((v.buang || v.sampai) < now) ytKunci.delete(k);
}

function ytPakaiKunci(ws, kunci) {
    const v = ytKunci.get(String(kunci || ''));
    if (!v || (v.sampai && v.sampai < Date.now())) {
        ytKirim(ws, { t: 'yl_kunci_habis' });
        try { ws.close(); } catch (e) { }
        return;
    }
    ws.ytBot = v.bot;
    ws.ytSampai = v.sampai;
    ytKirim(ws, { t: 'yl_kunci_ok', sampai: v.sampai });
    ytKirimJatah(ws);
}

// ---------------------------------------------------------------------------
// 4. PENERUS PESAN
// ---------------------------------------------------------------------------
function ytTangani(ws, d) {
    if (d.t === 'yl_kunci') return ytPakaiKunci(ws, d.kunci);
    if (d.t === 'yl_cari') return void ytTanganiCari(ws, d.q);
    if (d.t === 'yl_media') return void ytTanganiMedia(ws, d.i, d.q);
    if (d.t === 'yl_ping') return ytKirim(ws, { t: 'yl_pong', ts: d.ts });
}

// ---------------------------------------------------------------------------
// 5. NYALAKAN SERVER
// ---------------------------------------------------------------------------
let ytAktifFlag = false;
let ytStatus = 'belum';
let ytAntreSiap = [];
const ytSemuaSoket = new Set();

function ytTetapkanStatus(st) {
    if (ytStatus !== 'belum') return;
    ytStatus = st;
    ytAktifFlag = (st === 'aktif');
    const antre = ytAntreSiap;
    ytAntreSiap = [];
    for (const fn of antre) { try { fn(ytAktifFlag); } catch (e) { } }
}

function ytNyalakanServer() {
    const srv = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (String(req.url || '/').split('?')[0] === '/ytlive/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('YTLIVE ok');
        } else { res.writeHead(404); res.end(); }
    });

    srv.on('upgrade', (req, socket) => {
        const kunci = req.headers['sec-websocket-key'];
        if (!kunci || String(req.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
            try { socket.destroy(); } catch (e) { }
            return;
        }
        const terima = crypto.createHash('sha1').update(kunci + WS_MAGIC).digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + terima + '\r\n\r\n'
        );
        socket.setNoDelay(true);

        const ws = ytSoket(socket);
        ytSemuaSoket.add(ws);
        ws.pesanPerDetik = 0;

        ws.on('message', (teks) => {
            ws.pesanPerDetik++;
            let d;
            try { d = JSON.parse(teks); } catch (e) { return; }
            if (!d || typeof d.t !== 'string' || d.t.slice(0, 3) !== 'yl_') return;
            try { ytTangani(ws, d); }
            catch (e) {
                console.error('[YTLIVE] error:', e && e.message);
                ytKirim(ws, { t: 'yl_err', m: 'Ada yang salah di server. Coba lagi.' });
            }
        });

        ws.on('close', () => { ytSemuaSoket.delete(ws); });
    });

    srv.on('error', (e) => {
        if (e && e.code === 'EADDRINUSE') {
            console.log('⚠️ [YTLIVE] port ' + YTLIVE_PORT + ' sudah dipakai — fitur ytlive mati, fitur lain tetap jalan.');
        } else {
            console.log('⚠️ [YTLIVE] server gagal:', e && e.message);
        }
        ytTetapkanStatus('gagal');
    });

    srv.listen(YTLIVE_PORT, () => {
        console.log('▶️ [YTLIVE] server online siap di port ' + YTLIVE_PORT);
        ytTetapkanStatus('aktif');
    });
    return srv;
}

function ytDetak() {
    const jantung = setInterval(() => {
        for (const ws of ytSemuaSoket) {
            if (ws.alive === false) { ws.terminate(); ytSemuaSoket.delete(ws); continue; }
            ws.alive = false;
            ws.ping();
        }
    }, 30000);

    const perDetik = setInterval(() => {
        const now = Date.now();
        for (const ws of ytSemuaSoket) {
            if (ws.pesanPerDetik > 200) { ws.close(1008); ytSemuaSoket.delete(ws); }
            ws.pesanPerDetik = 0;
        }
        for (const ws of ytSemuaSoket) {
            if (ws.ytSampai && ws.ytSampai < now) {
                ytKirim(ws, { t: 'yl_kunci_habis' });
                try { ws.close(); } catch (e) { }
                ytSemuaSoket.delete(ws);
            }
        }
        ytBersihkanKunci();
    }, 1000);

    if (jantung.unref) jantung.unref();
    if (perDetik.unref) perDetik.unref();
}

let ytSudahNyala = false;

function nyalakan() {
    if (ytSudahNyala) return;
    ytSudahNyala = true;
    ytNyalakanServer();
    ytDetak();
    ytBersihkanSisa();

    getNeoxrKey().then(key => {
        if (!key) console.error('[YTLIVE] apikey.neoxr belum diisi di config.js - .yt tidak bisa mengambil video.');
        else console.log('[YTLIVE] apikey.neoxr terbaca dari config.js');
    }).catch(() => {});
}

function saatSiap(fn) {
    if (ytStatus !== 'belum') return fn(ytAktifFlag);
    ytAntreSiap.push(fn);
}

module.exports = {
    nyalakan,
    buatKunci: ytBuatKunci,
    pasangJatah: ytPasangJatah,
    saatSiap,
    aktif: () => ytAktifFlag,
    PORT: YTLIVE_PORT
};
    },
    "livenet/ytneoxr": (module, exports, require) => {
// ===========================================================================
// YTNEOXR — diambil PERSIS dari scrape/ytneoxr.js sairi
// Hanya ganti: require('axios') -> import axios
//              module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const axios = require('axios');

const NEOXR_BASE = 'https://api.neoxr.eu';

async function youtubeNeoxr(url, opts = {}) {
    if (!url) throw new Error('URL YouTube wajib diisi.');

    const apikey = opts.apikey || (Array.isArray(global.apikey && global.apikey.neoxr) ? global.apikey.neoxr[0] : global.apikey && global.apikey.neoxr);
    if (!apikey) throw new Error('API key neoxr belum diisi (apikey.neoxr di config.js).');

    const quality = opts.quality || '360p';

    const apiUrl = `${NEOXR_BASE}/api/youtube?url=${encodeURIComponent(url)}` +
        `&type=video&quality=${encodeURIComponent(quality)}&apikey=${encodeURIComponent(apikey)}`;

    const res = await axios.get(apiUrl, {
        timeout: opts.timeout || 120000,
        validateStatus: () => true
    });

    if (res.status !== 200) throw new Error(`HTTP ${res.status} dari api.neoxr.eu`);

    const body = res.data;
    if (!body || body.status !== true) {
        throw new Error(`ditolak: ${(body && (body.message || body.msg)) || 'tanpa keterangan'}`);
    }

    const link = (body.data && body.data.url) || body.url;
    if (!link) throw new Error('tidak mengembalikan link video.');

    return {
        title: body.title || (body.data && body.data.title) || null,
        quality: (body.data && body.data.quality) || quality,
        download_url: link
    };
}

module.exports = { youtubeNeoxr };
    },
    "livenet/yt-padat": (module, exports, require) => {
// ===========================================================================
// YT-PADAT — diambil PERSIS dari lib/yt-padat.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function pathFfmpeg() {
    try {
        const p = require('ffmpeg-static');
        if (p && fs.existsSync(p)) return p;
    } catch (e) { }
    try {
        const p = require('@ffmpeg-installer/ffmpeg').path;
        if (p && fs.existsSync(p)) return p;
    } catch (e) { }
    return 'ffmpeg';
}

function durasiKeDetik(teks) {
    const bersih = String(teks || '')
        .replace(/[\u00a0\u200b-\u200f\u2066-\u2069]/g, ' ')
        .trim();

    const cocok = bersih.match(/(\d{1,3})\s*[:.](\s*\d{1,2})(?:\s*[:.](\s*\d{1,2}))?/);
    if (!cocok) return null;

    const a = parseInt(cocok[1], 10);
    const b = parseInt(cocok[2], 10);
    const c = cocok[3] === undefined ? null : parseInt(cocok[3], 10);
    if (![a, b].every(Number.isFinite)) return null;

    const detik = c === null ? (a * 60 + b) : (a * 3600 + b * 60 + c);
    return detik > 0 ? detik : null;
}

function durasiDariBerkas(berkas) {
    return new Promise((selesai) => {
        const anak = spawn(pathFfmpeg(), ['-i', berkas], { stdio: ['ignore', 'ignore', 'pipe'] });

        let galat = '';
        anak.stderr.on('data', (d) => { galat += d.toString(); if (galat.length > 20000) galat = galat.slice(-20000); });

        const jamPasir = setTimeout(() => { try { anak.kill('SIGKILL'); } catch (e) { } }, 30000);

        anak.on('error', () => { clearTimeout(jamPasir); selesai(null); });
        anak.on('close', () => {
            clearTimeout(jamPasir);
            const m = galat.match(/Duration:\s*(\d+):(\d{2}):(\d{2})(?:\.(\d+))?/);
            if (!m) return selesai(null);
            const detik = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? parseFloat('0.' + m[4]) : 0);
            selesai(detik > 0 ? detik : null);
        });
    });
}

function detikKeTeks(detik) {
    const m = Math.floor(detik / 60);
    const s = Math.round(detik % 60);
    return `${m} menit ${s} detik`;
}

async function padatkanVideo(bufferMasuk, detik, targetByte, opts = {}) {
    const timeoutMs = opts.timeoutMs || 600000;

    const akar = path.join(process.cwd(), 'database', 'tmp', 'yt');
    fs.mkdirSync(akar, { recursive: true });
    const dir = fs.mkdtempSync(path.join(akar, 'p-'));
    const masuk = path.join(dir, 'masuk.mp4');
    const keluar = path.join(dir, 'keluar.mp4');
    const bersihkan = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } };

    try {
        fs.writeFileSync(masuk, bufferMasuk);

        if (!detik || detik <= 0) {
            detik = await durasiDariBerkas(masuk);
        }
        if (!detik || detik <= 0) {
            throw new Error('Durasi video tidak terbaca dari berkasnya, tidak bisa hitung bitrate.');
        }

        return await jalankanPadat(masuk, keluar, detik, targetByte, timeoutMs);
    } finally {
        bersihkan();
    }
}

async function jalankanPadat(masuk, keluar, detik, targetByte, timeoutMs) {
    const totalKbps = Math.floor((targetByte * 8 * 0.90) / detik / 1000);
    const audioKbps = 56;
    const videoKbps = totalKbps - audioKbps;

    if (videoKbps < 100) {
        throw new Error('Video ini terlalu panjang untuk dipadatkan tanpa merusak kualitasnya.');
    }

    const tinggi = videoKbps >= 400 ? 360 : 240;

    await new Promise((selesai, gagal) => {
        const anak = spawn(pathFfmpeg(), [
            '-y',
            '-i', masuk,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-b:v', `${videoKbps}k`,
            '-maxrate', `${Math.round(videoKbps * 1.4)}k`,
            '-bufsize', `${videoKbps * 2}k`,
            '-vf', `scale=-2:${tinggi}`,
            '-r', '24',
            '-c:a', 'aac',
            '-b:a', `${audioKbps}k`,
            '-ac', '1',
            '-ar', '44100',
            '-movflags', '+faststart',
            keluar
        ], { stdio: ['ignore', 'ignore', 'pipe'] });

        let galat = '';
        anak.stderr.on('data', (d) => { galat += d.toString(); if (galat.length > 4000) galat = galat.slice(-4000); });

        const jamPasir = setTimeout(() => {
            try { anak.kill('SIGKILL'); } catch (e) { }
            gagal(new Error(`ffmpeg timeout setelah ${Math.round(timeoutMs / 1000)} detik.`));
        }, timeoutMs);

        anak.on('error', (e) => { clearTimeout(jamPasir); gagal(new Error(`ffmpeg tidak bisa dijalankan: ${e.message}`)); });
        anak.on('close', (kode) => {
            clearTimeout(jamPasir);
            if (kode !== 0) {
                const baris = galat.trim().split('\n').filter(Boolean).pop() || `kode ${kode}`;
                return gagal(new Error(`ffmpeg gagal: ${baris}`));
            }
            selesai();
        });
    });

    const hasil = fs.readFileSync(keluar);
    return { buffer: hasil, quality: `${tinggi}p` };
}

function alirkanFmp4(masuk, opsi = {}) {
    const wadah = [
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4',
        'pipe:1'
    ];

    let args;
    if (opsi.salin) {
        args = ['-y', '-i', masuk, '-c', 'copy'].concat(wadah);
    } else {
        const audioKbps = opsi.audioKbps || 56;
        args = [
            '-y', '-i', masuk,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
            '-b:v', `${opsi.videoKbps}k`,
            '-maxrate', `${Math.round(opsi.videoKbps * 1.4)}k`,
            '-bufsize', `${opsi.videoKbps * 2}k`,
            '-vf', `scale=-2:${opsi.tinggi}`,
            '-r', '24',
            '-c:a', 'aac', '-b:a', `${audioKbps}k`, '-ac', '1', '-ar', '44100'
        ].concat(wadah);
    }

    return spawn(pathFfmpeg(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

const FFMPEG_MAKS = Math.max(1, parseInt(process.env.FFMPEG_MAKS_SERENTAK || '2', 10));
let ffmpegJalan = 0;
const ffmpegAntre = [];

function ambilSlotFfmpeg() {
    return new Promise((selesai) => {
        const beri = () => {
            let sudahLepas = false;
            selesai(() => {
                if (sudahLepas) return;
                sudahLepas = true;
                ffmpegJalan--;
                const berikutnya = ffmpegAntre.shift();
                if (berikutnya) { ffmpegJalan++; berikutnya(); }
            });
        };
        if (ffmpegJalan < FFMPEG_MAKS) { ffmpegJalan++; beri(); }
        else ffmpegAntre.push(beri);
    });
}

function statusFfmpeg() {
    return { jalan: ffmpegJalan, antre: ffmpegAntre.length, maks: FFMPEG_MAKS };
}

function hitungAnggaran(detik, targetByte) {
    const totalKbps = Math.floor((targetByte * 8 * 0.90) / detik / 1000);
    const audioKbps = 56;
    const videoKbps = totalKbps - audioKbps;
    if (videoKbps < 100) {
        throw new Error('Video ini terlalu panjang untuk dipadatkan tanpa merusak kualitasnya.');
    }
    return { videoKbps, tinggi: videoKbps >= 400 ? 360 : 240 };
}

module.exports = {
    durasiKeDetik, detikKeTeks, durasiDariBerkas,
    padatkanVideo, alirkanFmp4, hitungAnggaran, pathFfmpeg,
    ambilSlotFfmpeg, statusFfmpeg, FFMPEG_MAKS
};
    },
    "livenet/youtube-search": (module, exports, require) => {
// ===========================================================================
// PENCARIAN YOUTUBE — diambil PERSIS dari scrape/youtube.js sairi
// Hanya ganti: require('axios') -> import axios
//              module.exports -> export
// Logika, body, header, parser: TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const axios = require('axios');
const cheerio = require('cheerio');

// ---------------------------------------------------------------------------
// 1. PENCARIAN
// ---------------------------------------------------------------------------

async function searchYoutube(query) {
    if (typeof query !== 'string' || !query.trim()) throw new Error('Kata kunci pencarian kosong.');

    const body = {
        context: {
            client: {
                hl: 'id',
                gl: 'ID',
                clientName: 'WEB',
                clientVersion: '2.20250701.09.00'
            }
        },
        params: 'EgIQAQ%3D%3D',
        query
    };

    const res = await axios.post(
        'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
        body,
        {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        }
    );

    const json = res.data;
    const kontenAwal = json && json.contents && json.contents.twoColumnSearchResultsRenderer &&
        json.contents.twoColumnSearchResultsRenderer.primaryContents &&
        json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
        json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;

    const daftarMentah = (kontenAwal && kontenAwal[0] && kontenAwal[0].itemSectionRenderer &&
        kontenAwal[0].itemSectionRenderer.contents) || [];

    const result = daftarMentah
        .filter((v) => v && v.videoRenderer && v.videoRenderer.lengthText && v.videoRenderer.lengthText.simpleText)
        .map((v) => {
            const vr = v.videoRenderer;
            const videoId = vr.videoId;
            const thumbs = (vr.thumbnail && vr.thumbnail.thumbnails) || [];
            return {
                videoId,
                title: (vr.title && vr.title.runs && vr.title.runs[0] && vr.title.runs[0].text) || '(tanpa judul)',
                channel: (vr.ownerText && vr.ownerText.runs && vr.ownerText.runs[0] && vr.ownerText.runs[0].text) || '-',
                url: `https://youtu.be/${videoId}`,
                thumbnail: (thumbs[1] && thumbs[1].url) || (thumbs[0] && thumbs[0].url) || null,
                duration: vr.lengthText.simpleText,
                datePassed: (vr.publishedTimeText && vr.publishedTimeText.simpleText) || null,
                views: (vr.shortViewCountText && vr.shortViewCountText.simpleText) || '-'
            };
        });

    if (!result.length) throw new Error(`Tidak ada video ditemukan untuk "${query}".`);
    return result;
}

// ---------------------------------------------------------------------------
// 2. DOWNLOAD — 3 sumber berjenjang (ANDROID player → youtubemp4.to → flvto)
// ---------------------------------------------------------------------------

function convertid(url) {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?]|$)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

const YT_ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

async function ambilFormatAndroid(youtube_id) {
    const res = await axios.post(
        `https://www.youtube.com/youtubei/v1/player?key=${YT_ANDROID_KEY}&prettyPrint=false`,
        {
            videoId: youtube_id,
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '19.09.37',
                    androidSdkVersion: 30,
                    hl: 'en',
                    gl: 'US'
                }
            },
            contentCheckOk: true,
            racyCheckOk: true
        },
        {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
            }
        }
    );

    const data = res.data;
    const status = data && data.playabilityStatus && data.playabilityStatus.status;
    if (status !== 'OK') {
        const alasan = (data && data.playabilityStatus && data.playabilityStatus.reason) || `status: ${status || 'tidak diketahui'}`;
        throw new Error(`Video tidak bisa diputar (${alasan}).`);
    }

    const formats = (data.streamingData && data.streamingData.formats) || [];
    const siapPakai = formats.filter((f) => f && typeof f.url === 'string' && /^video\/mp4/.test(f.mimeType || ''));
    if (!siapPakai.length) throw new Error('Tidak ada format mp4 progresif siap-pakai dari client Android.');

    siapPakai.sort((a, b) => (a.height || 0) - (b.height || 0));
    const pilihan = siapPakai[0];

    return {
        title: (data.videoDetails && data.videoDetails.title) || null,
        quality: pilihan.qualityLabel || (pilihan.height ? `${pilihan.height}p` : '-'),
        width: pilihan.width,
        height: pilihan.height,
        fps: pilihan.fps,
        download_url: pilihan.url
    };
}

async function ambilDariYoutubeMp4To(url) {
    const baseUrl = 'https://youtubemp4.to';
    const headersDasar = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9',
        Referer: `${baseUrl}/HAOT/`,
        Origin: baseUrl
    };

    let cookies = '';
    try {
        const cek = await axios.head(`${baseUrl}/HAOT/`, { headers: headersDasar, timeout: 15000 });
        cookies = cek.headers['set-cookie'] ? cek.headers['set-cookie'].join('; ') : '';
    } catch (e) { }

    const { data } = await axios.post(
        `${baseUrl}/download_ajax/`,
        new URLSearchParams({ url }).toString(),
        {
            timeout: 30000,
            headers: {
                ...headersDasar,
                Cookie: cookies,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            }
        }
    );

    const $ = cheerio.load((data && data.result) || '');
    const title = $('.meta h2').text().trim() || null;

    const semuaFormat = [];
    $('.results-other table tbody tr').each((_, el) => {
        const kualitas = $(el).find('td').eq(0).text().trim();
        const link = $(el).find('td a').attr('href') || '';
        if (link) semuaFormat.push({ kualitas, link });
    });

    const formatVideo = semuaFormat
        .filter((f) => !/audio|mp3|kbps|kbit/i.test(f.kualitas))
        .map((f) => ({ ...f, angka: parseInt((f.kualitas.match(/\d+/) || [])[0] || '0', 10) }))
        .filter((f) => f.angka > 0)
        .sort((a, b) => a.angka - b.angka);

    if (!formatVideo.length) throw new Error('Situs tidak mengembalikan link video mp4 yang bisa dipakai.');

    const pilihan = formatVideo[0];
    return { title, quality: pilihan.kualitas, download_url: pilihan.link };
}

async function ambilDariFlvto(youtube_id, cleanFormat, customQuality) {
    const converter = await axios.post(
        'https://ht.flvto.online/converter',
        { id: youtube_id, fileType: cleanFormat },
        {
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0',
                'Content-Type': 'application/json',
                origin: 'https://ht.flvto.online',
                referer: `https://ht.flvto.online/button?url=https://www.youtube.com/watch?v=${youtube_id}&fileType=${cleanFormat}`
            }
        }
    );

    const data = converter.data;
    if (!data || (data.status !== 'ok' && data.status !== 'success')) {
        throw new Error((data && data.msg) || 'Server converter gagal memproses video ini.');
    }

    if (cleanFormat === 'mp3') {
        const targetQuality = customQuality ? String(customQuality).toLowerCase().replace('kbps', '') : '320';
        return {
            status: true,
            result: {
                videoId: youtube_id,
                title: data.title,
                type: 'mp3',
                quality: `${targetQuality}kbps`,
                filesize: data.filesize || 0,
                duration: data.duration || 0,
                download_url: data.link
            }
        };
    }

    if (cleanFormat === 'mp4') {
        if (!Array.isArray(data.formats) || !data.formats.length) {
            throw new Error('Gagal mengekstrak daftar format resolusi video.');
        }
        const targetQuality = customQuality ? String(customQuality).toLowerCase().replace('p', '') + 'p' : '720p';
        let selected = data.formats.find((v) => v.qualityLabel === targetQuality);
        if (!selected) {
            const urut = data.formats.slice().sort((a, b) => (a.height || 0) - (b.height || 0));
            selected = urut[0];
        }
        return {
            status: true,
            result: {
                videoId: youtube_id,
                title: data.title,
                type: 'mp4',
                quality: selected.qualityLabel,
                resolution: `${selected.width}x${selected.height}`,
                fps: selected.fps || 30,
                download_url: selected.url
            }
        };
    }

    throw new Error("Format tidak didukung, gunakan 'mp3' atau 'mp4'.");
}

async function downloadYoutube(url, format = 'mp4', customQuality = null) {
    try {
        const youtube_id = convertid(url) || (/^[a-zA-Z0-9_-]{11}$/.test(String(url || '').trim()) ? String(url).trim() : null);
        if (!youtube_id) throw new Error('URL/ID YouTube tidak valid.');

        const cleanFormat = String(format || 'mp4').toLowerCase().trim();

        if (cleanFormat === 'mp4') {
            const kesalahan = [];

            try {
                const hasil = await ambilFormatAndroid(youtube_id);
                return {
                    status: true,
                    result: {
                        videoId: youtube_id,
                        title: hasil.title,
                        type: 'mp4',
                        quality: hasil.quality,
                        resolution: (hasil.width && hasil.height) ? `${hasil.width}x${hasil.height}` : undefined,
                        fps: hasil.fps || 30,
                        download_url: hasil.download_url
                    }
                };
            } catch (e) {
                kesalahan.push(`client Android: ${e.message}`);
                console.error('[YTLIVE] SUMBER 1 (client Android) gagal, coba SUMBER 2 (youtubemp4.to):', e && e.message);
            }

            try {
                const hasil2 = await ambilDariYoutubeMp4To(url);
                return {
                    status: true,
                    result: {
                        videoId: youtube_id,
                        title: hasil2.title,
                        type: 'mp4',
                        quality: hasil2.quality,
                        download_url: hasil2.download_url
                    }
                };
            } catch (e2) {
                kesalahan.push(`youtubemp4.to: ${e2.message}`);
                console.error('[YTLIVE] SUMBER 2 (youtubemp4.to) gagal, coba SUMBER 3 (converter cadangan):', e2 && e2.message);
            }

            try {
                return await ambilDariFlvto(youtube_id, 'mp4', customQuality);
            } catch (e3) {
                kesalahan.push(`converter cadangan: ${e3.message}`);
                throw new Error(kesalahan.join(' | '));
            }
        }

        return await ambilDariFlvto(youtube_id, cleanFormat, customQuality);
    } catch (error) {
        return { status: false, message: error.message };
    }
}

module.exports = { searchYoutube, downloadYoutube, convertid };
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
    "livenet/ytlive-tunnel": (module, exports, require) => {
// ===========================================================================
// YTLIVE TUNNEL — diambil PERSIS dari lib/ytlive-tunnel.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pastikanCloudflared } = require('livenet/cloudflared');
const relay = require('livenet/ytlive-relay');


const URL_FILE = path.join(process.cwd(), 'database', 'runtime', 'livenet-ytlive-tunnel-url.txt');

let proses = null;
let sudahNyala = false;
let gagalBeruntun = 0;
const MAKS_GAGAL = 3;

function jadwalUlang() {
    if (gagalBeruntun >= MAKS_GAGAL) {
        console.log('⛔ [YTLIVE] tunnel gagal ' + MAKS_GAGAL + ' kali beruntun — menyerah. ' +
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
        console.log('🔧 [YTLIVE] izin eksekusi cloudflared diperbaiki (chmod +x)');
        return true;
    } catch (e) {
        console.log('⚠️ [YTLIVE] cloudflared ada di ' + bin + ' tapi tidak bisa dieksekusi (' +
            (e && e.code || 'EACCES') + '). Jalankan: chmod +x ' + bin);
        return false;
    }
}

async function jalankanCloudflared() {
    if (proses) return;

    const bin = await cariCloudflared();
    if (!bin) {
        console.log('ℹ️ [YTLIVE] cloudflared tidak ketemu di mesin ini. Dicari di: ' + tempatDicari() + '.\n' +
            '   Pasang cloudflared di node ini, atau tunjuk lokasinya lewat CLOUDFLARED_BIN=/path/ke/cloudflared (environment variable).');
        return;
    }
    if (!pastikanBisaDieksekusi(bin)) return;

    let dapat = false, buf = '';
    const mulai = Date.now();
    try {
        proses = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + relay.PORT]);
    } catch (e) {
        console.log('⚠️ [YTLIVE] tunnel gagal dijalankan:', e && e.message);
        proses = null;
        return;
    }

    proses.on('error', (e) => {
        proses = null;
        console.log('⚠️ [YTLIVE] cloudflared gagal dijalankan: ' + (e && e.code || '') + ' ' + (e && e.message || ''));
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
            console.log('✅ [YTLIVE] tunnel aktif: ' + u);
        }
    };
    proses.stdout.on('data', baca);
    proses.stderr.on('data', baca);

    proses.on('exit', () => {
        proses = null;
        if (dapat) gagalBeruntun = 0;
        else if (Date.now() - mulai < 5000) gagalBeruntun++;
        try { fs.unlinkSync(URL_FILE); } catch (e) { }
        console.log('🔁 [YTLIVE] tunnel mati.');
        jadwalUlang();
    });

    setTimeout(() => {
        if (proses && !dapat) { try { proses.kill(); } catch (e) { } }
    }, 60000);
}

function nyalakan() {
    if (sudahNyala) return;
    sudahNyala = true;
    if (String(process.env.YTLIVE_TUNNEL || '').toLowerCase() === 'off') {
        console.log('ℹ️ [YTLIVE] YTLIVE_TUNNEL=off — tunnel tidak dinyalakan dari sini');
        return;
    }
    relay.saatSiap((aktif) => {
        if (!aktif) {
            console.log('⚠️ [YTLIVE] server ytlive tidak jalan — tunnel dilewati');
            return;
        }
        jalankanCloudflared();
    });
}

function bacaRelayYt() {
    if (!relay.aktif()) return '';
    try {
        const u = fs.readFileSync(URL_FILE, 'utf8').trim();
        return /^wss?:\/\//.test(u) ? u : '';
    } catch (e) { return ''; }
}

module.exports = { nyalakan, bacaRelayYt, URL_FILE };
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
    "cards/ytlive": (module, exports, require) => {
    // ===========================================================================
    // YTLIVE-CARD — diambil PERSIS dari scrape/ytlive.js sairi (fungsi buildYtLiveHtml)
    // Hanya ganti: module.exports -> export
    // HTML/CSS/JS di dalam TIDAK DIUBAH SAMA SEKALI
    // ===========================================================================

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildYtLiveHtml(opts = {}) {
        const botName = escapeHtml(opts.botName || 'Bot');

        const relayUrl = String(opts.relayUrl || '').trim();
        const konfig = JSON.stringify({
            url: /^wss?:\/\//.test(relayUrl) ? relayUrl : '',
            nama: opts.playerName || 'Pemain',
            kunci: String(opts.kunci || '')
        });

        return `
    <style>
    :root{
      --bg:#0f0f0f; --card:#181818; --card-2:#212121;
      --ink:#ffffff; --ink-soft:#aaaaaa; --muted:#8a8a8a;
      --red:#ff0000; --red-hi:#ff2e2e; --line:#303030;
      --sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    }
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
    html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
    .stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
    
    .app{
      width:100%;max-width:380px;border-radius:16px;overflow:hidden;position:relative;
      background:linear-gradient(180deg,#242424 0%,#181818 26%,var(--bg) 62%);
      box-shadow:0 18px 40px rgba(0,0,0,.55);
      padding:14px 12px 16px;
    }
    
    /* ---------- header ---------- */
    .top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
    .top__logo{width:26px;height:19px;border-radius:6px;background:var(--red);flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff;}
    .top__logo svg{width:12px;height:12px;fill:#fff;}
    .top__meta{min-width:0;flex:1;}
    .top__title{font-size:13px;font-weight:800;letter-spacing:.01em;}
    .top__sub{font-size:10.5px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
    .top__badge{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--red-hi);border:1px solid rgba(255,0,0,.45);border-radius:20px;padding:3px 8px;flex:none;}
    
    .status{font-size:10.5px;color:var(--muted);margin-bottom:10px;min-height:13px;transition:color .2s;}
    .status.wait{color:#e0b34d;}
    .status.bad{color:#ff6b6b;}
    
    .jatah{display:none;font-size:10px;color:var(--ink-soft);margin:-6px 0 10px;line-height:1.5;}
    .jatah b{color:#fff;font-weight:800;}
    .jatah.habis{color:#ff8a8a;}
    .jatah.habis b{color:#ff6b6b;}
    
    .limit{padding:22px 16px;text-align:center;}
    .limit__judul{font-size:13px;font-weight:800;color:#ff6b6b;margin-bottom:8px;}
    .limit__isi{font-size:11px;color:var(--ink-soft);line-height:1.65;}
    .limit__isi b{color:#fff;}
    
    /* ---------- kolom cari ---------- */
    .searchbar{display:flex;gap:8px;margin-bottom:12px;}
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
    
    /* ---------- grid hasil ---------- */
    .gridwrap{position:relative;}
    .grid{
      display:flex;flex-direction:column;gap:10px;min-height:120px;
      max-height:520px;overflow-y:auto;overscroll-behavior:contain;
      scroll-behavior:smooth;-webkit-overflow-scrolling:touch;
      padding-bottom:2px;
    }
    .grid::-webkit-scrollbar{width:4px;}
    .grid::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px;}
    
    .grid-gulir{display:none;align-items:center;justify-content:center;gap:8px;margin:2px 0 10px;}
    .grid-gulir.is-on{display:flex;}
    .grid-gulir button{
      width:26px;height:22px;border:none;border-radius:7px;cursor:pointer;padding:0;
      background:var(--card-2);border:1px solid var(--line);color:var(--ink-soft);
      font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;
    }
    .grid-gulir button:active{background:#2b2b2b;}
    .grid-gulir button:disabled{opacity:.3;}
    .grid-gulir__info{font-size:10px;color:var(--muted);min-width:26px;text-align:center;}
    
    .vid-card{
      display:flex;gap:8px;cursor:pointer;
      opacity:0;transform:translateY(10px);transition:opacity .3s ease, transform .3s ease;
    }
    .vid-card.masuk{opacity:1;transform:translateY(0);}
    .vid-card__thumb{flex:none;width:132px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;position:relative;background:var(--card-2);}
    .vid-card__thumb img{width:100%;height:100%;object-fit:cover;display:block;}
    .vid-card__thumb .ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:9px;}
    .vid-card__dur{position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,.8);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;}
    .vid-card__meta{min-width:0;flex:1;padding-top:1px;}
    .vid-card__title{font-size:12px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .vid-card__channel{font-size:10.5px;color:var(--ink-soft);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .vid-card__extra{font-size:9.5px;color:var(--muted);margin-top:2px;}
    
    .empty,.hint{font-size:11.5px;color:var(--muted);text-align:center;padding:26px 10px;}
    
    /* ---------- layar detail ---------- */
    .detail{position:absolute;inset:0;background:var(--bg);border-radius:16px;display:none;flex-direction:column;padding:12px;z-index:20;}
    .detail.show{display:flex;}
    .detail__top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
    .detail__back{flex:none;width:28px;height:28px;border-radius:50%;background:var(--card-2);border:1px solid var(--line);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;}
    .detail__count{flex:1;text-align:center;font-size:11.5px;color:var(--ink-soft);font-weight:700;}
    .detail__copy{flex:none;height:28px;border-radius:14px;background:var(--red);color:#fff;border:none;padding:0 12px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:5px;}
    .detail__copy:disabled{opacity:.55;}
    
    .detail__stage{flex:1;position:relative;border-radius:12px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;}
    .detail__stage video{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .28s ease;}
    .detail__stage video.masuk{opacity:1;}
    
    .app.gede .detail__stage{border-radius:14px;}
    .detail__zoom{background:rgba(20,20,20,.82);}
    .app.gede .detail__zoom{background:var(--red);}
    .detail__stage .loading{font-size:11px;color:var(--ink-soft);text-align:center;padding:0 20px;}
    .detail__nav{position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:8px;}
    .detail__nav button{width:34px;height:34px;border-radius:50%;border:none;background:rgba(20,20,20,.82);color:#fff;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.4);}
    .detail__nav button:disabled{opacity:.35;}
    .detail__caption{margin-top:8px;}
    .detail__caption b{display:block;font-size:11.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .detail__caption span{font-size:10.5px;color:var(--ink-soft);}
    
    .detail__next{margin-top:10px;border-top:1px solid var(--line);padding-top:8px;}
    .detail__next h4{font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin-bottom:7px;}
    .detail__next .isi{display:flex;flex-direction:column;gap:8px;max-height:190px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
    .detail__next .isi::-webkit-scrollbar{width:4px;}
    .detail__next .isi::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px;}
    .app.gede .detail__next{display:none;}
    
    .next-row{display:flex;gap:8px;cursor:pointer;padding:3px;border-radius:8px;}
    .next-row:active{background:var(--card-2);}
    .next-row.kini{background:var(--card-2);}
    .next-row__thumb{flex:none;width:74px;aspect-ratio:16/9;border-radius:7px;overflow:hidden;background:var(--card-2);position:relative;}
    .next-row__thumb img{width:100%;height:100%;object-fit:cover;display:block;}
    .next-row__dur{position:absolute;right:3px;bottom:3px;background:rgba(0,0,0,.8);font-size:8px;font-weight:700;padding:1px 3px;border-radius:3px;}
    .next-row__meta{min-width:0;flex:1;}
    .next-row__title{font-size:10.5px;font-weight:700;line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .next-row__ch{font-size:9px;color:var(--ink-soft);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .next-row__kini{font-size:9px;color:var(--red-hi);font-weight:800;margin-top:3px;}
    
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
          <div class="top__logo"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
          <div class="top__meta">
            <div class="top__title">Ytlive — ${botName}</div>
            <div class="top__sub" id="sub">Cari & putar video YouTube langsung</div>
          </div>
          <div class="top__badge">LIVE</div>
        </div>
    
        <div class="status" id="status">Menyambung ke server...</div>
        <div class="jatah" id="jatah"></div>
    
        <div class="searchbar">
          <input id="in-q" type="text" placeholder="Cari video di YouTube..." maxlength="80" />
          <button id="btn-cari">Cari</button>
        </div>
    
        <div class="gridwrap">
          <div class="grid" id="grid"></div>
        </div>
        <div class="grid-gulir" id="grid-gulir">
          <button id="grid-atas" title="Ke atas">▲</button>
          <span class="grid-gulir__info" id="grid-gulir-info"></span>
          <button id="grid-bawah" title="Ke bawah">▼</button>
        </div>
        <div class="hint" id="hint">Ketik kata kunci lalu tekan Cari untuk mulai.</div>
    
        <div class="detail" id="detail">
          <div class="detail__top">
            <div class="detail__back" id="d-back">←</div>
            <div class="detail__count" id="d-count">1/1</div>
            <button class="detail__copy" id="d-copy">📋 Salin</button>
          </div>
          <div class="detail__stage" id="d-stage"><span class="loading">Menyiapkan...</span></div>
          <div class="detail__nav">
            <button id="d-zoom" class="detail__zoom" title="Perbesar">⛶</button>
            <button id="d-up">▲</button>
            <button id="d-down">▼</button>
          </div>
          <div class="detail__caption" id="d-cap"></div>
          <div class="detail__next" id="d-next">
            <h4>Selanjutnya</h4>
            <div class="isi" id="d-next-isi"></div>
          </div>
        </div>
    
        <div class="toast" id="toast"></div>
        <div class="mati" id="mati" style="display:none;"><span>Server tidak menjawab.</span></div>
      </div>
    </div>
    
    <script>
    (function(){
      var CFG = ${konfig};
      var $ = function(id){ return document.getElementById(id); };
    
      var ws = null, nyambung = false, ulangSambung = 0, timerSambung = null, sesiMati = false;
      var currentList = [];
      var currentQuery = '';
      var detailOpen = false;
      var detailIndex = -1;
      var mediaCache = {};
      var jatahBebas = true, jatahSisa = -1, jatahBatas = 0, jatahNama = 'Free';
    
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
    
      function escapeHtml(s){
        var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML;
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
          kirim({ t:'yl_kunci', kunci: CFG.kunci || '' });
          nyambung = true; ulangSambung = 0;
          setStatus('Tersambung. Ketik kata kunci di atas.', null);
        };
    
        ws.onclose = function(){
          nyambung = false;
          if (sesiMati) return;
          setStatus('Terputus. ' + (ulangSambung ? 'Mencoba lagi...' : ''), 'bad');
          jadwalSambungUlang();
        };
        ws.onerror = function(){ try { ws.close(); } catch(e){} };
    
        ws.onmessage = function(ev){
          var d;
          try { d = JSON.parse(ev.data); } catch(e){ return; }
          tanganiPesan(d);
        };
      }
    
      function jadwalSambungUlang(){
        if (sesiMati) return;
        ulangSambung++;
        if (ulangSambung > 6) {
          setStatus('', null);
          $('mati').style.display = '';
          return;
        }
        clearTimeout(timerSambung);
        timerSambung = setTimeout(sambung, Math.min(1600 * ulangSambung, 8000));
      }
    
      function mulaiCari(q){
        var query = String(q || '').trim();
        if (!query) return;
        if (!nyambung) { setStatus('Belum tersambung ke server.', 'bad'); return; }
        $('btn-cari').disabled = true;
        setStatus('Mencari "' + query + '"...', 'wait');
        kirim({ t:'yl_cari', q: query });
      }
    
      $('btn-cari').addEventListener('click', function(){ mulaiCari($('in-q').value); });
      $('in-q').addEventListener('keydown', function(e){ if (e.key === 'Enter') mulaiCari($('in-q').value); });
    
      function tanganiPesan(d){
        if (d.t === 'yl_kunci_ok') { return; }
        if (d.t === 'yl_kunci_habis') {
          sesiMati = true;
          try { ws.close(); } catch(e){}
          setStatus('', null);
          $('mati').style.display = '';
          $('mati').firstElementChild.textContent = 'Sesi kartu ini berlaku 30 menit dan sudah habis. Kirim .yt lagi buat kartu baru.';
          return;
        }
        if (d.t === 'yl_err') {
          $('btn-cari').disabled = false;
          setStatus(d.m || 'Terjadi kesalahan.', 'bad');
          if (typeof d.i === 'number') onMediaGagal(d);
          return;
        }
        if (d.t === 'yl_jatah') { onJatah(d); return; }
        if (d.t === 'yl_limit') { onLimitHabis(d); return; }
        if (d.t === 'yl_hasil') { onHasil(d); return; }
        if (d.t === 'yl_media_proses') { onMediaProses(d); return; }
        if (d.t === 'yl_media_meta') { onMediaMeta(d); return; }
        if (d.t === 'yl_media_bongkah') { onMediaBongkah(d); return; }
        if (d.t === 'yl_media_selesai') { onMediaSelesai(d); return; }
        if (d.t === 'yl_pong') { return; }
      }
    
      function onHasil(d){
        $('btn-cari').disabled = false;
        currentQuery = d.q;
        currentList = d.list || [];
        $('sub').textContent = 'Hasil untuk "' + d.q + '" (' + currentList.length + ')';
        setStatus('Ketuk salah satu video untuk memutar.', null);
        $('hint').style.display = currentList.length ? 'none' : '';
        if (!currentList.length) $('hint').textContent = 'Tidak ada video ditemukan. Coba kata kunci lain.';
    
        mediaCache = {};
        if (detailOpen) tutupDetail();
    
        var grid = $('grid');
        grid.innerHTML = '';
        grid.scrollTop = 0;
        tambahKartu(currentList);
        gulirGrid.perbarui();
      }
    
      function buatKartuVideo(v){
        var card = document.createElement('div');
        card.className = 'vid-card';
    
        var thumb = document.createElement('div');
        thumb.className = 'vid-card__thumb';
        if (v.thumb) {
          var img = document.createElement('img');
          img.src = v.thumb;
          thumb.appendChild(img);
        } else {
          var ph = document.createElement('div');
          ph.className = 'ph';
          ph.textContent = 'Gagal muat';
          thumb.appendChild(ph);
        }
        if (v.duration) {
          var dur = document.createElement('div');
          dur.className = 'vid-card__dur';
          dur.textContent = v.duration;
          thumb.appendChild(dur);
        }
        card.appendChild(thumb);
    
        var meta = document.createElement('div');
        meta.className = 'vid-card__meta';
        meta.innerHTML =
          '<div class="vid-card__title"></div>' +
          '<div class="vid-card__channel"></div>' +
          '<div class="vid-card__extra"></div>';
        meta.querySelector('.vid-card__title').textContent = v.title || '(tanpa judul)';
        meta.querySelector('.vid-card__channel').textContent = v.channel || '-';
        meta.querySelector('.vid-card__extra').textContent = [v.views, v.datePassed].filter(Boolean).join(' • ');
        card.appendChild(meta);
    
        card.onclick = function(){ bukaDetail(v.i); };
        return card;
      }
    
      function tambahKartu(list){
        if (!list || !list.length) return;
        var grid = $('grid');
        var elBaru = list.map(function(v){
          var card = buatKartuVideo(v);
          grid.appendChild(card);
          return card;
        });
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            elBaru.forEach(function(el){ el.classList.add('masuk'); });
          });
        });
      }
    
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
        el.addEventListener('scroll', perbarui, { passive: true });
        return { perbarui: perbarui };
      }
      var gulirGrid = pasangGulirGrid();
    
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
        var v = $('d-stage').querySelector('video');
        if (v) { try { v.pause(); } catch(e){} }
        setGede(false);
      }
      $('d-back').addEventListener('click', tutupDetail);
      $('d-zoom').addEventListener('click', function(){ setGede(!modeGede); });
    
      function renderDetailFrame(){
        var v = currentList[detailIndex];
        $('d-count').textContent = (detailIndex + 1) + '/' + currentList.length;
        if (v) {
          $('d-cap').innerHTML = '';
          var b = document.createElement('b'); b.textContent = v.title || '-';
          var s = document.createElement('span'); s.textContent = v.channel || '-';
          $('d-cap').appendChild(b); $('d-cap').appendChild(s);
        }
        $('d-up').disabled = detailIndex <= 0;
        $('d-down').disabled = detailIndex >= currentList.length - 1;
        $('d-copy').disabled = !v;
        renderSelanjutnya();
      }
    
      function renderSelanjutnya(){
        var isi = $('d-next-isi');
        if (!isi) return;
        isi.innerHTML = '';
    
        if (currentList.length < 2) {
          $('d-next').style.display = 'none';
          return;
        }
        $('d-next').style.display = '';
    
        var barisKini = null;
    
        currentList.forEach(function(v, i){
          var row = document.createElement('div');
          row.className = 'next-row' + (i === detailIndex ? ' kini' : '');
    
          var th = document.createElement('div');
          th.className = 'next-row__thumb';
          if (v.thumb) {
            var img = document.createElement('img');
            img.src = v.thumb;
            th.appendChild(img);
          }
          if (v.duration) {
            var d = document.createElement('div');
            d.className = 'next-row__dur';
            d.textContent = v.duration;
            th.appendChild(d);
          }
          row.appendChild(th);
    
          var meta = document.createElement('div');
          meta.className = 'next-row__meta';
          var t = document.createElement('div');
          t.className = 'next-row__title';
          t.textContent = v.title || '(tanpa judul)';
          meta.appendChild(t);
          var c = document.createElement('div');
          c.className = i === detailIndex ? 'next-row__kini' : 'next-row__ch';
          c.textContent = i === detailIndex ? '▶ Sedang diputar' : (v.channel || '-');
          meta.appendChild(c);
          row.appendChild(meta);
    
          if (i !== detailIndex) {
            row.onclick = function(){ bukaDetail(i); };
          }
    
          if (i === detailIndex) barisKini = row;
          isi.appendChild(row);
        });
    
        if (barisKini) {
          isi.scrollTop = Math.max(0, barisKini.offsetTop - 8);
        }
      }
    
      $('d-up').addEventListener('click', function(){
        if (detailIndex <= 0) return;
        detailIndex--; renderDetailFrame(); mintaMedia(detailIndex);
      });
      $('d-down').addEventListener('click', function(){
        if (detailIndex >= currentList.length - 1) return;
        detailIndex++; renderDetailFrame(); mintaMedia(detailIndex);
      });
    
      $('d-copy').addEventListener('click', function(){
        var v = currentList[detailIndex];
        if (!v) return;
        var url = v.videoId ? ('https://youtu.be/' + v.videoId) : (v.url || '');
        if (!url) { toast('Video ini tidak punya link.'); return; }
        salinTeks(url, function(ok){ toast(ok ? 'Link video disalin' : 'Gagal menyalin link'); });
      });
    
      function salinTeks(teks, cb){
        cb = cb || function(){};
        if (fallbackSalin(teks)) { cb(true); return; }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            var dijawab = false;
            var jawab = function(ok){ if (dijawab) return; dijawab = true; cb(ok); };
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
    
      function onJatah(d){
        jatahBebas = !!d.bebas;
        jatahBatas = Number(d.batas) || 0;
        jatahSisa = Number(d.sisa);
        if (d.nama) jatahNama = d.nama;
    
        var el = $('jatah');
        if (!el) return;
        if (jatahBebas) { el.style.display = 'none'; return; }
    
        el.style.display = '';
        el.className = 'jatah' + (jatahSisa <= 0 ? ' habis' : '');
        el.innerHTML = 'Jatah unduh hari ini: <b>' + jatahSisa + '/' + jatahBatas + '</b> — reset otomatis jam 00:00';
      }
    
      function onLimitHabis(d){
        if (d && typeof d.batas === 'number' && d.batas) jatahBatas = d.batas;
        if (d && d.nama) jatahNama = d.nama;
        onJatah({ bebas:false, sisa:0, batas:jatahBatas, nama:jatahNama });
    
        setStatus('Limit unduh video bot ini sudah habis.', 'bad');
        toast('Limit bot habis');
    
        if (typeof d.i !== 'number') return;
        delete mediaCache[d.i];
        if (d.i !== detailIndex) return;
        $('d-stage').innerHTML =
          '<div class="limit">' +
            '<div class="limit__judul">⚠️ Limit bot habis</div>' +
            '<div class="limit__isi">' +
              'Bot ini paket <b>' + escapeHtml(jatahNama) + '</b>, jadi cuma bisa mengunduh ' +
              '<b>' + jatahBatas + ' video sehari</b> dan sudah terpakai semua.<br><br>' +
              'Jatahnya balik sendiri jam <b>00:00</b> dan <b>tidak bisa ditambah lewat .claim</b>. ' +
              'Cari-cari video tetap bisa, cuma pemutarannya yang ditahan.' +
            '</div>' +
          '</div>';
      }
    
      function mintaMedia(i){
        var v = currentList[i];
        if (!v) return;
        var stage = $('d-stage');
    
        if (mediaCache[i] && mediaCache[i].url) {
          tampilkanMedia(mediaCache[i]);
          return;
        }
    
        if (!jatahBebas && jatahSisa <= 0) { onLimitHabis({ i: i }); return; }
    
        stage.innerHTML = '<span class="loading">Menyiapkan video...</span>';
        kirim({ t:'yl_media', i: i, q: currentQuery });
      }
    
      function onMediaProses(d){
        if (d.q !== currentQuery || d.i !== detailIndex) return;
        $('d-stage').innerHTML = '<span class="loading">Mengunduh video, mohon tunggu...</span>';
      }
    
      function mseSiap(mime){
        try {
          return !!(window.MediaSource && window.MediaSource.isTypeSupported &&
                    window.MediaSource.isTypeSupported(mime));
        } catch (e) { return false; }
      }
    
      function onMediaMeta(d){
        if (d.q !== currentQuery) return;
        var mime = d.mime || 'video/mp4';
        mediaCache[d.i] = {
          mime: mime,
          chunks: [],
          diterima: 0,
          total: d.total || 0,
          alir: !!d.alir,
          url: null,
          ms: null, sb: null, antre: [], msJalan: false, msRusak: false, tamat: false
        };
        if (d.i === detailIndex) siapkanPemutar(d.i);
      }
    
      function siapkanPemutar(i){
        var c = mediaCache[i];
        if (!c || !c.alir || c.ms || c.msRusak) return;
        if (!mseSiap(c.mime)) { c.msRusak = true; return; }
    
        try {
          var ms = new MediaSource();
          c.ms = ms;
          var video = pasangElemenVideo(URL.createObjectURL(ms));
    
          ms.addEventListener('sourceopen', function(){
            try {
              c.sb = ms.addSourceBuffer(c.mime);
              c.sb.mode = 'sequence';
              c.sb.addEventListener('updateend', function(){ suapBerikutnya(c); });
              c.sb.addEventListener('error', function(){ c.msRusak = true; });
              c.msJalan = true;
              suapBerikutnya(c);
              if (video) video.classList.add('masuk');
            } catch (e) { c.msRusak = true; }
          });
        } catch (e) {
          try { console.warn('[YTLIVE] MediaSource gagal, pakai jalur mundur:', e && e.message); } catch (x) { }
          c.msRusak = true;
          c.ms = null;
        }
      }
    
      function b64KeBytes(b64){
        var biner = atob(b64);
        var arr = new Uint8Array(biner.length);
        for (var k = 0; k < biner.length; k++) arr[k] = biner.charCodeAt(k);
        return arr;
      }
    
      function suapBerikutnya(c){
        if (!c.sb || c.msRusak) return;
        if (c.sb.updating || !c.antre.length) {
          if (!c.antre.length && c.tamat && c.ms && c.ms.readyState === 'open' && !c.sb.updating) {
            try { c.ms.endOfStream(); } catch (e) { }
          }
          return;
        }
        var potong = c.antre.shift();
        try { c.sb.appendBuffer(potong); } catch (e) { c.msRusak = true; }
      }
    
      function onMediaBongkah(d){
        if (d.q !== currentQuery) return;
        var c = mediaCache[d.i];
        if (!c) return;
    
        c.chunks[d.c] = d.data;
        c.diterima++;
    
        if (c.alir && !c.msRusak) {
          if (!c.ms && d.i === detailIndex) siapkanPemutar(d.i);
          if (c.msJalan) {
            try {
              c.antre.push(b64KeBytes(d.data));
              suapBerikutnya(c);
            } catch (e) { c.msRusak = true; }
          }
        }
    
        if (d.i === detailIndex) {
          var lbl = $('d-stage').querySelector('.loading');
          if (lbl) {
            lbl.textContent = c.alir
              ? 'Menyiapkan video... ' + Math.round(c.diterima * 120 / 1024) + ' KB'
              : ('Mengunduh video... ' + Math.round((c.diterima / (c.total || 1)) * 100) + '%');
          }
        }
      }
    
      function onMediaSelesai(d){
        if (d.q !== currentQuery) return;
        var c = mediaCache[d.i];
        if (!c) return;
        c.tamat = true;
    
        if (c.alir && c.msJalan && !c.msRusak) {
          c.chunks = null;
          suapBerikutnya(c);
          return;
        }
    
        if (!c.chunks || !c.chunks.length) return;
        var b64 = c.chunks.join('');
        c.url = 'data:' + String(c.mime).split(';')[0] + ';base64,' + b64;
        c.chunks = null;
        if (d.i === detailIndex) tampilkanMedia(c);
      }
    
      function onMediaGagal(d){
        if (typeof d.i !== 'number') return;
        delete mediaCache[d.i];
        if (d.i === detailIndex) {
          $('d-stage').innerHTML = '<span class="loading">' + escapeHtml(d.m || 'Video gagal diambil.') + '</span>';
        }
      }
    
      function pasangElemenVideo(src){
        var stage = $('d-stage');
        if (!stage) return null;
        stage.innerHTML = '';
        var video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.setAttribute('controlsList', 'nofullscreen nodownload noremoteplayback');
        video.disablePictureInPicture = true;
        video.src = src;
        stage.appendChild(video);
        pasangUkuranPutar(0);
        return video;
      }
    
      function tampilkanMedia(c){
        var video = pasangElemenVideo(c.url);
        if (!video) return;
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){ video.classList.add('masuk'); });
        });
      }
    
      var modeGede = false;
      var RASIO_GEDE = 16 / 9;
      var TINGGI_GEDE_MAKS = 720;
    
      function pasangUkuranPutar(putaran){
        if (typeof putaran !== 'number' || !(putaran >= 0) || putaran > 10) putaran = 0;
        var app = document.querySelector('.app');
        var stage = $('d-stage');
        var video = stage ? stage.querySelector('video') : null;
    
        if (!modeGede) {
          if (app) app.style.minHeight = '';
          if (video) {
            video.style.position = '';
            video.style.top = '';
            video.style.left = '';
            video.style.width = '';
            video.style.height = '';
            video.style.transform = '';
          }
          return;
        }
        if (!video || !app) return;
    
        var r = stage.getBoundingClientRect();
        if (!r.width) return;
    
        var target = Math.min(Math.round(r.width * RASIO_GEDE), TINGGI_GEDE_MAKS);
    
        if (Math.abs(r.height - target) > 2 && putaran < 4) {
          var tinggiApp = app.getBoundingClientRect().height;
          app.style.minHeight = Math.round(tinggiApp - r.height + target) + 'px';
          return requestAnimationFrame(function(){ pasangUkuranPutar(putaran + 1); });
        }
    
        video.style.position = 'absolute';
        video.style.top = '50%';
        video.style.left = '50%';
        video.style.width = r.height + 'px';
        video.style.height = r.width + 'px';
        video.style.transform = 'translate(-50%,-50%) rotate(90deg)';
      }
    
      function setGede(on){
        modeGede = !!on;
        var app = document.querySelector('.app');
        if (app) app.classList.toggle('gede', modeGede);
        var tombol = $('d-zoom');
        if (tombol) {
          tombol.textContent = modeGede ? '⤡' : '⛶';
          tombol.title = modeGede ? 'Kecilkan' : 'Perbesar';
        }
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){ pasangUkuranPutar(0); });
        });
      }
    
      window.addEventListener('resize', function(){
        if (modeGede) pasangUkuranPutar(0);
      });
    
      sambung();
    })();
    </script>
    `;
    }

    module.exports = { buildYtLiveHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Ytlive — cari & putar video YouTube langsung di dalam kartu WhatsApp
//   .yt
const LN = require('../../lib/livenet')
const { buildYtLiveHtml } = require('../../lib/cards/ytlive')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'yt',
  alias: [],
  category: 'rich',
  desc: 'Cari & putar video YouTube langsung di dalam kartu WhatsApp',
  run: async ({ sock, m, reply, pushname }) => {
    LN.start()
    if (!LN.yt.aktif()) return reply('⚠️ Server Ytlive belum siap. Tunggu beberapa detik lalu coba lagi.')
    const relayUrl = LN.ytT.bacaRelayYt()
    if (!relayUrl) return reply('⚠️ Tunnel Ytlive belum terbentuk. Tunggu sebentar (cloudflared sedang menyala), lalu coba lagi.')
    const kunci = LN.yt.buatKunci(m.sender, { bebas: false })
    const html = buildYtLiveHtml({ botName: (sock.user && sock.user.name) || global.namebot || 'Kaguya', playerName: pushname || m.sender.split('@')[0], relayUrl, kunci })
    await sendHtmlCard(sock, m, html, 'Ytlive', '▶️')
  },
}
    }

dioRegister("rich/ytlive", feature, libs)

let handler = (m, ctx) => dioRun("rich/ytlive", m, ctx)

handler.command = ['yt']
handler.help = ['yt']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'ytlive', { subs: false })
