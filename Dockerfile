# ---------- Tsukasa WhatsApp Bot (Node.js / Baileys) ----------
FROM node:22-bookworm-slim

# ffmpeg untuk sticker animasi/video, fonts untuk watermark & brat
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        fonts-dejavu-core \
        fonts-liberation \
        fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependency dulu supaya layer cache efisien
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy source aplikasi
COPY . .

# Data persisten: sesi WhatsApp + state bot + memori
RUN mkdir -p /data && chown -R node:node /app /data
VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=7860 \
    SESSION_DIR=/data/session \
    STATE_DB=/data/tsukasa_state.json \
    MODE=MANUAL \
    TRIGGER=tsukasa \
    BAILEYS_LOG=warn

EXPOSE 7860
USER node

CMD ["node", "index.js"]
