FROM node:20-alpine

# Install depedensi sistem dasar untuk kebutuhan network dan SSL
RUN apk add --no-cache libc6-compat ca-certificates curl

# Tentukan working directory
WORKDIR /app

# Copas package.json dan install dependency terlebih dahulu (biar caching cepat)
COPY package*.json ./
RUN npm install --production

# Copas seluruh kode utama ke dalam container
COPY . .

# Buat folder sementara untuk operasi runtime jika dibutuhkan
RUN mkdir -p .tmp

# Expose port bawaan
EXPOSE 3000 8080

# Jalankan server
CMD ["npm", "start"]
