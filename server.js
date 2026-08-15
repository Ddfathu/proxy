const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 80;
const CONFIG_PATH = '/etc/nginx/nginx.conf';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

let currentSettings = {
    routingMode: 'edge_doh', // 'edge_doh', 'static', 'dynamic'
    staticIp: '104.16.123.96',
    dohProvider: 'custom',   // 'cloudflare', 'google', 'quad9', 'custom'
    customDohUrl: 'https://1.1.1.1/dns-query', // URL DoH Railway pribadi Anda
    ipv6: false,
    tcpNodelay: true,
    socketKeepalive: true,
    tcpFastOpen: false,
    bufferSize: '128k',
    connectTimeout: '2s',
    proxyTimeout: '5m',
    enableLogging: false
};

function generateNginxConfig(s) {
    let resolverLine = '';
    let proxyTarget = '';

    if (s.routingMode === 'edge_doh') {
        // Menggunakan Local DoH Daemon di port 5053
        resolverLine = `resolver 127.0.0.1:5053 valid=3600s ipv6=${s.ipv6 ? 'on' : 'off'};`;
        proxyTarget = `$ssl_preread_server_name:443`;
    } else if (s.routingMode === 'static') {
        resolverLine = `resolver 127.0.0.1:5053 1.1.1.1 valid=3600s ipv6=off;`;
        proxyTarget = `${s.staticIp}:443`;
    } else {
        resolverLine = `resolver 1.1.1.1 1.0.0.1 8.8.8.8 valid=3600s ipv6=off;`;
        proxyTarget = `$ssl_preread_server_name:443`;
    }

    const logDirective = s.enableLogging 
        ? `log_format stream_monitor '$remote_addr [$time_local] Target: $ssl_preread_server_name Bytes: [RX: $bytes_received | TX: $bytes_sent] Duration: \${session_time}s Status: $status';\n    access_log /var/log/nginx/stream.log stream_monitor buffer=32k flush=3s;`
        : `access_log off;`;

    const fastOpenParam = s.tcpFastOpen ? 'fastopen=512' : '';

    return `load_module /usr/lib/nginx/modules/ngx_stream_module.so;

worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 8192;
    multi_accept on;
    use epoll;
}

stream {
    ${resolverLine}
    resolver_timeout 2s;

    ${logDirective}
    error_log /dev/null crit;

    proxy_buffer_size ${s.bufferSize};
    proxy_connect_timeout ${s.connectTimeout};
    proxy_timeout ${s.proxyTimeout};

    server {
        listen 8080 reuseport backlog=4096 ${fastOpenParam};
        ssl_preread on;
        proxy_pass ${proxyTarget};

        ${s.tcpNodelay ? 'tcp_nodelay on;' : '# tcp_nodelay off;'}
        ${s.socketKeepalive ? 'proxy_socket_keepalive on;' : '# proxy_socket_keepalive off;'}
    }
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log off;
    error_log /dev/null crit;

    server {
        listen 8081;

        location /nginx_status {
            stub_status;
            access_log off;
        }

        location /stream_logs {
            default_type text/plain;
            alias /var/log/nginx/stream.log;
            access_log off;
        }
    }
}
`;
}

// Menjalankan/memperbarui upstream URL DoH Daemon
function updateDohDaemon(provider, customUrl) {
    let dohUrl = 'https://1.1.1.1/dns-query';
    if (provider === 'google') dohUrl = 'https://dns.google/dns-query';
    if (provider === 'quad9') dohUrl = 'https://dns.quad9.net/dns-query';
    if (provider === 'custom' && customUrl && customUrl.trim() !== '') {
        dohUrl = customUrl.trim();
    }

    exec('pkill -f "cloudflared proxy-dns"', () => {
        exec(`/usr/local/bin/cloudflared proxy-dns --port 5053 --upstream ${dohUrl} &`, (err) => {
            if (err) console.log('DoH Daemon reload notice:', err.message);
            console.log(`DoH Engine aktif mengarah ke: ${dohUrl}`);
        });
    });
}

app.get('/api/settings', (req, res) => {
    res.json(currentSettings);
});

app.post('/api/apply', (req, res) => {
    const prevDohProvider = currentSettings.dohProvider;
    const prevCustomUrl = currentSettings.customDohUrl;

    currentSettings = { ...currentSettings, ...req.body };

    // Update daemon DoH jika ada perubahan provider atau perubahan URL custom
    if (currentSettings.dohProvider !== prevDohProvider || currentSettings.customDohUrl !== prevCustomUrl) {
        updateDohDaemon(currentSettings.dohProvider, currentSettings.customDohUrl);
    }

    const confContent = generateNginxConfig(currentSettings);

    fs.writeFile(CONFIG_PATH, confContent, (err) => {
        if (err) return res.status(500).json({ error: 'Gagal menulis config' });

        exec('nginx -s reload', (reloadErr) => {
            if (reloadErr) return res.status(500).json({ error: reloadErr.message });
            res.json({ success: true });
        });
    });
});

app.get('/api/status', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8081/nginx_status');
        const text = await response.text();
        res.send(text);
    } catch (e) {
        res.status(500).send('Offline');
    }
});

app.get('/api/logs', async (req, res) => {
    if (!currentSettings.enableLogging) return res.send('LOG_DISABLED');
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8081/stream_logs');
        const text = await response.text();
        res.send(text);
    } catch (e) {
        res.send('');
    }
});

// Jalankan Nginx & DoH saat start
fs.writeFile(CONFIG_PATH, generateNginxConfig(currentSettings), () => {
    exec('nginx', () => {
        updateDohDaemon(currentSettings.dohProvider, currentSettings.customDohUrl);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
