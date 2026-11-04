# wa-tsukasa-bot (Tsukasa — WhatsApp Assistant) — Node.js / Baileys

Asisten WhatsApp berkarakter **Tsukasa**: chat AI berpersona (Gemini), jawab gambar (Vision), transkrip **voice note (VN)** → auto-reply, **downloader TikTok (multi-API anti-WAF)**, **Blue Archive**, **Pap**, **Brat/Sticker**, **TTS VN**, **Image Generation**, **Hijabin**, **AnimeKita**, **Peraturan/Moderation**, **Welcome**, **TagAll**, **RVO**, dan **HTTP API**. Dirancang agar mudah dijalankan di **Pterodactyl** (Node.js egg).

> Bot ini sebelumnya bernama **Elaina**. Semua default nama, trigger, persona, command, state, dan watermark sudah diganti menjadi **Tsukasa**.

## Fitur Utama

- **Chat AI berkarakter Tsukasa** — Mode `MANUAL` (butuh trigger `tsukasa`) atau `AUTO`. Persona `tsukasa1`/`tsukasa2` bisa diubah per chat (`!tsukasa persona ...`). Mode Pro bisa diaktifkan per chat.
- **Mode Dewasa (owner-only)** — Di chat pribadi, jika owner memulai obrolan hot/flirty, bot otomatis mengikuti (18+, sugestif) selama 30 menit. Kirim `stop` untuk kembali normal.
- **Vision** — Kirim/reply gambar + sebut `tsukasa` untuk dianalisis Gemini.
- **VN → Teks → Auto-reply** — VN langsung akan ditranskrip & dibalas. VN hasil _quote_ hanya diproses jika menyebut `tsukasa`.
- **TTS VN** (`tsukasa vn <teks>`) — Hasilkan voice note via ElevenLabs (bisa pakai konteks balasan).
- **Buat Gambar** (`tsukasa buatin gambar <prompt>`) atau `!gambar <prompt>` — Generate gambar dengan Gemini.
- **Hijabin** (`tsukasa hijabin` / reply gambar) — Tambahkan hijab (JPEG/PNG).
- **Brat & Sticker** — `tsukasa brat <teks>` untuk sticker gaya brat. Sticker biasa dari gambar/URL/video (animated memakai ffmpeg).
- **Blue Archive & Pap** — `ba` / `!ba` atau kata kunci terkait, `!pap` / `pap`.
- **TikTok (multi-API + fallback)** — Kirim link TikTok (vt/vm/m/www) otomatis terunduh (video/slide + audio link). Sumber TikWM otomatis dialihkan ke TikHub/tiktok-api23/Ensig bila kena WAF. Batas ukuran bisa dikonfigurasi.
- **Detector TikTok + Verif ACC** — Pantau video baru dari daftar akun tiap 3 menit, cek hashtag `#margaecn` & CN `ECN`, lalu kirim notifikasi siapa yang UP. Akun bisa dikelola dari WhatsApp (`/addakun`, `/delakun`, `/listakun`, `/detector`). Command verif: `/verif`, `/listverif`, `/unverif`, `/siapaup`, `/cekup`, `/history` (juga bisa `Tsukasa ...` atau `.verif`).
- **AnimeKita** — `!anime ...` (new/movie/schedule/list/genre/search/detail/episode/roulette). Episode dengan link Pixeldrain bisa diunduh otomatis.
- **Anime Roulette** — `!anime roulette [genre]` memilih anime acak dari AniList lengkap dengan sinopsis (diterjemahkan ke Indonesia bila Gemini tersedia), skor, episode, tahun, dan link.
- **Grup Toolkit** — `!ingatkan` (pengingat persisten dengan waktu natural), `!poll` (polling native WhatsApp), `!rangkum` (ringkasan percakapan terakhir via AI), dan `!statistik` (anggota paling aktif, jam tersibuk, jumlah pesan).
- **Auto-post Anime & Info Jejepangan ke Channel** — Bot otomatis mencari info anime terbaru dari **AniList, Kitsu, AnimeKita, dan MyAnimeList (Jikan)**, lalu memposting ke channel WhatsApp (default `NimaCoRe - Latest Info`) lengkap dengan cover, genre, skor, dan link. Hanya anime dengan tahun rilis baru yang lolos (bisa diatur), riwayat dedupe disimpan permanen, dan info budaya/fakta Jejepangan diselipkan tiap beberapa post. Cek/tes manual: `!animechannel status`, `!animechannel test`, `!animechannel info`, `!animechannel check <judul>` (owner/admin grup).
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
| `BOT_TIMEZONE` | `Asia/Jakarta` | Zona waktu tampilan pengingat & statistik |
| `BOT_TZ_OFFSET` | `7` | Offset UTC zona waktu (WIB = 7) untuk parsing "jam 15:30" |
| `SESSION_DIR` | `./session` | Folder auth Baileys (bisa jadi `*_auth` jika diisi nama file) |
| `PAIRING_NUMBER` | - | Nomor WhatsApp bot untuk pairing code, mis. `6281234567890` |
| `STATE_DB` | `./tsukasa_state.json` | State JSON (persona/pro/warn/peraturan) |
| `PORT` / `SERVER_PORT` | `7860` | Port HTTP API. Di Pterodactyl, `SERVER_PORT` otomatis dipakai |
| `HOST` | `0.0.0.0` | Host bind HTTP API |
| `SEND_API_KEY` | - | API key untuk `/send` |
| `SEND_RATE_PER_MIN` | `10` | Rate limit `/send` per IP |
| `GEMINI_API_KEYS` / `GEMINI_API_KEY` | - | API key Gemini (bisa koma) — wajib |
| `GEMINI_TEXT_MODEL` | `gemini-3.5-flash-lite` | Model chat |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | - | Untuk fitur VN TTS |
| `FFMPEG_PATH` | - | Path ffmpeg manual (opsional) |
| `VN_MAX_WORDS` | `80` | Batas kata script VN |
| `TIKTOK_MAX_VIDEO_MB` | `50` | Batas video TikTok (langsung) |
| `TIKTOK_MAX_IMAGE_MB` | `5` | Batas slide image |
| `TIKTOK_MAX_DOC_MB` | `80` | Batas fallback dokumen |
| `TIKTOK_MAX_SLIDES` | `10` | Max slide dikirim |
| `TIKTOK_MONITOR_ENABLED` | `true` | Aktifkan detector video baru |
| `TIKTOK_ACCOUNTS` | `@rinorstr` | Akun TikTok yang dipantau (pisahkan koma) |
| `TIKTOK_CN_KEYWORD` | `ECN` | Keyword CN yang dicari di nickname (Unicode dinormalisasi) |
| `TIKTOK_HASHTAG` | `#margaecn` | Hashtag wajib yang dicek di caption |
| `TIKTOK_CHECK_MIN` | `3` | Interval cek video baru (menit) |
| `TIKTOK_NOTIFY_JID` | - | JID tujuan notifikasi tambahan |
| `TIKTOK_API_URL` | - | Endpoint scraper sendiri dengan placeholder `{username}` & `{count}` (opsional) |
| `TIKTOK_API_KEY` | - | API key untuk `TIKTOK_API_URL` (opsional) |
| `TIKTOK_DL_API_URL` / `TIKTOK_DL_API_KEY` | - | Endpoint download media sendiri, placeholder `{url}` (opsional) |
| `TIKHUB_API_KEY` | - | Key TikHub sebagai sumber cadangan anti-WAF (opsional) |
| `TIKTOK_API23_KEY` / `TIKTOK_API23_HOST` | - | Key & host RapidAPI tiktok-api23 (opsional, fallback `RAPIDAPI_KEY`) |
| `ENSIG_API_URL` / `ENSIG_DL_URL` / `ENSIG_API_KEY` | - | Endpoint gaya Ensig/EnsembleData, placeholder `{username}`, `{count}`, `{url}` (opsional) |
| `TIKTOK_PROXY_URLS` | - | Daftar proxy dipisah koma untuk rotasi request (butuh paket `undici`) |
| `TIKTOK_COOKIE` | - | Cookie browser TikTok opsional untuk mengurangi WAF |
| `TIKTOK_WAF_COOLDOWN_MIN` | `10` | Lama berhenti setelah kena 403/WAF; log peringatan hanya sekali |
| `VERIF_DB` / `HISTORY_UP_DB` / `UP_TODAY_DB` / `SEEN_VIDEOS_DB` | `./database/*.json` | Lokasi database JSON fitur verif & detector |
| `TIKTOK_ACCOUNTS_DB` | `./database/accounts.json` | Daftar akun hasil `/addakun` & `/delakun` |
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
| `ANIME_CHANNEL_MIN_YEAR` | `0` | Filter tahun rilis; `0` = tahun berjalan, `1900` = nonaktif |
| `ANIME_CHANNEL_DEDUPE_DAYS` | `0` | Masa simpan riwayat dedupe; `0` = permanen |
| `ANIME_CHANNEL_DEDUPE_MAX` | `5000` | Batas jumlah entri riwayat dedupe |
| `ANIME_CHANNEL_JAPAN_INFO` | `true` | Selipkan info budaya/fakta Jejepangan |
| `ANIME_CHANNEL_INFO_EVERY` | `3` | Info Jejepangan muncul tiap N post |
| `INFO_FOOTER` | `> yuzaki tsukasa by ren` | Footer output info channel & `!info` |
| `BA_LINKS_LOCAL` / `BA_LINKS_URL` | - | Sumber gambar Blue Archive |
| `PAP_LINKS_PATH` | - | Sumber gambar Pap |
| `PERATURAN_APIKEY` | - | Diperlukan untuk fitur peraturan/moderasi |
| `TSUKASA1_PROMPT` / `TSUKASA2_PROMPT` | - | Override prompt persona |
| `TSUKASA_ADULT_PROMPT` | - | Override overlay mode dewasa owner-only (18+, sugestif) |
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
- Hanya kandidat dengan tahun rilis `>= ANIME_CHANNEL_MIN_YEAR` (default tahun berjalan) yang dipakai. Tahun AnimeKita diambil otomatis dari metadata AniList.
- Judul yang sudah pernah diposting tidak akan diposting ulang. Dedupe memakai id sumber, judul yang dinormalisasi (tahun/season/part dibuang), fingerprint isi pesan, dan disimpan **permanen** (`ANIME_CHANNEL_DEDUPE_DAYS=0`).
- Info budaya/fakta Jejepangan dibuat via Gemini dan diselipkan tiap `ANIME_CHANNEL_INFO_EVERY` post (default tiap 3 post), atau dipaksa dengan `!animechannel info`.
- Cover diunduh dan dikirim bersama caption. Jika media gagal, bot otomatis fallback ke teks, lalu ke raw newsletter bila perlu.
- Batas harian `ANIME_CHANNEL_MAX_PER_DAY` mencegah spam. Post pertama menunggu `ANIME_CHANNEL_START_DELAY_SEC`.
- Caption memakai Bahasa Indonesia dan menyertakan branding channel.

