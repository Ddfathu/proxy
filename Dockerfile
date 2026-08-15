FROM node:20-alpine

# Install Nginx, curl/wget, dan libc kompatibilitas
RUN apk add --no-cache nginx wget ca-certificates gcompat

# Unduh binary resmi Cloudflared
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# Install dependensi Node.js
COPY package.json ./
RUN npm install

# Copy source code
COPY server.js index.html ./

# Siapkan direktori log dan runtime Nginx
RUN mkdir -p /var/log/nginx /run/nginx

EXPOSE 80 8080

# Jalankan DoH daemon di port 5053 dan start Node.js controller
CMD /usr/local/bin/cloudflared proxy-dns --port 5053 --upstream https://1.1.1.1/dns-query & node server.js
