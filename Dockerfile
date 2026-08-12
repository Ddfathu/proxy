FROM node:18-slim

# Install dependencies & cloudflared
RUN apt-get update && apt-get install -y curl wget ca-certificates && \
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Expose port lokal
ENV PORT=8080
EXPOSE 8080

# Jalankan HTTP Proxy & Cloudflare Quick Tunnel secara bersamaan
CMD node index.js & cloudflared tunnel --url http://localhost:8080