**Format info:**

Template info ada di `src/animeinfo.js` dan dipakai oleh auto-post channel maupun perintah `!info`. Formatnya fleksibel untuk anime, film, drama Jepang/Korea, budaya Jejepangan, fakta unik, info absurd, dan topik lain. Output selalu Bahasa Indonesia dengan footer `> yuzaki tsukasa by ren`.

**Perintah manual (owner / admin grup):**

```text
!animechannel status        # status scheduler, filter tahun, dedupe, jumlah post
!animechannel test          # paksa satu post sekarang (melewati batas harian)
!animechannel info          # paksa post info budaya/fakta Jejepangan
!animechannel check <judul> # cek apakah judul sudah pernah diposting
!info <topik>               # info apa saja (anime, film, Jepang, fakta absurd, dll)
```

## Detector TikTok & Verif ACC

Bot memantau akun di `TIKTOK_ACCOUNTS` (atau daftar hasil command) setiap `TIKTOK_CHECK_MIN` menit. Akun dicek satu per satu dengan jeda acak 2-5 detik. Sumber data memakai rantai fallback anti-WAF: endpoint custom → TikHub → tiktok-api23 → Ensig → TikWM → scraping profil. Kalau semua sumber kena 403/WAF, bot berhenti selama `TIKTOK_WAF_COOLDOWN_MIN` menit dan hanya menulis satu log `[TIKTOK] WAF block, retry 10 menit`. Untuk tiap video baru, bot mengecek:

