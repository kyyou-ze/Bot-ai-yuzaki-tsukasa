# Tsukasa — WhatsApp Assistant

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white">
  <img alt="Baileys" src="https://img.shields.io/badge/Baileys-7.0.0--rc14-25D366?logo=whatsapp&logoColor=white">
  <img alt="Gemini" src="https://img.shields.io/badge/AI-Gemini-4285F4?logo=google&logoColor=white">
  <img alt="Kaguya" src="https://img.shields.io/badge/Plugins-Kaguya%20Bridge-8A2BE2">
  <img alt="Status" src="https://img.shields.io/badge/status-active-brightgreen">
</p>

Asisten WhatsApp berkarakter **Tsukasa**: chat AI berpersona (Gemini), jawab gambar (Vision), transkrip **voice note (VN)** → auto-reply, **downloader TikTok (multi-API anti-WAF)**, **Blue Archive**, **Pap**, **Brat/Sticker**, **TTS VN**, **Image Generation**, **Hijabin**, **AnimeKita**, **Peraturan/Moderation**, **Welcome**, **TagAll**, **RVO**, dan **HTTP API**. Dirancang agar mudah dijalankan di **Pterodactyl** (Node.js egg), dengan **bridge plugin Kaguya** untuk ratusan fitur tambahan (RPG, game, anime, tools, sticker, dan lainnya).


## Fitur Utama

