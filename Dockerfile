FROM node:18-slim

RUN apt-get update && apt-get install -y curl wget ca-certificates && \
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# Copy file package dulu lalu install dependencies
COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
