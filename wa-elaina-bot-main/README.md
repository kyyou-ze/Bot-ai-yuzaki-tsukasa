# wa-tsukasa-bot (Tsukasa — WhatsApp Assistant) — Node.js / Baileys

Asisten WhatsApp berkarakter **Tsukasa**: chat AI berpersona (Gemini), jawab gambar (Vision), transkrip **voice note (VN)** → auto-reply, **downloader TikTok (TikWM)**, **Blue Archive**, **Pap**, **Brat/Sticker**, **TTS VN**, **Image Generation**, **Hijabin**, **AnimeKita**, **Peraturan/Moderation**, **Welcome**, **TagAll**, **RVO**, dan **HTTP API**. Dirancang agar mudah dijalankan di **Pterodactyl** (Node.js egg).

> Bot ini sebelumnya bernama **Elaina**. Semua default nama, trigger, persona, command, state, dan watermark sudah diganti menjadi **Tsukasa**.

## Fitur Utama

- **Chat AI berkarakter Tsukasa** — Mode `MANUAL` (butuh trigger `tsukasa`) atau `AUTO`. Persona `tsukasa1`/`tsukasa2` bisa diubah per chat (`!tsukasa persona ...`). Mode Pro bisa diaktifkan per chat.
- **Vision** — Kirim/reply gambar + sebut `tsukasa` untuk dianalisis Gemini.
- **VN → Teks → Auto-reply** — VN langsung akan ditranskrip & dibalas. VN hasil _quote_ hanya diproses jika menyebut `tsukasa`.
- **TTS VN** (`tsukasa vn <teks>`) — Hasilkan voice note via ElevenLabs (bisa pakai konteks balasan).
- **Buat Gambar** (`tsukasa buatin gambar <prompt>`) atau `!gambar <prompt>` — Generate gambar dengan Gemini.
- **Hijabin** (`tsukasa hijabin` / reply gambar) — Tambahkan hijab (JPEG/PNG).
- **Brat & Sticker** — `tsukasa brat <teks>` untuk sticker gaya brat. Sticker biasa dari gambar/URL/video (animated memakai ffmpeg).
- **Blue Archive & Pap** — `ba` / `!ba` atau kata kunci terkait, `!pap` / `pap`.
- **TikTok (TikWM)** — Kirim link TikTok (vt/vm/m/www) otomatis terunduh (video/slide + audio link). Batas ukuran bisa dikonfigurasi.
- **AnimeKita** — `!anime ...` (new/movie/schedule/list/genre/search/detail/episode). Episode dengan link Pixeldrain bisa diunduh otomatis.
- **Auto-post Anime ke Channel** — Bot otomatis mencari info anime terbaru dari **AniList, Kitsu, AnimeKita, dan MyAnimeList (Jikan)**, lalu memposting ke channel WhatsApp (default `NimaCoRe - Latest Info`) lengkap dengan cover, genre, skor, dan link. Tanpa trigger, berjalan sesuai interval. Cek/tes manual: `!animechannel status` dan `!animechannel test` (owner/admin grup).
- **Peraturan/Moderasi** — `!peraturan on|off|sync|status|rules|clear @user`. Bot menilai pesan grup dengan Gemini moderation, memberi warn (max 5), bisa mengeluarkan otomatis. Bisa kurangi warn dengan "sebut nama bot + saya mau mengurangi warn + subhanallah" 5x.
- **TagAll**, **RVO**, **Welcome**, **Owner features**.
- **HTTP API** — `GET /`, `GET /healthz`, `GET /help`, `POST/GET /send` dengan `X-API-Key` + rate limit.

## Persyaratan

- Node.js >= 20 (disarankan Node 22)
- npm
- Akun Google Gemini (API key) — **wajib**
- Akun WhatsApp untuk pairing (QR atau pairing code)
- `ffmpeg` **tidak wajib**: bot memakai `ffmpeg-static` dari npm. Jika ingin ffmpeg sistem, set `FFMPEG_PATH`.

