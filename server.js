const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 80;
const CONFIG_PATH = '/etc/nginx/nginx.conf';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

let tunnelProcess = null;

// Konfigurasi Default & State
let currentSettings = {
    routingMode: 'dynamic',
    staticIp: '104.16.123.96',
    dnsMode: 'standard',
    customDns: '1.1.1.1 8.8.8.8',
    dohProvider: 'cloudflare',
    ipv6: false,
    tcpNodelay: true,
    socketKeepalive: true,
    tcpFastOpen: false,
    bufferSize: '128k',
    connectTimeout: '2s',
    proxyTimeout: '5m',
    enableLogging: false,
    // Zero Trust Settings
    enableZeroTrust: false,
    zeroTrustToken: ''
};

function generateNginxConfig(s) {
    let resolverLine = '';
    if (s.dnsMode === 'doh') {
        resolverLine = `resolver 127.0.0.1:5053 1.1.1.1 valid=3600s ipv6=${s.ipv6 ? 'on' : 'off'};`;
    } else if (s.dnsMode === 'custom') {
        resolverLine = `resolver ${s.customDns} valid=3600s ipv6=${s.ipv6 ? 'on' : 'off'};`;
    } else {
        resolverLine = `resolver 1.1.1.1 1.0.0.1 8.8.8.8 valid=3600s ipv6=${s.ipv6 ? 'on' : 'off'};`;
    }

    const proxyTarget = s.routingMode === 'static' 
        ? `${s.staticIp}:443` 
        : `$ssl_preread_server_name:443`;

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

// Manager Zero Trust Cloudflare Tunnel
function manageZeroTrust(enable, token) {
    if (tunnelProcess) {
        try {
            process.kill(-tunnelProcess.pid);
        } catch (e) {
            try { tunnelProcess.kill(); } catch (err) {}
        }
        tunnelProcess = null;
    }

    if (enable && token && token.trim() !== '') {
        console.log('Menjalankan Cloudflare Zero Trust Tunnel...');
        tunnelProcess = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', token.trim()], {
            detached: true,
            stdio: 'ignore'
        });
    }
}

app.get('/api/settings', (req, res) => {
    res.json(currentSettings);
});

app.post('/api/apply', (req, res) => {
    const prevZeroTrustEnable = currentSettings.enableZeroTrust;
    const prevToken = currentSettings.zeroTrustToken;

    currentSettings = { ...currentSettings, ...req.body };

    // Update Tunnel Zero Trust jika ada perubahan toggle atau token
    if (currentSettings.enableZeroTrust !== prevZeroTrustEnable || currentSettings.zeroTrustToken !== prevToken) {
        manageZeroTrust(currentSettings.enableZeroTrust, currentSettings.zeroTrustToken);
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

// Start awal
fs.writeFile(CONFIG_PATH, generateNginxConfig(currentSettings), () => {
    exec('nginx', (err) => {
        if (err) console.log('Nginx init notice:', err.message);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Control Panel Server berjalan di port ${PORT}`);
});
