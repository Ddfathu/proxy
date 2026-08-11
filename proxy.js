#!/usr/bin/env node

const http = require("http");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const FILE_PATH = process.env.FILE_PATH || ".tmp";
const GOST_PORT = 8080;

if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH, { recursive: true });
}

let currentArgoDomain = "";

// 1. Dapatkan Binary Gost & Cloudflared Sesuai Arsitektur
function getSystemArchitecture() {
  const arch = os.arch();
  return (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') ? 'arm' : 'amd';
}

// 2. Jalankan Gost Proxy (Port 8080)
function startGost() {
  console.log("Starting Gost Proxy Server on port " + GOST_PORT + "...");
  // Menjalankan Gost HTTP/WebSocket Proxy tanpa butuh UUID
  const gost = spawn("npx", ["-y", "gost-bin", "-L", `http+ws://127.0.0.1:${GOST_PORT}`]);

  gost.stdout.on("data", (data) => console.log(`[GOST]: ${data}`));
  gost.stderr.on("data", (data) => console.log(`[GOST ERR]: ${data}`));
}

// 3. Jalankan Cloudflare Quick Tunnel ke Port Gost
function startCloudflared() {
  console.log("Starting Cloudflare Tunnel...");
  
  // Menggunakan npx cloudflared agar otomatis mendownload binary resmi
  const cf = spawn("npx", ["-y", "cloudflared", "tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${GOST_PORT}`]);

  cf.stderr.on("data", (data) => {
    const output = data.toString();
    // Ekstrak URL trycloudflare.com dari log cloudflared
    const match = output.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
    if (match) {
      currentArgoDomain = match[1];
      console.log("\n=============================================");
      console.log(`[SUCCESS] Domain Quick Tunnel: ${currentArgoDomain}`);
      console.log("=============================================\n");
    }
  });

  cf.on("close", (code) => {
    console.log(`Cloudflared exited with code ${code}, restarting...`);
    setTimeout(startCloudflared, 3000);
  });
}

// 4. Jalankan Service Proxy & Tunnel
startGost();
setTimeout(startCloudflared, 2000);

// 5. Server HTTP + API Log Endpoint
const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];

  // --- API LOG ENDPOINT UNTUK MENGAMBIL URL QUICK TUNNEL ---
  if (urlPath === "/__info" || urlPath === "/api/tunnel") {
    const infoData = {
      status: currentArgoDomain ? "online" : "connecting",
      type: "HTTP/WebSocket Proxy (Gost)",
      target_port: GOST_PORT,
      domain: currentArgoDomain || "Sedang menggenerasi domain, coba refresh 5 detik lagi...",
      path_for_worker: currentArgoDomain ? `/${currentArgoDomain}:443` : null
    };

    res.writeHead(200, { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*" 
    });
    res.end(JSON.stringify(infoData, null, 2));
    return;
  }

  // --- HALAMAN UTAMA ---
  if (urlPath === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h2>Server Proxy Gost + Cloudflare Tunnel Active!</h2>
      <p>Status Tunnel: <b>${currentArgoDomain ? "CONNECTED" : "WAITING..."}</b></p>
      <p>Akses API Info: <a href="/__info">/__info</a></p>
    `);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

server.listen(PORT, () => {
  console.log(`HTTP Log Server running on port:${PORT}`);
});