## Instalasi Lokal

```bash
git clone <repo>
cd wa-tsukasa-bot-main
cp .env.example .env
# Edit .env sesuai kebutuhan
npm install
npm start
```

Scan QR / masukkan pairing code yang muncul untuk menghubungkan WhatsApp.

## Konfigurasi (.env)

Lihat `.env.example` untuk daftar lengkap. Variabel penting:

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `MODE` | `MANUAL` | `MANUAL` (butuh trigger) / `AUTO` |
| `TRIGGER` | `tsukasa` | Kata pemicu |
| `BOT_NAME` | `Tsukasa` | Nama bot |
| `SESSION_DIR` | `./session` | Folder auth Baileys (bisa jadi `*_auth` jika diisi nama file) |
| `PAIRING_NUMBER` | - | Nomor WhatsApp bot untuk pairing code, mis. `6281234567890` |
| `STATE_DB` | `./tsukasa_state.json` | State JSON (persona/pro/warn/peraturan) |
| `PORT` / `SERVER_PORT` | `7860` | Port HTTP API. Di Pterodactyl, `SERVER_PORT` otomatis dipakai |
| `HOST` | `0.0.0.0` | Host bind HTTP API |
| `SEND_API_KEY` | - | API key untuk `/send` |
| `SEND_RATE_PER_MIN` | `10` | Rate limit `/send` per IP |
| `GEMINI_API_KEYS` / `GEMINI_API_KEY` | - | API key Gemini (bisa koma) — wajib |
| `GEMINI_TEXT_MODEL` | `gemini-2.5-flash-lite` | Model chat |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | - | Untuk fitur VN TTS |
| `FFMPEG_PATH` | - | Path ffmpeg manual (opsional) |
| `VN_MAX_WORDS` | `80` | Batas kata script VN |
| `TIKTOK_MAX_VIDEO_MB` | `50` | Batas video TikTok (langsung) |
| `TIKTOK_MAX_IMAGE_MB` | `5` | Batas slide image |
| `TIKTOK_MAX_DOC_MB` | `80` | Batas fallback dokumen |
| `TIKTOK_MAX_SLIDES` | `10` | Max slide dikirim |
| `ANIME_CHANNEL_ENABLED` | `true` | Aktifkan auto-post info anime ke channel |
| `ANIME_CHANNEL_INVITE` | `0029VbC2pzO5K3zPHUeTud01` | Kode/URL invite channel tujuan |
| `ANIME_CHANNEL_JID` | - | JID channel langsung (opsional, mis. `123@newsletter`) |
| `ANIME_CHANNEL_INTERVAL_MIN` | `180` | Interval posting (menit) |
| `ANIME_CHANNEL_MAX_PER_DAY` | `8` | Batas post per hari |
| `ANIME_CHANNEL_SOURCES` | `anilist,kitsu,animekita,jikan` | Sumber info anime |
| `ANIME_CHANNEL_PER_SOURCE` | `8` | Kandidat per sumber |
| `ANIME_CHANNEL_IMAGES` | `true` | Kirim cover (fallback teks jika gagal) |
| `ANIME_CHANNEL_TRANSLATE` | `true` | Terjemahkan sinopsis ke Indonesia via Gemini |
| `ANIME_CHANNEL_START_DELAY_SEC` | `60` | Jeda post pertama setelah terhubung |
| `INFO_FOOTER` | `> yuzaki tsukasa by ren` | Footer output info channel & `!info` |
| `BA_LINKS_LOCAL` / `BA_LINKS_URL` | - | Sumber gambar Blue Archive |
| `PAP_LINKS_PATH` | - | Sumber gambar Pap |
| `PERATURAN_APIKEY` | - | Diperlukan untuk fitur peraturan/moderasi |
| `TSUKASA1_PROMPT` / `TSUKASA2_PROMPT` | - | Override prompt persona |
| `HIJABIN_API_URL` / `HIJABIN_API_KEY` | - | Opsional untuk hijabin via API eksternal |
| `OWNER_*` | - | Konfigurasi owner |
| `WELCOME_ENABLED` / `WELCOME_TEXT` | - | Pesan selamat datang grup |

