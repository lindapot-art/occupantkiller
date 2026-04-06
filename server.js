const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
};

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch(e) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Bad request');
  }
  if (url === '/') url = '/index.html';

  // Block null bytes (prevents ERR_INVALID_ARG_VALUE crash)
  if (url.indexOf('\0') !== -1) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Bad request');
  }

  // Prevent path traversal
  const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', ...SECURITY_HEADERS });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  OccupantKiller dev server running at:\n`);
  console.log(`  > http://localhost:${PORT}\n`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
