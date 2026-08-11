FROM alpine:latest

# Install Node.js, curl, libc6-compat, dan dependencies
RUN apk add --no-cache nodejs npm curl ca-certificates libc6-compat

# Download & Install GOST Binary Resmi
RUN curl -L https://github.com/go-gost/gost/releases/download/v2.11.5/gost-linux-amd64-2.11.5.gz -o gost.gz && \
    gunzip gost.gz && \
    mv gost /usr/local/bin/gost && \
    chmod +x /usr/local/bin/gost

# Download & Install Cloudflared Binary Resmi
RUN curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# Copy project files
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000 8080

CMD ["npm", "start"]