## Pterodactyl (Node.js Egg)

Ringkasan hasil penyesuaian untuk panel:

- Aplikasi membaca **`SERVER_PORT`** yang diberikan Pterodactyl dan listen di **`0.0.0.0`**, jadi tidak perlu hard-code port.
- Lokasi kerja panel adalah **`/home/container`** dan bersifat persisten. Simpan sesi & state di sana (path relatif sudah benar).
- **Jangan upload `node_modules`**. Biarkan panel/npm yang install.
- `ffmpeg-static` ikut terpasang lewat npm, jadi sticker animasi tetap bisa jalan di image Node egg yang tidak punya ffmpeg.

### Langkah deploy

1. Buat server dengan egg **Node.js** (pilih image **Node 22**, mis. `ghcr.io/ptero-eggs/yolks:nodejs_22` atau `ghcr.io/pterodactyl/yolks:nodejs_22`).
2. Beri allocation/port di tab **Network** (port bebas, mis. `7860`). Port ini otomatis menjadi `SERVER_PORT`.
3. Upload source code:
   - Via **Git**: isi `Git Repo Address`, atau
   - Via **File Manager/SFTP**: upload ZIP yang di dalamnya langsung ada `package.json`, `index.js`, `src/`, lalu **Unarchive**. Jangan sampai menjadi `folder/folder/package.json`.
4. Set environment di tab **Startup** / **Variables** (atau buat `.env` dari `.env.example`):
   - `GEMINI_API_KEYS` (wajib)
   - `SESSION_DIR=./session`
   - `STATE_DB=./tsukasa_state.json`
   - `PAIRING_NUMBER=628xxxxxxxxxx` (opsional, biar tidak scan QR)
   - `MODE=MANUAL`, `TRIGGER=tsukasa`, `BOT_NAME=Tsukasa`
   - `ANIME_CHANNEL_ENABLED=true`, `ANIME_CHANNEL_INVITE=0029VbC2pzO5K3zPHUeTud01`
   - **Jadikan bot admin channel** sebelum menyalakan auto-post.
5. Startup command:
   - Jika bisa diedit (admin/egg custom):
     ```bash
     if [ -f package.json ]; then npm install --omit=dev --no-audit --no-fund; fi; node index.js
     ```
   - Jika memakai egg Node.js generic: cukup set **Main file** = `index.js`. Egg biasanya menjalankan `npm install` otomatis saat start jika `package.json` ada.
6. Atur **Running when console shows** ke `[READY]` (bot mencetak `[READY] Tsukasa siap menerima pesan.`).
7. Start server. Jika `PAIRING_NUMBER` diisi, console akan menampilkan **pairing code**; masukkan di WhatsApp → **Perangkat Tertaut** → **Tautkan dengan nomor telepon**. Jika tidak, scan QR di console.
8. Setelah `[WA] Terhubung`, cek HTTP API di `http://IP:PORT/healthz` (sesuai allocation).

### Catatan penting Pterodactyl

- **Jangan arahkan sesi ke `/tmp`.** Container bisa dibuat ulang; sesi hilang dan harus pairing ulang. Gunakan `./session` (otomatis `/home/container/session`).
- **Backup** `tsukasa_state.json` dan folder `session/` sebelum pindah server.
- Jika ingin mengubah kode, upload ulang lalu restart. Jika dependency berubah, jalankan install ulang (restart dengan startup command di atas atau `npm install` lewat startup egg).
- Panel kadang menampilkan QR kurang rapi di console. Pakai `PAIRING_NUMBER` agar lebih mudah.
- Jika server stuck `starting`, cek **Running when console shows** dan pastikan log `[READY]` muncul.

## Auto-post Anime ke Channel

