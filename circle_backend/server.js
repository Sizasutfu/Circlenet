// server.js – Circle API entry point

require('dotenv').config();

const { connectDB } = require('./src/config/db');
const app           = require('./src/app');
const { attachWS }  = require('./wsServer');

const PORT   = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  await connectDB();

  if (isProd) {
    const http   = require('http');
    const server = http.createServer(app);
    attachWS(server);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Circle API running on port ${PORT} (production)`);
    });
  } else {
    const fs   = require('fs');
    const path = require('path');

    const certKey  = path.join(__dirname, 'src/sizabeats+2-key.pem');
    const certFile = path.join(__dirname, 'src/sizabeats+2.pem');

    if (!fs.existsSync(certKey) || !fs.existsSync(certFile)) {
      console.warn('⚠️  SSL certs not found — falling back to HTTP for development');
      const http   = require('http');
      const server = http.createServer(app);
      attachWS(server);
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`⚠️  Circle API running on http://localhost:${PORT} (no certs)`);
      });
      return;
    }

    const https      = require('https');
    const sslOptions = {
      key:  fs.readFileSync(certKey),
      cert: fs.readFileSync(certFile),
    };

    const server = https.createServer(sslOptions, app);
    attachWS(server);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Circle API running on https://sizabeats:${PORT} (development)`);
      console.log(`✅ Phone (same WiFi): https://192.168.163.203:${PORT}`);
    });
  }
}

start();