const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
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
  '.js':   'application/javascript; charset=utf-8',
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

// Compressible MIME types
const COMPRESSIBLE = new Set([
  'text/html', 'text/css', 'application/javascript', 'application/json',
  'image/svg+xml', 'model/gltf+json',
]);

// In-memory cache for gzipped assets (populated on first request)
const _gzCache = {};
const CACHE_MAX = 100; // max cached files

let server;
server = http.createServer((req, res) => {
  // Fast health check endpoint for Render.com
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // Music manifest endpoint — lists MP3 files in gamemusic/
  if (req.url === '/api/music') {
    try {
      const musicDir = path.join(ROOT, 'gamemusic');
      const files = fs.readdirSync(musicDir).filter(function (f) {
        return f.toLowerCase().endsWith('.mp3');
      }).map(function (f) {
        // Derive a clean title from filename
        var title = f.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').trim();
        return {
          filename: f,
          title: title,
          artist: 'OccupantKiller OST',
          src: 'gamemusic/' + encodeURIComponent(f),
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      return res.end(JSON.stringify(files));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      return res.end(JSON.stringify({ error: 'Unable to read music directory' }));
    }
  }

  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch(e) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Bad request');
  }
  if (url === '/') url = '/index.html';

  // Browsers may auto-request /favicon.ico; avoid noisy 404 console errors.
  if (url === '/favicon.ico') {
    res.writeHead(204, {
      'Cache-Control': 'public, max-age=86400',
      ...SECURITY_HEADERS,
    });
    return res.end();
  }

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

  // Block only truly sensitive files from being served (allow .js, .css, etc. in root)
  const rel = safePath.replace(/\\/g, '/').replace(/^\//, '');
  if (
    rel === 'server.js' ||
    rel === '.env' ||
    rel === 'wrangler.toml' ||
    rel === 'render.yaml' ||
    rel === 'start.bat' ||
    /^\.git(\/|$)/.test(rel) ||
    /^\.github(\/|$)/.test(rel) ||
    /^node_modules(\/|$)/.test(rel) ||
    /^memories(\/|$)/.test(rel) ||
    /^tools(\/|$)/.test(rel)
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Forbidden');
  }

  console.log(`[SERVER] Requested URL: ${url} | SafePath: ${safePath} | FilePath: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`[SERVER][404][DIAG] File does not exist: ${filePath}`);
  }
  fs.readFile(filePath, (err, data) => {
    const ext = path.extname(filePath).toLowerCase();
    if (err) {
      // Enhanced 404 logging for JS files
      if (ext === '.js') {
        console.error(`[SERVER][404][JS] url=${url} filePath=${filePath}`);
      } else {
        console.error(`[SERVER] 404 Not Found: url=${url} filePath=${filePath}`);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      return res.end('Not found');
    }
    const mime = MIME[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': mime, ...SECURITY_HEADERS };

    // Log every JS file request (200)
    if (ext === '.js') {
      console.log(`[SERVER][200][JS] url=${url} filePath=${filePath}`);
    }

    // Cache-Control: cache JS/CSS/images for 1 hour, HTML for 5 min
    if (ext === '.html') {
      headers['Cache-Control'] = 'public, max-age=300';
    } else if (ext === '.js' || ext === '.css') {
      headers['Cache-Control'] = 'public, max-age=3600';
    } else if ([
      '.png', '.jpg', '.gif', '.svg', '.ico', '.glb', '.wav', '.mp3', '.ogg'
    ].indexOf(ext) !== -1) {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    // Gzip compress text-based assets (with cache)
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (COMPRESSIBLE.has(mime) && acceptEncoding.indexOf('gzip') !== -1) {
      if (_gzCache[filePath]) {
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        return res.end(_gzCache[filePath]);
      }
      zlib.gzip(data, (gzErr, compressed) => {
        if (gzErr) {
          res.writeHead(200, headers);
          return res.end(data);
        }
        // Cache for future requests
        if (Object.keys(_gzCache).length < CACHE_MAX) {
          _gzCache[filePath] = compressed;
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);

        res.end(compressed);
      });
    } else {
      res.writeHead(200, headers);
      res.end(data);
    }
  });
});


  try {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  OccupantKiller server running at:\n`);
      console.log(`  > http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('SERVER STARTUP ERROR:', err);
    if (err.code === 'EADDRINUSE') {
      console.error('Port', PORT, 'is already in use. Try killing other node processes or change the port.');
    } else if (err.code === 'EACCES') {
      console.error('Permission denied. Try running as administrator or use a different port.');
    }
    process.exit(1);
  }


process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  if (reason && reason.stack) console.error(reason.stack);
  // Keep server alive for transient async errors; investigate via logs.
});

process.on('exit', (code) => {
  console.log('Process exit event with code:', code);
  console.trace('Exit stack trace');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  console.trace('SIGTERM stack trace');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT');
  console.trace('SIGINT stack trace');
  process.exit(0);
});
