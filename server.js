#!/usr/bin/env node

const http = require("http");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 3000;
const GOST_PORT = 8080;
let currentArgoDomain = "";

// 1. Jalankan Gost Proxy
function startGost() {
  console.log("Starting Gost Proxy on port " + GOST_PORT + "...");
  const gost = spawn("gost", ["-L", `http+ws://127.0.0.1:${GOST_PORT}`]);

  gost.stdout.on("data", (data) => console.log(`[GOST]: ${data}`));
  gost.stderr.on("data", (data) => console.log(`[GOST ERR]: ${data}`));
}

// 2. Jalankan Cloudflare Tunnel
function startCloudflared() {
  console.log("Starting Cloudflare Tunnel...");
  const cf = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${GOST_PORT}`]);

  cf.stderr.on("data", (data) => {
    const output = data.toString();
    const match = output.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
    if (match) {
      currentArgoDomain = match[1];
      console.log(`\n[SUCCESS] Domain Quick Tunnel: ${currentArgoDomain}\n`);
    }
  });

  cf.on("close", () => setTimeout(startCloudflared, 3000));
}

startGost();
setTimeout(startCloudflared, 2000);

// 3. Endpoint Log API
const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];

  if (urlPath === "/__info" || urlPath === "/api/tunnel") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      status: currentArgoDomain ? "online" : "connecting",
      type: "HTTP/WebSocket Proxy (Gost)",
      domain: currentArgoDomain || "Generating...",
      path_for_worker: currentArgoDomain ? `/${currentArgoDomain}:443` : null
    }, null, 2));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<h2>Gost + CF Tunnel Running</h2><p>API Log: <a href="/__info">/__info</a></p>`);
});

server.listen(PORT, () => console.log(`Server log running on port:${PORT}`));
