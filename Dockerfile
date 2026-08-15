FROM node:20-alpine

# Install Nginx dan Cloudflared DoH client
RUN apk add --no-cache nginx cloudflared

WORKDIR /app

# Install dependensi Node.js
COPY package.json ./
RUN npm install

# Copy source code UI dan Backend
COPY server.js index.html ./

# Siapkan direktori log Nginx
RUN mkdir -p /var/log/nginx /run/nginx

EXPOSE 80 8080

# Jalankan DoH local daemon di background port 5053 lalu start Node.js controller
CMD cloudflared proxy-dns --port 5053 --upstream https://1.1.1.1/dns-query & node server.js