- **Chat AI berkarakter Tsukasa** — Mode `MANUAL` (butuh trigger `tsukasa`) atau `AUTO`. Persona `tsukasa1`/`tsukasa2` bisa diubah per chat (`!tsukasa persona ...`). Mode Pro bisa diaktifkan per chat. Tsukasa hanya bersikap istimewa (romantis/manja) kepada owner; user lain diperlakukan sebagai orang biasa dan dipanggil sesuai nama mereka (nama tersimpan atau pushName WhatsApp), bukan "Kyouu".
- **Gaya chat manusiawi** — Balasan normal dibuat pendek (idealnya di bawah 10 kata per bubble). AI bisa memecah balasannya menjadi beberapa bubble seperti orang chatting dengan menandai jeda memakai `[[next]]` (maksimal 4 bubble), lalu bot mengirimnya berurutan dengan jeda natural. Jawaban panjang hanya muncul saat user meminta detail.
- **Kepribadian lengkap** — Hangat, kalem, perhatian, polos, playful, setia, penyayang, tegas menjaga batas, dan punya sisi manja khusus owner. Tsukasa juga bisa ngambek, cemburu halus, malu, bangga, sedih, kesal, kaget, takut, bingung, prihatin, ngantuk, lelah, dan kangen. Emosinya punya sisa rasa dan tidak selalu langsung pulih.
- **Mode Dewasa (owner-only)** — Di chat pribadi, jika owner memulai obrolan hot/flirty, bot otomatis mengikuti (18+, sugestif) selama 30 menit. Kirim `stop` untuk kembali normal.
- **Emosi otomatis** — Suasana hati berubah dari obrolan dan memudar setelah ±20 menit. Ngambek bisa muncul saat user lama pergi (`≥45 menit`), terkesan cuek, atau membandingkan Tsukasa dengan orang lain. Ngambek yang masih kuat kadang belum reda walau sudah dimaafkan singkat; butuh bujukan yang tulus, tapi tidak pernah kasar atau berlarut-larut. Tidak ada pemberitahuan fitur ke chat.
- **Sadar waktu (publik)** — Tsukasa menyesuaikan diri dengan jam lokal di semua chat: pagi lebih segar, siang/sore lebih santai, malam lebih akrab, dan larut malam mengantuk. Jika diajak begadang sampai malam, keesokan harinya ia bisa mengeluh kurang tidur dan terlihat lelah. Tidak ada notifikasi fitur; ini murni bagian dari perilakunya.
- **Vision** — Kirim/reply gambar + sebut `tsukasa` untuk dianalisis Gemini.
- **VN → Teks → Auto-reply** — VN langsung akan ditranskrip & dibalas. VN hasil _quote_ hanya diproses jika menyebut `tsukasa`.
- **TTS VN** (`tsukasa vn <teks>`) — Hasilkan voice note via ElevenLabs (bisa pakai konteks balasan).
- **Buat Gambar** (`tsukasa buatin gambar <prompt>`) atau `!gambar <prompt>` — Generate gambar dengan Gemini.
- **Hijabin** (`tsukasa hijabin` / reply gambar) — Tambahkan hijab (JPEG/PNG).
- **Brat & Sticker** — `.brat <teks>` atau `tsukasa brat <teks>` untuk sticker gaya brat (tema `green`/`white`/`black`/`pink`/`blue`/`red`). Sticker biasa dari gambar/URL/video (animated memakai ffmpeg).
- **Sticker Pack & Auto Sticker Reply** — Bot punya pack sticker per mood (`lucu`, `sedih`, `marah`, `love`, `ngantuk`, `hai`, `kaget`). Kalau user mengirim sticker, bot kadang membalas sticker random sambil meng-quote pesan tersebut (peluang & cooldown bisa diatur). Kelola pack dari WhatsApp: `.sadd <mood>` (reply sticker), `.srandom <mood>`, `.s lucu`, `.slist`, `.sdel <mood> <nomor>`.
- **Sticker Utility** — `.toimg` (sticker → PNG), `.ttp <teks>` (sticker teks), `.attp <teks>` (sticker teks animasi), `.qc` (quote card dari pesan yang di-reply, tema `light`/`dark`), `.qcimg`/`.qci` (quote card sebagai gambar), `.wm <teks>` (watermark sticker), dan `.stickerinfo` (info format/ukuran/frame).
- **Sticker Transform & Emoji Mix** — `.emojimix 😀 😍` (gabung dua emoji ala Emoji Kitchen), `.flip`/`.flipv`/`.rotate <derajat>`, `.grayscale`/`.invert`/`.blur`, `.crop`, dan `.resize <px>`. Bisa dipakai pada sticker langsung maupun sticker/gambar yang di-reply.
- **AI Tool Calling** — Saat mengobrol, AI bisa memilih aksi sendiri: mengirim sticker sesuai mood, memberi reaksi emoji, membuat gambar, membuat pengingat, atau mencari info terbaru di web. Contoh: AI membalas "wkwk" lalu mengirim sticker `lucu`.
- **Blue Archive & Pap** — `ba` / `!ba` atau kata kunci terkait, `!pap` / `pap`.
- **TikTok (scraper lokal + multi-API)** — Kirim link TikTok (vt/vm/m/www) otomatis terunduh (video/slide + audio link). Scraper lokal membaca halaman embed TikTok langsung dari panel; kalau embed kena WAF, bot otomatis pindah ke Jina Reader, TikWM, TikHub, tiktok-api23, Ensig, lalu Jina HTML sebagai fallback terakhir. Batas ukuran bisa dikonfigurasi.
- **Detector TikTok + Verif ACC** — Pantau video baru dari daftar akun tiap 3 menit, cek hashtag `#margaecn` & CN `ECN`, lalu kirim notifikasi siapa yang UP. Sumber utama scraper lokal (embed) sehingga tidak mudah kena WAF. Akun hasil `/verif` otomatis masuk pantauan; kelola lewat `/addakun`, `/delakun`, `/listakun`, `/detector`. Command verif: `/verif`, `/listverif`, `/unverif`, `/me`, `/siapaup`, `/cekup`, `/history` (tanpa argumen menampilkan semua akun; juga bisa `Tsukasa ...` atau `.verif`).
- **CN TikTok** — `.cn <nama>` menampilkan tiga contoh CN siap pakai dengan nama memakai huruf bold Unicode (tanpa tanda bintang saat disalin): `` `𝙀𝘾𝙉᭄ ``, `ft 𝙀𝘾𝙉`, dan `〆𝙀𝘾𝙉`. Keyword mengikuti `TIKTOK_CN_KEYWORD`.
- **Reply & Tag Status** — Di chat pribadi bot tetap membalas walaupun pesanmu adalah reply/quote. Di grup, reply ke pesan bot juga diproses tanpa trigger. Tag status WhatsApp yang menyebut bot terdeteksi dan dibalas di chat terkait.
- **AnimeKita** — `!anime ...` (new/movie/schedule/list/genre/search/detail/episode/roulette). Episode dengan link Pixeldrain bisa diunduh otomatis.
- **Anime Roulette** — `!anime roulette [genre]` memilih anime acak dari AniList lengkap dengan sinopsis (diterjemahkan ke Indonesia bila Gemini tersedia), skor, episode, tahun, dan link.
- **Grup Toolkit** — `!ingatkan` (pengingat persisten dengan waktu natural), `!poll` (polling native WhatsApp), `!rangkum` (ringkasan percakapan terakhir via AI), `!statistik`, `!topaktif` (leaderboard persisten), serta `.welcome`/`.goodbye` (pesan sambutan & perpisahan per grup, mendukung multi-baris).
- **Auto-post Anime, Berita, Cosplay & Info Jejepangan ke Channel** — Bot otomatis mencari info anime terbaru dari **AniList, Kitsu, AnimeKita, dan MyAnimeList (Jikan)**, berita bergambar dari RSS otaku, serta cosplay Instagram dari `COSPLAY_POSTS`/`COSPLAY_RSS`, lalu memposting ke channel WhatsApp (default `NimaCoRe - Latest Info`) lengkap dengan cover, genre, skor, dan link. Riwayat dedupe disimpan permanen, info budaya/fakta Jejepangan diselipkan tiap beberapa post, dan berita gacha diprioritaskan. Cek/tes manual: `!animechannel status`, `!animechannel test`, `!animechannel news`, `!animechannel cosplay`, `!animechannel info`, `!animechannel check <judul>` (owner/admin grup).
- **Peraturan/Moderasi** — `!peraturan on|off|sync|status|rules|clear @user`. Bot menilai pesan grup dengan Gemini moderation, memberi warn (max 5), bisa mengeluarkan otomatis. Moderasi bawaan juga punya antilink + allowlist domain, antispam, mute sebelum kick, reset warn, log moderasi, dan jadwal buka/tutup (termasuk mode akhir pekan).
- **Health & Rate Limit** — `!health` menampilkan status WhatsApp, uptime, RAM, cache berita, dan antrean unduhan. Command berat (`!news`, `!cosplay`, unduh episode, post channel) dibatasi agar tidak dispam.
- **Pengaturan lewat Chat** — Owner bisa mengisi/mengubah setting penting langsung dari WhatsApp dengan `!config` atau `!set`, tanpa edit `.env` dan tanpa restart. Cocok untuk menambah link cosplay, ganti channel, atur sumber berita, batas warn, rate limit, dan lain-lain.
- **AFK, Ping & TagAll** — `.afk turu` menandai AFK dengan alasan "turu"; bot memberi tahu saat user di-mention/di-reply dan menyambut saat user kembali. `.ping` menampilkan latency, sedangkan `.tagall <pesan>` mention semua anggota dengan pesan kustom (khusus admin grup).
- **Mode balasan per grup** — Admin grup bisa memilih `.modegrup all|reply|call`. Default `call`: bot hanya membalas saat dipanggil `tsukasa`.
- **Kontrol panel dari WhatsApp** — Owner bisa cek status, lihat log, menjalankan `npm install`, cek sintaks, dan restart bot langsung dari chat pribadi dengan `.panel`.
- **Reliability (Tier 5)** — Backup sesi otomatis, reconnect backoff eksponensial, antrean unduhan global, metrik health (`GET /metrics`), notifikasi error ke owner, dan audit command owner (`.backup`, `.audit`).
- **TagAll**, **RVO**, **Welcome**, **Owner features**.
- **HTTP API** — `GET /`, `GET /healthz`, `GET /help`, `POST/GET /send` dengan `X-API-Key` + rate limit.

## Integrasi Plugin Kaguya

Bot ini memakai **arsitektur bridge**: inti bot tetap milik Tsukasa, sedangkan plugin Kaguya dimuat secara *lazy* hanya saat command-nya dipanggil. Semua file sudah dipindah ke dalam repository (tidak membaca folder eksternal), sehingga repo tetap rapi dan mandiri.

- **Lokasi file**: `plugins/<kategori>/<plugin>.js` dan `lib/`.
- **Bridge**: `src/kaguya/index.js` — scanner katalog, lazy import, dispatch, serta formatter menu/help.
- **Katalog dibaca statis** dari source plugin, jadi startup tidak meng-import ribuan file sekaligus.
- **Kategori yang tersedia** antara lain: RPG, game (ceme, poker, ludo, monopoli, ular tangga, UNO, undercover), anime, tools, sticker, canvas, downloader, primbon, quotes, relationship, search, stalker, store, tycoon, dan banyak lagi.
- **Tidak disertakan**: `ai`, `github`, `panel`, `reseller-panel`, `reseller-premku`, `vercel`, `vps`, `pushkontak`, `gacha-nokos`, dan `premium`.

### `.menu` dan `.help`

| Command | Fungsi |
| --- | --- |
| `.menu` | Katalog menu bergaya box Kaguya: ringkasan fitur Tsukasa + kategori plugin Kaguya yang dikelompokkan per tema. |
| `.menu <kategori>` | Lihat command dalam satu kategori (dipaginasi 40 command), mis. `.menu rpg`, `.menu tools`, `.menu sticker`. |
| `.menu <kategori> <halaman>` | Halaman berikutnya, mis. `.menu rpg 2`. |
| `.menu all` | Indeks semua kategori + contoh command. Tidak lagi menumpahkan seluruh command ke satu pesan. |
| `.menu cari <kata>` | Cari command berdasarkan nama atau deskripsi, mis. `.menu cari anime`. |
| `.help` | Panduan singkat penggunaan menu dan command. |
| `.help <command>` | Cara pakai command tertentu, mis. `.help sticker`, `.help animedl`. |
| `.help <kategori>` | Daftar command + deskripsi dalam kategori tersebut. |

Catatan:
- Kategori Kaguya dikelompokkan menjadi **RPG & Game**, **Anime & Fandom**, **Tools & Download**, **Sosial & Komunitas**, dan **Lainnya** agar menu tidak terasa seperti folder plugin mentah.
- Command plugin bisa dipakai dengan prefix `.`, `!`, `/`, atau trigger `tsukasa`.
- Fitur grup yang dimatikan lewat `.fitur off` otomatis hilang dari katalog `.menu` dan `.help`.
- Database plugin memakai JSON (`global.dbEngine = 'json'`) agar tidak wajib compile SQLite native.
- Registrasi Kaguya dimatikan; plugin langsung bisa dipakai tanpa `.daftar`.

## Struktur Proyek

```
.
├── index.js              # entry point bot Tsukasa
├── src/                  # inti bot (router, AI, fitur, bridge Kaguya)
│   └── kaguya/index.js   # bridge plugin Kaguya (lazy load + menu/help)
├── lib/                  # library & engine plugin Kaguya (ESM)
├── plugins/              # plugin Kaguya per kategori (ESM)
├── database/             # database runtime (JSON)
└── README.md
```

`plugins/package.json` dan `lib/package.json` menandai folder tersebut sebagai ESM (`"type": "module"`), sementara root repo tetap CommonJS.

## Persyaratan

- Node.js **>= 22** (disarankan Node 22 LTS)
- npm **>= 11**
- Akun Google Gemini (API key) — **wajib** untuk fitur AI
- Akun WhatsApp untuk pairing (QR atau pairing code)
- `ffmpeg` **tidak wajib**: bot memakai `ffmpeg-static` dari npm. Jika ingin ffmpeg sistem, set `FFMPEG_PATH`.
- Beberapa plugin Kaguya memakai dependency berat seperti `@napi-rs/canvas`, `sharp`, `puppeteer`, dan `jsdom`. Pastikan RAM panel cukup (disarankan minimal 1 GB).

## Instalasi Lokal

```bash
git clone <repo>
cd Bot-ai-yuzaki-tsukasa
cp .env.example .env
# Edit .env sesuai kebutuhan
npm install
npm start
```

Scan QR / masukkan pairing code yang muncul untuk menghubungkan WhatsApp.

> `npm install` akan memasang dependency inti Tsukasa sekaligus dependency plugin Kaguya. Jika panel tidak membutuhkan fitur berat (canvas/puppeteer), dependency tersebut tetap aman tidak dipakai sampai command terkait dijalankan.

## Konfigurasi (.env)

Lihat `.env.example` untuk daftar lengkap. Variabel penting:

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `MODE` | `MANUAL` | `MANUAL` (butuh trigger) / `AUTO` |
| `ENV_SYNC_ENABLED` | `true` | Tambahkan variabel baru dari `.env.example` ke `.env` saat start (nilai lama tidak ditimpa) |
| `TRIGGER` | `tsukasa` | Kata pemicu |
| `BOT_NAME` | `Tsukasa` | Nama bot |
| `BOT_TIMEZONE` | `Asia/Jakarta` | Zona waktu pengingat, notifikasi admin, jadwal, dan statistik (offset dihitung otomatis) |
| `BOT_TZ_OFFSET` | otomatis dari `BOT_TIMEZONE` | Override manual offset UTC (WIB = 7, WITA = 8, WIT = 9) |
| `SESSION_DIR` | `./session` | Folder auth Baileys (bisa jadi `*_auth` jika diisi nama file) |
| `PAIRING_NUMBER` | - | Nomor WhatsApp bot untuk pairing code, mis. `6281234567890` |
| `STATE_DB` | `./tsukasa_state.json` | State JSON (persona/pro/warn/peraturan) |
| `LID_MAP_FILE` | `./data/lidmap.json` | Pemetaan LID → nomor telepon agar balasan chat pribadi terkirim |
| `SETTINGS_DB` | `./database/settings.json` | Override pengaturan yang diisi lewat chat (`!config`) |
| `AUTO_UPDATE_ENABLED` | `false` | Aktifkan cek & tarik update GitHub otomatis |
| `AUTO_UPDATE_CHECK_MIN` | `10` | Interval cek update (menit) |
| `PTERO_URL` / `PTERO_CLIENT_KEY` / `PTERO_SERVER_ID` | - | Client API panel untuk restart otomatis |
| `AUTO_UPDATE_RESTART_MODE` | `api` | `api`, `exit`, atau `none` |
| `PANEL_DISABLED` | `false` | `true` = matikan semua perintah `.panel` dari WhatsApp |
| `PORT` / `SERVER_PORT` | `7860` | Port HTTP API. Di Pterodactyl, `SERVER_PORT` otomatis dipakai |
| `HOST` | `0.0.0.0` | Host bind HTTP API |
| `SEND_API_KEY` | - | API key untuk `/send` |
| `SEND_RATE_PER_MIN` | `10` | Rate limit `/send` per IP |
| `GEMINI_API_KEYS` / `GEMINI_API_KEY` | - | API key Gemini (bisa koma) — wajib |
| `GEMINI_TEXT_MODEL` | `gemini-3.5-flash-lite` | Model chat |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | - | Untuk fitur VN TTS |
| `FFMPEG_PATH` | - | Path ffmpeg manual (opsional) |
| `VN_MAX_WORDS` | `80` | Batas kata script VN |
| `STICKER_REPLY_ENABLED` | `true` | Aktifkan auto balas sticker |
| `STICKER_REPLY_CHANCE` | `30` | Peluang auto balas sticker (%) |
| `STICKER_REPLY_COOLDOWN_SEC` | `90` | Cooldown auto sticker per chat (detik) |
| `STICKER_DIR` | `assets/stickers` | Folder pack sticker (subfolder = mood) |
| `AI_TOOLS_ENABLED` | `true` | Aktifkan AI memilih aksi sendiri |
| `AI_TOOLS_MAX_ACTIONS` | `2` | Maksimal aksi AI per balasan (1-5) |
| `AI_TOOLS_IMAGE` | `true` | Izinkan AI membuat gambar |
| `AI_TOOLS_SEARCH` | `true` | Izinkan AI mencari info di web |
| `TIKTOK_MAX_VIDEO_MB` | `50` | Batas video TikTok (langsung) |
| `TIKTOK_MAX_IMAGE_MB` | `5` | Batas slide image |
| `TIKTOK_MAX_DOC_MB` | `80` | Batas fallback dokumen |
| `TIKTOK_MAX_SLIDES` | `10` | Max slide dikirim |
| `TIKTOK_MONITOR_ENABLED` | `true` | Aktifkan detector video baru |
| `TIKTOK_ACCOUNTS` | `@rinorstr` | Akun TikTok yang dipantau (pisahkan koma) |
| `TIKTOK_CN_KEYWORD` | `ECN` | Keyword CN yang dicari di nickname (Unicode dinormalisasi) |
| `TIKTOK_HASHTAG` | `#margaecn` | Hashtag wajib yang dicek di caption |
| `TIKTOK_CHECK_MIN` | `3` | Interval cek video baru (menit) |
| `TIKTOK_NOTIFY_JID` | - | JID grup tujuan notifikasi tambahan (bisa diubah dari WhatsApp lewat `/detector setgc`) |
| `TIKTOK_API_URL` | - | Endpoint scraper sendiri dengan placeholder `{username}` & `{count}` (opsional) |
| `TIKTOK_API_KEY` | - | API key untuk `TIKTOK_API_URL` (opsional) |
| `TIKTOK_SCRAPER_MODE` | `auto` | `auto` = scraper lokal dulu lalu fallback; `local` = hanya lokal; `api` = hanya API/Jina |
| `TIKTOK_LOCAL_ENABLED` | `true` | Aktifkan scraper TikTok lokal (embed creator, tanpa WAF/API key) |
| `TIKTOK_LOCAL_TIMEOUT_SEC` | `30` | Timeout request scraper lokal (detik) |
| `TIKTOK_EMBED_HOSTS` | `https://www.tiktok.com,https://m.tiktok.com` | Host embed yang dicoba bergantian saat salah satu kena WAF/DNS |
| `TIKTOK_DL_API_URL` / `TIKTOK_DL_API_KEY` | - | Endpoint download media sendiri, placeholder `{url}` (opsional) |
| `TIKHUB_API_KEY` | - | Key TikHub sebagai sumber cadangan anti-WAF (opsional) |
| `TIKTOK_API23_KEY` / `TIKTOK_API23_HOST` | - | Key & host RapidAPI tiktok-api23 (opsional, fallback `RAPIDAPI_KEY`) |
| `ENSIG_API_URL` / `ENSIG_DL_URL` / `ENSIG_API_KEY` | - | Endpoint gaya Ensig/EnsembleData, placeholder `{username}`, `{count}`, `{url}` (opsional) |
| `TIKTOK_PROXY_URLS` | - | Daftar proxy dipisah koma untuk rotasi request (butuh paket `undici`) |
| `TIKTOK_COOKIE` | - | Cookie browser TikTok opsional untuk mengurangi WAF |
| `TIKTOK_JINA_KEY` / `JINA_API_KEY` | - | Key Jina Reader opsional; tanpa key tetap jalan dengan rate limit lebih kecil |
| `TIKTOK_JINA_BASE` | `https://r.jina.ai/` | Base URL Jina Reader untuk membaca profil TikTok |
| `TIKTOK_JINA_ENABLED` | `true` | Aktifkan fallback Jina HTML saat download video kena WAF |
| `TIKTOK_WAF_COOLDOWN_MIN` | `10` | Lama berhenti setelah kena 403/WAF; log peringatan hanya sekali |
| `TIKTOK_DATA_DIR` | `./data/tiktok` | Folder data runtime TikTok (verif, riwayat UP, cache video, akun) |
| `VERIF_DB` / `HISTORY_UP_DB` / `UP_TODAY_DB` / `SEEN_VIDEOS_DB` | `<TIKTOK_DATA_DIR>/*.json` | Override path database JSON fitur verif & detector |
| `TIKTOK_ACCOUNTS_DB` | `<TIKTOK_DATA_DIR>/accounts.json` | Daftar akun hasil `/addakun` & `/delakun` |
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
| `ANIME_CHANNEL_NEWS_EVERY` | `2` | Selipkan berita bergambar tiap N post channel; `0` = nonaktif |
| `ANIME_CHANNEL_COSPLAY_EVERY` | `4` | Selipkan post cosplay tiap N post channel; `0` = nonaktif |
| `COSPLAY_ENABLED` | `true` | Aktifkan auto-post cosplay dari Instagram |
| `COSPLAY_POSTS` | - | Daftar URL post Instagram untuk auto-cosplay (pisahkan koma) |
| `COSPLAY_RSS` | - | RSS yang berisi tautan Instagram cosplay (pisahkan koma, opsional) |
| `NEWS_ENABLED` | `true` | Aktifkan fitur `!news` dan berita di channel |
| `NEWS_SOURCES` | `ann,animecorner,gematsu,siliconera` | Sumber RSS berita |
| `NEWS_X_RSS` | - | RSS tambahan untuk sumber X/Twitter (pisahkan koma, opsional) |
| `NEWS_PER_SOURCE` | `8` | Kandidat berita per sumber |
| `NEWS_ITEMS` | `2` | Jumlah berita yang dikirim per `!news` |
| `NEWS_GACHA_EVERY` | `2` | Setiap N berita, prioritaskan berita gacha; `0` = nonaktif |
| `NEWS_CACHE_MIN` | `10` | Cache RSS berita (menit) agar `!news` tidak menembak feed terus |
| `NEWS_REPOST_TTL_MIN` | `720` | Anti-repost berita per chat (menit) |
| `MOD_LOG_JID` | - | JID tujuan log moderasi (default owner) |
| `MOD_WARN_LIMIT` | `5` | Jumlah peringatan sebelum kick |
| `MOD_MUTE_MINUTES` | `10` | Durasi mute sebelum kick (menit) |
| `RATE_NEWS_SEC` | `15` | Jeda minimal `!news`/`!cosplay` per chat |
| `RATE_DOWNLOAD_SEC` | `30` | Jeda minimal command unduh episode per chat |
| `RATE_CHANNEL_SEC` | `30` | Jeda minimal post manual ke channel per chat |
| `ANIME_EP_MAX_MB` | `190` | Batas ukuran episode yang diunduh otomatis |
| `ANIME_EP_TIMEOUT_SEC` | `240` | Timeout unduh episode (detik) |
| `ANIME_DL_CONCURRENCY` | `1` | Jumlah unduhan episode paralel |
| `INFO_FOOTER` | `> yuzaki tsukasa by ren` | Footer output info channel & `!info` |
| `LOG_LEVEL` | `info` | Level minimum yang tampil di panel (`debug`/`info`/`warn`/`error`) |
| `LOG_DB_LEVEL` | `warn` | Level minimum yang disimpan ke database log (bug/error) |
| `LOG_DB` | `./database/logs.json` | Lokasi database log JSON; isi `off` untuk menonaktifkan |
| `LOG_DB_MAX` | `1000` | Jumlah entri log maksimum yang disimpan |
| `LOG_CONSOLE` | `true` | `false` = matikan output panel (database tetap menulis) |
| `LOG_STACK` | `false` | `true` = tampilkan stack trace di panel |
| `BAILEYS_LOG` | `error` | Level log internal Baileys/pino (`error`/`warn`/`info`/`debug`) |
| `BA_LINKS_LOCAL` / `BA_LINKS_URL` | - | Sumber gambar Blue Archive |
| `PAP_LINKS_PATH` | - | Sumber gambar Pap |
| `PERATURAN_APIKEY` | - | Diperlukan untuk fitur peraturan/moderasi |
| `TSUKASA1_PROMPT` / `TSUKASA2_PROMPT` | - | Override prompt persona |
| `TSUKASA_ADULT_PROMPT` | - | Override overlay mode dewasa owner-only (18+, sugestif) |
| `HIJABIN_API_URL` / `HIJABIN_API_KEY` | - | Opsional untuk hijabin via API eksternal |
| `OWNER_*` | - | Konfigurasi owner |
| `WELCOME_ENABLED` / `WELCOME_TEXT` / `GOODBYE_ENABLED` / `GOODBYE_TEXT` / `GREETING_ENABLED` | - | Pesan sambutan & perpisahan grup (bisa dioverride per grup lewat `.welcome`/`.goodbye`) |
| `IG_COOKIE` / `IG_SESSIONID` / `IG_PROXY` / `IG_MAX_IMAGES` | - | Scraper Instagram hybrid: cookie akun bot, proxy residensial opsional, batas foto carousel |

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
!animechannel news          # paksa post berita bergambar
!animechannel cosplay       # paksa post cosplay dari COSPLAY_POSTS/COSPLAY_RSS
!animechannel check <judul> # cek apakah judul sudah pernah diposting
!info <topik>               # info apa saja (anime, film, Jepang, fakta absurd, dll)
!health                     # status koneksi, uptime, RAM, cache, antrean unduhan
!config                     # ringkasan semua pengaturan yang bisa diubah lewat chat
```

## Pengaturan lewat Chat (owner)

Semua setting penting bisa diisi dari WhatsApp. Nilai yang diubah lewat chat disimpan di `SETTINGS_DB` (default `database/settings.json`), menimpa `.env`, dan langsung berlaku tanpa restart.

```text
!config                          # ringkasan grup setting
!config list                     # semua key + nilai + sumber (chat/env/default)
!config list cosplay             # hanya grup tertentu
!config get COSPLAY_POSTS        # lihat satu setting
!config set KEY NILAI            # ubah nilai
!config add KEY NILAI            # tambah item ke daftar
!config del KEY NILAI            # hapus item dari daftar
!config reset KEY                # kembali ke nilai .env/default
!config help                     # contoh lengkap
```

Bentuk singkat `!set KEY NILAI` sama dengan `!config set KEY NILAI`.

Contoh yang sering dipakai:

```text
# Cosplay
!config add COSPLAY_POSTS https://www.instagram.com/p/DePI-QHlEhR/
!config del COSPLAY_POSTS https://www.instagram.com/p/DePI-QHlEhR/
!config set COSPLAY_ENABLED on
!config set ANIME_CHANNEL_COSPLAY_EVERY 4

