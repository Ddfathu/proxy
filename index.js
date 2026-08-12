const http = require('http');
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

// HTTP CONNECT Handler (Proxy VLESS)
server.on('connect', (req, clientSocket, head) => {
  const { port, hostname } = new URL(`http://${req.url}`);
  const serverSocket = require('net').connect(port || 80, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', () => clientSocket.end());
  clientSocket.on('error', () => serverSocket.end());
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