- Caption mengandung hashtag `TIKTOK_HASHTAG` (default `#margaecn`, case-insensitive).
- Nickname/display name akun mengandung `TIKTOK_CN_KEYWORD` (default `ECN`). Huruf Unicode seperti `𝙀𝘾𝙉`, `〆𝙀𝘾𝙉`, dan `ft 𝙀𝘾𝙉` otomatis dinormalisasi jadi `ECN` sebelum dicocokkan.

Notifikasi otomatis dikirim ke grup yang sudah memverifikasi ACC terkait, dengan format:

```text
🎬 Tsukasa Detector
👤 UP: @rinorstr (Rinor ECN)
ACC: ECN
📌 #margaecn - Ada ✅
📌 CN ECN - Cocok ✅
📝 Caption: ...
🔗 https://www.tiktok.com/@rinorstr/video/...
```

Command verif (bisa ` / `, `.`, `!`, atau diawali `Tsukasa`):

```text
/verif ECN         # verif ACC di grup ini
/veriv ECN         # alias typo
/listverif         # daftar ACC terverif di grup ini
/unverif ECN       # hapus ACC dari grup ini
/siapaup           # 5 video/akun terbaru yang UP hari ini
/whoup             # alias /siapaup
/cekup @rinorstr   # cek akun sudah UP hari ini atau belum
/history           # rekap UP 7 hari terakhir per ACC
```

