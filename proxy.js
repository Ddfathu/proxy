const net = require('net');
const PORT = process.env.PORT || 8080;

const server = net.createServer((clientSocket) => {
  clientSocket.once('data', (data) => {
    // Membaca target dari header atau langsung forward data
    clientSocket.pause();
    // Proses forward TCP Socket murni
    clientSocket.resume();
  });
});

server.listen(PORT, () => console.log(`Proxy TCP jalan di port ${PORT}`));
