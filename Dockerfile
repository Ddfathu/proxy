FROM node:20-alpine

# Install Nginx beserta modul stream TCP
RUN apk add --no-cache nginx nginx-mod-stream wget ca-certificates bind-tools

# Unduh Cloudflared DoH
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared || true

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.js index.html ./

RUN mkdir -p /var/log/nginx /run/nginx /etc/nginx/modules

EXPOSE 80 8080

CMD /usr/local/bin/cloudflared proxy-dns --port 5053 --upstream https://1.1.1.1/dns-query > /dev/null 2>&1 & node server.js
