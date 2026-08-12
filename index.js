const http = require('http');
const httpProxy = require('http-proxy');

// Inisialisasi HTTP Proxy
const proxy = httpProxy.createProxyServer({});
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  // Menangani HTTP CONNECT Request (Tunneling)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Proxy Active');
});

// Izinkan HTTP CONNECT (Standard Tunneling buat Worker)
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
  console.log(`Proxy running on port ${PORT}`);
});
