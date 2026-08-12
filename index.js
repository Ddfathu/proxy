const http = require('http');
const net = require('net');
const express = require('express');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8080;
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN;
const MY_DOMAIN = process.env.MY_DOMAIN || "Domain Belum Diisi";

// Endpoint API cek status
app.get('/tunnel', (req, res) => {
  res.json({
    status: TUNNEL_TOKEN ? "Tunnel Active" : "Token Missing!",
    vless_proxy_format: `${MY_DOMAIN}:443`
  });
});

app.get('/', (req, res) => {
  res.send(`Proxy Tunnel Active! Proxy IP: ${MY_DOMAIN}:443`);
});

const server = http.createServer(app);

// HTTP CONNECT Handler (Fix Parsing URL & Socket Pipe)
server.on('connect', (req, clientSocket, head) => {
  // Parsing host & port tanpa 'new URL()' biar gak crash
  const [hostname, port] = req.url.split(':');
  const targetPort = parseInt(port) || 80;

  const serverSocket = net.connect(targetPort, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => serverSocket.destroy());
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  if (TUNNEL_TOKEN) {
    // Jalanin cloudflared pake Token Zero Trust
    const cloudflared = spawn('cloudflared', ['tunnel', 'run', '--token', TUNNEL_TOKEN]);
    
    cloudflared.stdout.on('data', (data) => console.log(`[Argo] ${data}`));
    cloudflared.stderr.on('data', (data) => console.log(`[Argo Logs] ${data}`));
  } else {
    console.error("CRITICAL: TUNNEL_TOKEN belum dipasang di Environment Variable!");
  }
});
