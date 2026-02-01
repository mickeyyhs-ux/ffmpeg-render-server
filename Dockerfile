# 1) Node + FFmpeg (Debian)
FROM node:22-bookworm-slim

# 2) Install FFmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 3) App directory
WORKDIR /app

# 4) Install dependencies first (better caching)
COPY package.json ./
RUN npm install --omit=dev

# 5) Copy source
COPY . .

# 6) Railway uses PORT env
EXPOSE 3000

# 7) Start
CMD ["npm", "start"]