### Kelola akun pantauan dari WhatsApp

Tanpa edit `.env` dan tanpa restart (owner atau admin grup):

```text
/addakun @username   # tambah akun ke daftar pantauan
/delakun @username   # hapus akun dari daftar pantauan
/listakun            # lihat semua akun + status detector
/detector status     # info detector (CN, hashtag, interval)
/detector on         # aktifkan detector (khusus owner)
/detector off        # matikan detector (khusus owner)
```

Daftar akun disimpan di `database/accounts.json`. Selama file itu belum punya daftar akun, bot memakai `TIKTOK_ACCOUNTS` dari `.env`. Begitu ada `/addakun` atau `/delakun`, daftar di file JSON yang menjadi acuan.

Data verif disimpan di `database/verif.json`, `database/history_up.json`, `database/up_today.json`, `database/seen_videos.json`, dan `database/accounts.json` (bisa dipindah lewat env).

## Grup Toolkit & Anime Roulette

Fitur ini bisa dipakai tanpa trigger (langsung dengan `!`) dan tidak memerlukan Gemini, kecuali `!rangkum` dan terjemahan sinopsis roulette.

### Pengingat

```text
!ingatkan 10m minum air
!ingatkan 1 jam 30 menit rapat
!ingatkan besok 08:00 berangkat kerja
!ingatkan jam 15:30 telepon ibu
!ingatkan list
!ingatkan hapus <id>
```

- Waktu relatif: `10s`, `10m`, `2j`, `1 jam 30 menit`, `2 hari`.
- Waktu absolut memakai `BOT_TIMEZONE`/`BOT_TZ_OFFSET` (default WIB).
- Pengingat disimpan di `tsukasa_state.json` dan tetap ada setelah restart.
- Jika waktu absolut sudah lewat hari ini, pengingat dijadwalkan besok.

### Polling

```text
!poll Makan apa? | Nasi goreng | Mie ayam | Bakso
```

Mengirim poll native WhatsApp (satu pilihan, maksimal 12 opsi). Jika poll gagal dikirim, bot otomatis fallback ke teks bernomor.

### Rangkuman & statistik

```text
!rangkum          # rangkum 40 pesan terakhir
!rangkum 80       # rangkum 80 pesan terakhir (maks 100)
!statistik        # jumlah pesan, anggota aktif, jam tersibuk, top 5
```

- Bot menyimpan **metadata pesan di memori** (maksimal 150 pesan terakhir per chat) untuk fitur ini. Tidak ditulis ke disk dan hilang saat restart.
- `!rangkum` mengirim transkrip ke Gemini; `!statistik` dihitung lokal tanpa AI.
- Gunakan di grup yang memang memperbolehkan bot membaca percakapan.

### Anime Roulette

```text
!anime roulette
!anime roulette romance
!anime roulette komedi
!anime roulette sci-fi
```

Memilih anime acak dari AniList (skor minimal 60), lalu menampilkan judul, studio, genre, tahun, skor, jumlah episode, sinopsis, dan link. Genre Indonesia umum seperti `aksi`, `komedi`, `romansa`, dan `isekai` otomatis dipetakan.

## Mode Dewasa (khusus owner)

Fitur ini **hanya aktif di chat pribadi antara owner dan bot**. Tidak berjalan di grup dan tidak bisa dipakai member lain.

- Jika owner memulai percakapan bernuansa hot/flirty, bot otomatis mengikuti gaya tersebut.
- Mode berlaku 30 menit sejak pemicu terakhir, lalu kembali normal otomatis.
- Kirim `stop` (atau `biasa aja`) untuk langsung kembali normal.
- Kontrol manual: `!hot on|off|status` atau `!tsukasa mode dewasa on|off|status` (owner, chat pribadi).
- Owner dikenali lewat `OWNER_JID`/`OWNER_NUMBER`, termasuk saat chat memakai JID `@lid` (bot mencoba resolve ke nomor telepon otomatis).
- Batas aman: gaya **sugestif/flirty**, bukan adegan eksplisit; menolak konten yang melibatkan anak di bawah umur. Filter bawaan Gemini tetap berlaku.
- Prompt overlay bisa diganti lewat `TSUKASA_ADULT_PROMPT` di `.env`.

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
