# Sticker Packs

Folder ini menyimpan sticker untuk fitur auto sticker reply.

Struktur:

```text
assets/stickers/
  lucu/
    *.webp
  sedih/
    *.webp
  marah/
  love/
  ngantuk/
  hai/
  kaget/
  lain/
```

Cara menambah dari WhatsApp:

1. Kirim sticker, atau reply sticker yang sudah ada.
2. Ketik `.sadd lucu` (ganti `lucu` dengan nama mood).

Command lain:

- `.slist` — lihat semua pack dan jumlahnya
- `.srandom lucu` — kirim sticker random dari pack `lucu`
- `.srandom` — kirim sticker random dari pack mana pun
- `.s lucu` — alias cepat untuk `.srandom lucu`
- `.sdel lucu 2` — hapus sticker nomor 2 dari pack `lucu`

Auto reply diatur lewat `.env`:

```env
STICKER_REPLY_ENABLED=true
STICKER_REPLY_CHANCE=30
STICKER_REPLY_COOLDOWN_SEC=90
STICKER_DIR=assets/stickers
```

Semua sticker harus berformat `.webp`. Sticker yang dikirim bot akan otomatis
meng-quote pesan pemicu.
