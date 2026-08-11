FROM alpine:latest

# Install Node.js, curl, ca-certificates, dan gost langsung dari repository Alpine
RUN apk add --no-cache nodejs npm curl ca-certificates libc6-compat gost

# Install Cloudflared Binary Resmi
RUN curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000 8080

CMD ["npm", "start"]