# Berita
!config set NEWS_ENABLED on
!config add NEWS_SOURCES gematsu
!config del NEWS_SOURCES siliconera
!config add NEWS_X_RSS https://rss.app/feeds/xxxx.xml
!config set NEWS_ITEMS 3
!config set NEWS_GACHA_EVERY 2

# Channel tujuan
!config set ANIME_CHANNEL_INVITE https://whatsapp.com/channel/xxxx
!config set ANIME_CHANNEL_JID 1234567890@newsletter
!config set ANIME_CHANNEL_INTERVAL_MIN 180
!config set ANIME_CHANNEL_MAX_PER_DAY 8

# Moderasi & rate limit
!config set MOD_WARN_LIMIT 5
!config set MOD_MUTE_MINUTES 10
!config set MOD_LOG_JID 6281234567890
!config set RATE_NEWS_SEC 15
!config set RATE_DOWNLOAD_SEC 30

# Unduhan & detector
!config set ANIME_DL_CONCURRENCY 1
!config set ANIME_EP_MAX_MB 190
!config set TIKTOK_MONITOR_ENABLED on
!config set TIKTOK_CHECK_MIN 3
```

Grup setting yang tersedia: `cosplay`, `news`, `channel`, `moderation`, `rate`, `anime`, `tiktok`, `update`. Gunakan `!config list` untuk melihat key lengkapnya.

Catatan:
- Perintah ini **khusus owner**. Admin grup tetap memakai perintah grup seperti `!antilink`, `!antispam`, `!jadwal`, `!mute`, dan `!resetwarn`.
- Nilai dari chat disimpan terpisah dari `.env`. Jika ingin kembali ke isi `.env`, gunakan `!config reset KEY`.
- Mengubah `ANIME_CHANNEL_ENABLED`, `ANIME_CHANNEL_INTERVAL_MIN`, `ANIME_CHANNEL_JID`, `TIKTOK_MONITOR_ENABLED`, dan `TIKTOK_CHECK_MIN` langsung diterapkan ke scheduler yang sedang berjalan.

## Auto-update GitHub ke Pterodactyl

Bot bisa mengecek commit baru di GitHub, menariknya dengan `git pull`, lalu me-restart server lewat **Pterodactyl Client API**. Ini bekerja tanpa akses admin panel, cukup akun server yang kamu sewa.

**Syarat:** folder server harus clone git dari repo ini, bukan hasil upload ZIP. Cek di panel/console:

```bash
git remote -v
git log --oneline -1
```

Kalau `.git` tidak ada, minta pemilik panel clone ulang repo ke folder server.

**Setup sekali saja:**

1. Di panel, buka **Account Settings → API Credentials**, buat client API key (`ptlc_...`).
2. Catat **URL panel** dan **ID server** (8 karakter dari URL `/server/xxxxxxxx`).
3. Isi lewat chat (owner) atau `.env`:

```text
!config set PTERO_URL https://panel.domain.com
!config set PTERO_CLIENT_KEY ptlc_xxxxxxxx
!config set PTERO_SERVER_ID xxxxxxxx
!config set AUTO_UPDATE_ENABLED on
!config set AUTO_UPDATE_CHECK_MIN 5
```

Atau di `.env`:

```env
AUTO_UPDATE_ENABLED=true
AUTO_UPDATE_CHECK_MIN=5
UPDATE_BRANCH=main
UPDATE_REMOTE=origin
GITHUB_USER=kyyou-ze
GITHUB_REPO=Bot-ai-yuzaki-tsukasa
PTERO_URL=https://panel.domain.com
PTERO_CLIENT_KEY=ptlc_xxxxxxxx
PTERO_SERVER_ID=xxxxxxxx
AUTO_UPDATE_RESTART_MODE=api
```

**Perintah owner:**

```text
!update status      # status repo, jadwal, dan kesiapan panel
!update check       # cek commit baru tanpa menarik
!update now         # tarik update + restart panel
!update auto on|off # aktif/nonaktif cek otomatis
!update interval 5  # cek tiap 5 menit
!update mode api|exit|none
```

Cara kerja:

- Setiap `AUTO_UPDATE_CHECK_MIN` menit bot menjalankan `git fetch` dan membandingkan commit.
- Jika ada commit baru, bot hanya mem-stash file yang benar-benar diubah commit baru, lalu `git merge --ff-only`. File runtime yang tidak ikut terupdate dibiarkan di tempat.
- Jika `package.json`/`package-lock.json` berubah, bot menjalankan `npm install --omit=dev`.
- Bot menjalankan `npm run check`; kalau sintaks rusak, update **dibatalkan dan di-rollback**.
- Setelah sukses, bot memanggil `POST /api/client/servers/{id}/power` dengan signal `restart`.
- Semua langkah dikirim ke owner lewat WhatsApp.

Mode restart:

- `api` — restart lewat Pterodactyl Client API (disarankan).
- `exit` — bot keluar dengan kode 1; berguna jika panel dikonfigurasi auto-restart saat crash.
- `none` — kode ditarik, tetapi restart manual lewat panel.

Catatan penting:

- Tanpa client API key, kode tetap bisa ditarik otomatis, tetapi bot tidak bisa restart sendiri. Restart manual lewat panel agar kode baru dipakai.
- Interval minimal 1 menit. Ini polling, bukan webhook instan, karena mengubah egg/startup command butuh akses admin panel.
- `.env`, `session/`, `data/`, `database/`, dan state runtime tidak ikut terhapus karena diabaikan git dan tidak di-stash sembarangan.
- Saat start/restart, `.env` disinkronkan otomatis dengan `.env.example`: variabel baru yang belum ada di `.env` ditambahkan dengan nilai default, sedangkan nilai yang sudah kamu isi tidak pernah ditimpa. Matikan dengan `ENV_SYNC_ENABLED=false`.
- Data akun/verif/riwayat TikTok disimpan di `data/tiktok/`. Data lama dari `database/*.json` dimigrasikan otomatis sekali saat bot pertama dijalankan setelah update. Updater hanya mem-stash file yang benar-benar diubah commit baru, jadi data runtime tidak tertinggal di stash saat restart.
- Jika repo privat, isi `GITHUB_TOKEN` (read-only cukup) agar `git fetch` diizinkan.

## Kontrol Panel dari WhatsApp

Owner bisa mengelola server/panel langsung dari **chat pribadi** tanpa membuka Pterodactyl. Semua aksi hanya berjalan untuk owner, dan perintah ditolak di grup agar output server tidak bocor ke member.

```text
.panel status          # status bot, RAM, Node/NPM, repo, dan kesiapan restart
.panel logs 20         # 20 log terakhir (default 20, maks 40)
.panel logs 30 error   # filter level: debug|info|warn|error
.panel install         # npm install --omit=dev
.panel check           # npm run check (validasi sintaks)
.panel run check       # jalankan script package.json lain (kecuali start)
.panel npm run check   # bentuk npm langsung
.panel restart         # restart lewat Pterodactyl Client API
.panel start           # alias restart
.panel restart force   # keluar paksa; panel harus auto-restart saat crash
```

Catatan:

- `panel restart` memakai konfigurasi `PTERO_*` yang sama dengan `.update`. Jika belum diisi, bot menolak dan menyarankan `panel restart force`.
- `panel restart force` **mematikan bot**. Gunakan hanya jika egg/panel dikonfigurasi auto-restart; kalau tidak, nyalakan manual dari panel.
- `panel run start` sengaja diblokir karena akan membuat instance bot kedua. Gunakan `panel restart`.
- Aksi `install`/`check`/`run` dibatasi timeout dan output maksimal 3.000 karakter terakhir agar chat tidak dibanjiri.
- Tidak ada shell bebas (`panel exec ...`). Hanya aksi whitelist di atas yang tersedia.
- Set `PANEL_DISABLED=true` untuk mematikan seluruh kontrol panel dari chat.

## Berita Anime, Gacha & Carousel Instagram

Perintah berita mengambil RSS dari Anime News Network, Anime Corner, Gematsu, dan Siliconera. Berita tanpa gambar akan dicoba dilengkapi lewat `og:image` artikel; kalau tetap tidak ada gambar, berita itu dilewati supaya setiap post selalu bergambar. Tautan X/Twitter yang disebut di artikel ikut ditampilkan. RSS di-cache `NEWS_CACHE_MIN` menit, dan setiap chat punya anti-repost sendiri (`NEWS_REPOST_TTL_MIN`) supaya `!news` berulang tidak mengirim berita yang sama. Berita gacha diprioritaskan tiap `NEWS_GACHA_EVERY` panggilan.

```text
!news                 # 2 berita terbaru + gambar
!news gacha           # khusus update gacha (Azur Lane, Nikke, Genshin, dll)
!news manga           # berita manga/manhwa
!cosplay <link IG>    # ambil semua foto dari satu post Instagram
```

`!cosplay` memakai Jina Reader (tanpa login Instagram) dan mendukung carousel 2+ foto. Caption mengikuti format:

```text
*Name Karakter* *『Sandrone』*
*Name Anime/Game* ```|Genshin Impact|```
*SC:https://www.instagram.com/p/xxxx/*
```

Nama karakter dan anime ditebak dari hashtag/caption. Untuk override, tambahkan opsi:

```text
!cosplay https://www.instagram.com/p/xxxx/ --karakter Furina --anime "Genshin Impact"
```

Auto-post channel juga menyelipkan berita bergambar tiap `ANIME_CHANNEL_NEWS_EVERY` post. Paksa manual dengan `!animechannel news`.

### Auto-post Cosplay

Isi `COSPLAY_POSTS` dengan satu atau beberapa URL post Instagram (pisahkan koma):

```env
COSPLAY_POSTS=https://www.instagram.com/p/xxxx/,https://www.instagram.com/p/yyyy/
COSPLAY_RSS=https://contoh.com/rss-cosplay
ANIME_CHANNEL_COSPLAY_EVERY=4
```

Bot akan memilih post yang belum pernah dikirim, mengambil **semua foto carousel**, lalu mengirimkannya ke channel dengan caption format yang sama seperti `!cosplay`. Paksa manual dengan `!animechannel cosplay`. Gambar divalidasi magic-byte dan otomatis dikompres bila `sharp` tersedia.

Daftar cosplay juga bisa diisi langsung dari chat (owner), tanpa edit `.env`:

```text
!cosplay add https://www.instagram.com/p/xxxx/
!cosplay del https://www.instagram.com/p/xxxx/
!cosplay list
!cosplay on|off
!cosplay every 4
```

## Unduh Episode Anime

`!anime episode <slug> [reso]` menampilkan link streaming sekaligus mencoba mengunduh episode secara otomatis. Mirror langsung (mp4) diprioritaskan, lalu Pixeldrain sebagai cadangan. Kalau resolusi yang diminta terlalu besar, bot mencoba resolusi lebih rendah. Batas ukuran diatur lewat `ANIME_EP_MAX_MB` (default 190 MB) dan timeout lewat `ANIME_EP_TIMEOUT_SEC`.

```text
!anime download <slug> 720p   # langsung unduh episode
!anime queue                  # status antrean unduhan
```

Unduhan masuk antrean dengan paralel default 1 (`ANIME_DL_CONCURRENCY`) dan permintaan episode yang sama tidak diduplikasi. Jika semua mirror gagal, bot mengirim alasan kegagalan beserta link yang bisa dibuka manual.

## Sticker Pack & Sticker Utility

Bot menyimpan sticker di `STICKER_DIR` (default `assets/stickers`). Setiap subfolder adalah satu mood/pack:

```text
assets/stickers/
  lucu/*.webp
  sedih/*.webp
  marah/*.webp
  love/*.webp
```

Command dari WhatsApp:

```text
.slist                  # daftar pack + jumlah sticker
.sadd lucu              # reply sticker lalu simpan ke pack lucu
.srandom lucu           # kirim sticker random dari pack lucu
.srandom                # kirim sticker random dari pack mana pun
.s lucu                 # alias cepat .srandom lucu
.sdel lucu 2            # hapus sticker nomor 2 dari pack lucu
```

Utility sticker (bisa direct atau reply):

```text
.toimg                  # sticker jadi gambar PNG (animasi = frame pertama)
.ttp Halo dunia         # sticker teks statis
.attp Halo dunia        # sticker teks animasi
.qc                     # quote card dari pesan yang di-reply
.qc Teks bebas          # quote card dengan teks sendiri
.qc light               # quote card tema terang (dark = gelap)
.qcimg / .qci           # quote card dikirim sebagai gambar PNG
.brat halo              # sticker brat hijau khas Charli XCX
.brat white halo        # tema: green/white/black/pink/blue/red
.brat --blur 1.2 halo   # blur halus (0 = tanpa blur)
.wm @Tsukasa            # watermark sticker (reply sticker)
.stickerinfo            # info format, ukuran, jumlah frame, size
```

Transformasi sticker (bisa direct atau reply):

```text
.emojimix 😀 😍         # gabung dua emoji jadi sticker
.flip                   # cermin horizontal (alias .mirror)
.flipv                  # cermin vertikal
.rotate 90              # putar sticker (default 90°)
.grayscale              # hitam-putih (alias .gray / .bw)
.invert                 # balik warna (alias .negate)
.blur 8                 # blur (sigma default 8)
.crop                   # potong tengah jadi persegi
.resize 320             # perkecil sticker (alias .small)
```

Sticker animasi tetap animasi untuk transformasi yang didukung. Rotasi dengan sudut bukan kelipatan 90° pada sticker animasi otomatis memakai frame pertama.

Saat user mengirim sticker, bot bisa otomatis membalas dengan sticker random sambil meng-quote sticker tersebut. Atur perilakunya di `.env`:

```env
STICKER_REPLY_ENABLED=true
STICKER_REPLY_CHANCE=30
STICKER_REPLY_COOLDOWN_SEC=90
STICKER_DIR=assets/stickers
```

Auto-reply hanya berjalan untuk pesan sticker (bukan teks biasa), tidak membalas pesan bot sendiri, dan dibatasi cooldown per chat supaya tidak spam.

## AI Tool Calling (Tier 2)

Saat chat AI berjalan, model tidak hanya membalas teks. Bot menyisipkan daftar tool ke system prompt, lalu model boleh menutup balasannya dengan tag aksi. Tag tersebut dibuang sebelum pesan dikirim dan sebelum disimpan ke memori, jadi user tidak pernah melihatnya.

| Aksi | Contoh tag | Perilaku |
|---|---|---|
| Kirim sticker | `[[sticker:lucu]]` | Kirim sticker random dari pack mood terkait. Mood tak dikenal → pack acak. |
| Reaksi | `[[react:😆]]` | Beri reaksi emoji ke pesan user. |
| Gambar AI | `[[image:kucing oren pakai topi]]` | Hanya dijalankan jika user memang meminta gambar/foto/ilustrasi. |
| Pengingat | `[[remind:10m minum air]]` | Hanya dijalankan jika user meminta diingatkan dan format waktunya valid. |
| Cari web | `[[search:hasil pertandingan hari ini]]` | Dua fase: bot mencari lewat DuckDuckGo (fallback Wikipedia), lalu memanggil model sekali lagi untuk menjawab memakai hasilnya. |

Batasan pengaman:

- Maksimal `AI_TOOLS_MAX_ACTIONS` aksi per balasan (default 2) dan satu aksi per jenis.
- Gambar hanya dibuat bila ada kata pemicu seperti "gambar", "foto", "ilustrasi", "wallpaper".
- Pengingat hanya dibuat bila ada kata "ingat/ingatkan/remind" dan waktu yang dikenali.
- Pencarian dibatasi 200 karakter query dan hasilnya dipotong agar prompt tetap ringkas.
- Jika ragu, model diminta tidak memakai aksi sama sekali.

```env
AI_TOOLS_ENABLED=true
AI_TOOLS_MAX_ACTIONS=2
AI_TOOLS_IMAGE=true
AI_TOOLS_SEARCH=true
```

## Detector TikTok & Verif ACC

Bot memantau akun di `TIKTOK_ACCOUNTS` (atau daftar hasil command) setiap `TIKTOK_CHECK_MIN` menit. Akun dicek satu per satu dengan jeda acak 2-5 detik.

**Scraper lokal (utama).** Bot membaca `https://www.tiktok.com/embed/@username` langsung dari server panel. Halaman embed ini di-render oleh TikTok dan berisi JSON lengkap (nickname, bio, caption, cover, URL video), jadi **lebih jarang terkena WAF** daripada halaman profil biasa, tanpa API key dan tanpa signature. Ini membuat detector tetap jalan walau halaman profil biasa diblokir. Kalau `www.tiktok.com` sedang kena WAF/DNS dari IP panel, bot otomatis mencoba host cadangan `m.tiktok.com` (atur urutannya lewat `TIKTOK_EMBED_HOSTS`) sebelum pindah ke sumber lain. Atur lewat `TIKTOK_SCRAPER_MODE`:

- `auto` (default): scraper lokal dulu; kalau gagal, lanjut ke API/Jina yang dikonfigurasi.
- `local`: hanya scraper lokal (paling hemat kuota). Kalau embed benar-benar diblokir WAF, bot tetap memakai Jina sebagai cadangan darurat agar detector tidak mati.
- `api`: lewati scraper lokal dan pakai rantai API/Jina seperti konfigurasi lama.

Cadangan bila scraper lokal gagal: endpoint custom/TikHub/tiktok-api23/Ensig (kalau diisi) → Jina Reader (markdown) → Jina HTML (embed) → TikWM → scraping profil langsung. Kalau semua sumber kena 403/WAF, bot berhenti selama `TIKTOK_WAF_COOLDOWN_MIN` menit dan hanya menulis satu log `[TIKTOK] WAF block, retry 10 menit`. Untuk tiap video baru, bot mengecek:

- Caption mengandung hashtag `TIKTOK_HASHTAG` (default `#margaecn`, case-insensitive).
- Nickname/display name akun mengandung `TIKTOK_CN_KEYWORD` (default `ECN`). Huruf Unicode seperti `𝙀𝘾𝙉`, `〆𝙀𝘾𝙉`, dan `ft 𝙀𝘾𝙉` otomatis dinormalisasi jadi `ECN` sebelum dicocokkan.

Notifikasi otomatis dikirim **hanya ke grup** yang sudah memverifikasi ACC terkait (plus grup tambahan dari `TIKTOK_NOTIFY_JID`/`/detector setgc`). Bot mencoba mengirim cover video sebagai gambar preview; kalau cover gagal diunduh, notifikasi jatuh ke teks biasa. Nama peng-verif di-tag memakai nomor WhatsApp-nya. Formatnya:

```text
🎬 Tsukasa Detector
👤 UP: @rinorstr (Rinor ECN)
ACC: ECN
📌 #margaecn - Ada ✅
📌 CN ECN - Cocok ✅
📝 Caption: ...
🔗 https://www.tiktok.com/@rinorstr/video/...
🙋 UP oleh: @62812xxxxxxx
```

Kalau caption tidak memuat hashtag, statusnya `❎` dan bot menambahkan peringatan agar uploader melengkapi hashtag tersebut.

Command verif (bisa ` / `, `.`, `!`, atau diawali `Tsukasa`):

```text
/verif ECN         # verif ACC di grup ini + tautkan ke nomor WhatsApp kamu
/veriv ECN         # alias typo
/me                # lihat akun TikTok yang tertaut ke nomor WhatsApp kamu
/me ECN            # filter salah satu akun
/listverif         # daftar ACC terverif di grup ini
/unverif ECN       # hapus ACC dari grup ini
/siapaup           # semua akun yang UP hari ini
/siapaup ECN       # filter hanya CN ECN
/whoup             # alias /siapaup
/cekup @rinorstr   # cek akun sudah UP hari ini atau belum
/history           # rekap UP 7 hari terakhir semua akun
/history ECN       # rekap khusus CN ECN
/cn Budi           # contoh CN TikTok (3 gaya) untuk nama Budi
```

Saat `/verif`, bot menyimpan `userJid`/`userPn` pengirim dan **otomatis menambahkan akun ke daftar pantauan detector**. Saat akun itu UP, detector memberi notifikasi ke grup dan men-tag nomor WhatsApp peng-verif. Kalau akun sudah pernah diverif tetapi belum tertaut, kirim ulang `/verif <acc>` dengan nama yang sama untuk melengkapi tautan tanpa membuat duplikat. `.me` menampilkan grup asal, target hashtag/CN, status UP hari ini, tanda ✅/❎ untuk `#margaecn` dan CN, peringatan bila belum lengkap, caption, dan link video.

### Kelola akun pantauan dari WhatsApp

Tanpa edit `.env` dan tanpa restart:

```text
/addakun @username   # di grup sama seperti /verif; di DM khusus owner
/delakun @username   # grup: hapus verif grup ini; DM owner: hapus semua verif + pantauan
/listakun            # lihat semua akun pantauan + status verif
/detector status          # status detector + kesehatan + grup notifikasi
/detector setgc           # pakai grup ini sebagai grup notifikasi TikTok
/detector setgc <link>    # atur grup lain lewat link undangan (owner)
/detector setgc off       # matikan grup notifikasi tambahan
/detector setgc status    # lihat grup notifikasi saat ini
/detector on              # aktifkan detector (khusus owner)
/detector off             # matikan detector (khusus owner)
```

`/addakun` di grup tidak perlu admin karena dasarnya sama dengan `/verif`. Di chat pribadi, hanya owner yang bisa menambah pantauan. `/delakun` di grup khusus admin grup/owner dan hanya menghapus verifikasi grup tersebut; akun tetap dipantau jika masih terverifikasi di grup lain. Saat startup, semua akun yang pernah diverifikasi disinkronkan otomatis ke daftar pantauan.

`/detector setgc` menyimpan `TIKTOK_NOTIFY_JID` dan langsung berlaku tanpa restart. Notifikasi tetap dikirim ke grup yang punya akun terverifikasi; grup tambahan ini berguna kalau ingin semua laporan UP masuk ke satu grup pantauan.

Daftar akun disimpan di `data/tiktok/accounts.json`. Selama file itu belum punya daftar akun, bot memakai `TIKTOK_ACCOUNTS` dari `.env`. Begitu ada `/addakun`, `/verif`, atau `/delakun`, daftar di file JSON yang menjadi acuan.

Data verif disimpan di `data/tiktok/` (`verif.json`, `history_up.json`, `up_today.json`, `seen_videos.json`, `accounts.json`). Folder ini diabaikan git sehingga data tidak hilang saat update/restart. Lokasi bisa diubah lewat `TIKTOK_DATA_DIR` atau path individual `VERIF_DB`, `HISTORY_UP_DB`, `UP_TODAY_DB`, `SEEN_VIDEOS_DB`, `TIKTOK_ACCOUNTS_DB`. Data lama di `database/*.json` dimigrasikan otomatis saat pertama dijalankan.

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
- Waktu absolut memakai `BOT_TIMEZONE`; offset UTC dihitung otomatis dari zona tersebut (default WIB). `BOT_TZ_OFFSET` hanya untuk override manual.
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
!topaktif         # leaderboard anggota paling aktif (default top 10)
!topaktif 20      # tampilkan top 20
!topaktif reset   # reset statistik grup (khusus owner)
```

- Bot menyimpan **metadata pesan di memori** (maksimal 150 pesan terakhir per chat) untuk rangkuman & statistik sesi ini. Data ini hilang saat restart.
- `!topaktif` memakai statistik **persisten** per grup (tanpa AI), tersimpan di state dan tidak hilang saat restart. Hanya obrolan biasa yang dihitung, bukan perintah.
- `!rangkum` mengirim transkrip ke Gemini; `!statistik` dan `!topaktif` dihitung lokal tanpa AI.
- Gunakan di grup yang memang memperbolehkan bot membaca percakapan.

### Moderasi & jadwal grup

Perintah moderasi hanya untuk admin grup (owner juga boleh). Bot harus menjadi admin grup agar bisa menghapus pesan atau membuka/menutup grup.

```text
!antilink on|off          # hapus link selain WhatsApp/allowlist
!antilink allow domain.com   # tambah domain yang diizinkan
!antilink unallow domain.com # hapus domain dari allowlist
!antilink list            # lihat allowlist
!antispam on|off          # hapus & beri peringatan saat spam
!moderasi                 # ringkasan status moderasi grup
!jadwal status            # lihat jadwal buka/tutup
!jadwal buka 06:00        # jam buka grup
!jadwal tutup 22:00       # jam tutup grup
!jadwal weekend on|off    # jadwal hanya Sabtu & Minggu
!jadwal test              # dry-run: cek bot admin & mode jadwal
!jadwal test open|close   # benar-benar uji buka/tutup
!jadwal on|off            # aktifkan/nonaktifkan jadwal
!mute 10 @user            # mute 10 menit (pesan dihapus otomatis)
!unmute @user             # cabut mute
!resetwarn @user          # reset peringatan satu pengguna
!resetwarn all            # reset semua peringatan di grup
```

Peserta yang melanggar akan diberi peringatan. Saat mencapai `MOD_WARN_LIMIT - 1`, peserta dimute `MOD_MUTE_MINUTES` menit; pelanggaran berikutnya dikeluarkan dari grup. Peringatan otomatis kedaluwarsa setelah 7 hari tanpa pelanggaran. Jadwal buka/tutup dicek tiap 30 detik, hanya dijalankan sekali per hari per aksi, mendukung jadwal lewat tengah malam, dan bisa dibatasi ke akhir pekan. Aksi moderasi dikirim ke `MOD_LOG_JID` (default owner).

### Mode balasan per grup

Admin grup (dan owner bot) bisa mengatur kapan Tsukasa membalas di grup masing-masing. Pengaturan disimpan per grup di `tsukasa_state.json`.

```text
.modegrup status   # lihat mode aktif grup ini
.modegrup all      # balas semua pesan
.modegrup reply    # balas hanya saat pesan di-reply DAN menyebut "tsukasa"
.modegrup call     # balas hanya saat dipanggil "tsukasa" (default)
```

- Default grup adalah `call`: bot hanya merespons saat ada panggilan `tsukasa`.
- Semua perintah (`.help`, `.stiker`, `.tagall`, dll.) dan fitur tetap berfungsi di mode mana pun.
- Di mode `reply`, pesan harus berupa balasan/quote ke pesan lain, lalu menyebut `tsukasa` **atau** membalas pesan bot. Quote video/dokumen/sticker/caption juga dihitung sebagai balasan.
- Di mode `all`, bot membalas semua pesan grup tanpa perlu trigger.

### Pesan sambutan & perpisahan per grup

Admin grup (dan owner) bisa mengubah pesan sambutan saat anggota baru masuk dan pesan perpisahan saat anggota keluar. Pengaturan disimpan per grup.

```text
.welcome status              # lihat status + template aktif
.welcome set Halo {mentions}! Selamat datang di {group}.
.welcome on|off              # aktifkan/nonaktifkan sambutan
.welcome reset               # kembali ke template default bot
.welcome preview             # kirim contoh sambutan

.goodbye status              # sama, untuk pesan perpisahan
.goodbye set Selamat jalan {mentions} 👋
.goodbye on|off|reset|preview
```

- Template boleh **multi-baris**: kirim pesan dengan Enter/Shift+Enter setelah `.welcome set`, atau tulis `\n` di tengah teks.
- Placeholder: `{mentions}` (tag semua peserta), `{user}`/`{name}` (nama), `{group}` (nama grup), `{count}` (jumlah peserta).
- Template default bisa diatur lewat env `WELCOME_TEXT` / `GOODBYE_TEXT`; override per grup menang atas default.
- Perubahan langsung berlaku tanpa restart karena disimpan di `tsukasa_state.json`.

### Aktif/nonaktifkan fitur per grup

Admin grup bisa mematikan fitur atau **perintah individual** tanpa mengganggu yang lain. Item yang dimatikan langsung hilang dari `.help` di grup itu dan perintahnya ditolak.

```text
.fitur status              # daftar fitur + perintah yang nonaktif
.fitur off news            # matikan perintah .news saja
.fitur off cosplay         # matikan perintah .cosplay saja
.fitur off brat qc         # matikan beberapa perintah sekaligus
.fitur on news             # aktifkan lagi
.fitur off fitur:news      # matikan seluruh kelompok fitur news
.fitur off cmd:history     # paksa override per perintah
.fitur off all             # matikan semua fitur
.fitur reset               # aktifkan semua fitur dan perintah
```

Nama perintah (mis. `news`, `cosplay`, `history`, `s`) diprioritaskan sebagai override per perintah. Untuk mematikan seluruh kelompok fitur yang namanya sama dengan perintah, gunakan awalan `fitur:` (mis. `fitur:news`, `fitur:verif`). Nama fitur yang tersedia: `ai`, `sticker`, `brat`, `qc`, `media`, `anime`, `news`, `cosplay`, `animechannel`, `verif`, `detector`, `tools`, `moderation`. Perintah pengelolaan seperti `.help` dan `.fitur` sendiri tidak bisa dimatikan. Pengaturan disimpan per grup di `tsukasa_state.json` (`groupFeatures`) dan berlaku juga untuk bentuk natural (mis. `tsukasa brat ...`).

### AFK, Ping & TagAll

```text
.afk                   # AFK tanpa alasan
.afk turu              # AFK dengan alasan "turu"
.afk off               # cabut AFK (alias .back / .unafk)
.afk list              # daftar member AFK di chat ini
.ping                  # cek latency bot + uptime
.tagall woi asw        # mention semua anggota dengan pesan "woi asw"
```

- Alasan AFK disimpan di `tsukasa_state.json`, jadi tetap ada setelah restart.
- Saat user AFK di-mention atau pesannya di-reply, bot membalas status AFK beserta alasannya (dibatasi cooldown 5 menit per user/chat agar tidak spam).
- Begitu user AFK mengirim pesan, sticker, atau media apa pun, statusnya otomatis dicabut dan bot menyambut dengan durasi AFK.
- `.tagall` bisa juga ditulis `!tagall`, `/tagall`, atau `tsukasa tagall`; teks setelah kata `tagall` dipakai sebagai isi pesan. Tanpa teks, bot memakai sapaan default.
- `.tagall` hanya bisa dipakai oleh **admin grup** (owner bot selalu boleh). Peserta biasa yang mencoba akan mendapat pesan penolakan.

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

## Logging

Semua output panel memakai format yang sama:

```
[2026-11-05 12:34:56] [INFO ] [TIKTOK] @kang_zenith baseline 31 video
[2026-11-05 12:35:10] [WARN ] [WA] Terputus (code=428). Reconnect dalam 4000ms...
[2026-11-05 12:35:12] [ERROR] [ROUTER] error: ...
```

- `LOG_LEVEL` mengatur level yang tampil; `LOG_DB_LEVEL` mengatur level yang disimpan.
- Bug/error (`warn` ke atas) otomatis masuk ke `database/logs.json` (maksimal `LOG_DB_MAX` entri) sehingga tetap bisa diperiksa walau log panel sudah lewat.
- Log internal Baileys/pino ikut dirapikan dengan tag `WA`, sehingga tidak lagi berupa JSON mentah.
- Set `LOG_STACK=false` untuk panel yang ringkas; ubah ke `true` saat sedang menelusuri bug.

## Reliability (Tier 5)

Bot menjaga sesi dan koneksi WhatsApp tetap sehat tanpa intervensi manual.

- **Backup sesi otomatis** — folder `SESSION_DIR` disalin ke `SESSION_BACKUP_DIR` setiap `SESSION_BACKUP_INTERVAL_H` jam. Hanya `SESSION_BACKUP_KEEP` backup terakhir yang disimpan. Backup pertama langsung dijalankan saat bot start. Status/backup manual: `.backup` dan `.backup run` (owner).
- **Reconnect backoff** — saat koneksi putus, jeda reconnect naik eksponensial (2s, 4s, 8s, ...) dengan jitter ±10%, dibatasi `RECONNECT_MAX_DELAY_SEC`. Sesi logout tetap menghentikan bot agar QR baru bisa dipindai.
- **Antrean unduhan** — unduhan HTTP (`downloadBytes`) dan media WhatsApp (`downloadMedia`) melewati antrean global dengan batas `DOWNLOAD_QUEUE_CONCURRENCY`. Ini mencegah RAM/bandwidth habis saat banyak permintaan berat bersamaan.
- **Metrik & health** — `.health`, `.status`, dan `GET /metrics` menampilkan jumlah pesan, command, error, reconnect, antrean unduhan, serta status backup. `GET /metrics` mengembalikan JSON.
- **Notifikasi error owner** — setiap log level `error` dicatat ke metrik dan dikirim ke owner lewat WhatsApp, dibatasi `HEALTH_ALERT_COOLDOWN_SEC` agar tidak spam. Matikan dengan `HEALTH_ALERT_ENABLED=false`.
- **Audit command owner** — command yang dijalankan owner ditulis ke `AUDIT_LOG_PATH` dalam format JSONL dan dirotasi saat melewati `AUDIT_LOG_MAX_BYTES`. Argumen command sensitif (`config`, `geminikey`, `set`, dll.) otomatis disamarkan. Lihat dengan `.audit [jumlah]`, bersihkan dengan `.audit clear`.

Semua pengaturan di atas juga bisa diubah lewat chat:

```text
.config reliability
.set SESSION_BACKUP_INTERVAL_H 3
.set DOWNLOAD_QUEUE_CONCURRENCY 2
.set HEALTH_ALERT_ENABLED off
```

## HTTP API

- `GET /` atau `GET /healthz` → `ok`
- `GET /help` → daftar endpoint
- `GET /metrics` → metrik runtime dalam JSON (uptime, counter, error terakhir, antrean unduhan). Jika `SEND_API_KEY` diisi, sertakan header `X-API-Key`.
- `POST/GET /send?to=628xxx&text=...` dengan header `X-API-Key: <SEND_API_KEY>` (jika dikonfigurasi). Mendukung JSON body juga.

## Catatan Teknis

- Versi Baileys yang dipakai: **7.0.0-rc14** (paket ESM, dimuat dengan `import()` dinamis dari CommonJS). Versi ini mendukung LID-native addressing, `newsletterMetadata`, dan pengiriman pesan ke channel. Jika sesi lama tidak bisa dipakai setelah upgrade, pairing ulang sekali lewat QR/kode.
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
- **Pesan bot tertulis “Menunggu pesan ini…” di chat penerima**: Ini bukan teks bot, melainkan pesan WhatsApp yang gagal didekripsi. Bot memakai Baileys v7 (LID-native) dan tetap mengarahkan kiriman `@lid` ke nomor telepon asli bila pemetaannya tersedia (`data/lidmap.json`). Jika masih muncul, minta penerima mengirim pesan baru ke bot agar pemetaan LID→nomor terbentuk, lalu balas lagi. Setelah upgrade dari Baileys 6.7.x, jika sesi lama bermasalah, pairing ulang sekali (QR/kode) lalu kirim pesan baru.
- **Log `No session found to decrypt message` / `transaction failed, rolling back`**: Ini race normal saat pesan grup tiba sebelum SenderKey dibagikan, termasuk varian `forbidden`. WhatsApp otomatis mengirim ulang sesi/pesan, jadi tidak perlu tindakan. Error ini tidak lagi memicu notifikasi “Error Tsukasa” ke owner, tetapi tetap tercatat di log panel untuk diagnosis. Error unduh media seperti `Cannot derive from empty media key` (media sudah kedaluwarsa/tidak punya kunci) juga tidak lagi memicu notifikasi owner.
- **TikTok kena WAF / 403 terus**: Coba `TIKTOK_JINA_KEY` (gratis di jina.ai) agar fallback Jina lebih stabil, atau isi `TIKTOK_PROXY_URLS` dengan proxy residential. Scraper lokal bisa dimatikan sementara lewat `TIKTOK_LOCAL_ENABLED=false` supaya bot langsung memakai Jina/TikWM. Kalau hanya satu akun yang gagal, cek apakah akun tersebut private/rename.
- **HTTP API tidak bisa diakses**: Pastikan allocation/port benar, aplikasi listen `0.0.0.0`, dan firewall node mengizinkan port tersebut.
- **Command plugin Kaguya membalas “Plugin gagal dijalankan”**: Biasanya dependency plugin belum terpasang. Jalankan `npm install` ulang, lalu cek log `[KAGUYA]` di panel untuk nama modul yang hilang.
- **`.menu` kosong / kategori tidak muncul**: Pastikan folder `plugins/` ikut ter-commit dan `plugins/package.json` berisi `{"type":"module"}`. Katalog dibaca dari source plugin saat pertama kali dipanggil.
- **Plugin butuh admin grup**: Beberapa plugin memeriksa status admin bot. Jadikan bot admin grup, lalu ulangi command.
- **Database plugin bentrok dengan SQLite**: Bridge memaksa `global.dbEngine = 'json'`, jadi tidak perlu `better-sqlite3`. Jika muncul error SQLite, hapus `database/kaguya.db` lalu restart.