Fitur ini berjalan otomatis setelah bot terhubung (tidak perlu trigger) dan mengirim satu info anime per interval ke channel WhatsApp.

**Syarat penting:**

1. Bot harus **admin channel** tujuan. Buka channel → **Kelola channel** → **Admin** → tambahkan nomor bot.
2. `ANIME_CHANNEL_INVITE` diisi kode/URL invite channel (default sudah diarahkan ke `NimaCoRe - Latest Info`).
3. Jika resolve invite gagal di server, isi `ANIME_CHANNEL_JID` langsung (mis. `1234567890@newsletter`).

**Cara kerja:**

- Mengambil kandidat dari AniList, Kitsu, AnimeKita, dan Jikan/MyAnimeList secara paralel. Sumber yang timeout/gagal dilewati tanpa menghentikan post.
- Judul yang sudah pernah diposting (per id sumber maupun judul) tidak akan diposting ulang.
- Cover diunduh dan dikirim bersama caption. Jika media gagal, bot otomatis fallback ke teks, lalu ke raw newsletter bila perlu.
- Batas harian `ANIME_CHANNEL_MAX_PER_DAY` mencegah spam. Post pertama menunggu `ANIME_CHANNEL_START_DELAY_SEC`.
- Caption memakai Bahasa Indonesia dan menyertakan branding channel.

**Format info:**

Template info ada di `src/animeinfo.js` dan dipakai oleh auto-post channel maupun perintah `!info`. Formatnya fleksibel untuk anime, film, drama Jepang/Korea, budaya Jejepangan, fakta unik, info absurd, dan topik lain. Output selalu Bahasa Indonesia dengan footer `> yuzaki tsukasa by ren`.

**Perintah manual (owner / admin grup):**

```text
!animechannel status   # status scheduler, channel, jumlah post, error terakhir
!animechannel test     # paksa satu post sekarang (melewati batas harian)
!info <topik>          # info apa saja (anime, film, Jepang, fakta absurd, dll)
```

## HTTP API

- `GET /` atau `GET /healthz` → `ok`
- `GET /help` → daftar endpoint
- `POST/GET /send?to=628xxx&text=...` dengan header `X-API-Key: <SEND_API_KEY>` (jika dikonfigurasi). Mendukung JSON body juga.

## Catatan Teknis

- Versi Baileys yang dipakai: **6.7.24** (paket ESM, dimuat dengan `import()` dinamis dari CommonJS). Versi ini mendukung `newsletterMetadata` dan pengiriman pesan ke channel.
- Session disimpan sebagai folder multi-file auth Baileys. Jika `SESSION_PATH` menunjuk file (`.db/.json/.sqlite`), bot akan mengonversinya ke folder `<nama>_auth`.
- State disimpan dalam **satu file JSON atomik** (`tsukasa_state.json`). Untuk skala kecil aman; backup file ini jika ingin memindahkan data.
- Sticker animasi memakai `ffmpeg-static`. Jika gagal, bot tetap bisa membuat sticker statis via `sharp`.
- File Go asli masih ada untuk referensi; aplikasi utama berjalan dengan `node index.js`.

## Troubleshooting

- **Tidak ada QR/pairing code**: Periksa log, pastikan folder sesi bisa ditulis dan `PAIRING_NUMBER` benar (kode negara, tanpa `+`).
- **`GEMINI_API_KEYS` fatal**: Tambahkan minimal satu API key Gemini.
- **Fitur hijabin/TTS gagal**: Cek kredensial di environment.
- **Sticker animasi gagal**: Pastikan `npm install` selesai (ffmpeg-static terpasang) atau set `FFMPEG_PATH`.
- **Reconnecting terus**: Hapus isi folder sesi hanya jika benar-benar ingin pairing ulang (akan minta QR/kode baru).
- **HTTP API tidak bisa diakses**: Pastikan allocation/port benar, aplikasi listen `0.0.0.0`, dan firewall node mengizinkan port tersebut.
