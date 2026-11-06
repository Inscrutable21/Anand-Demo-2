/**
 * CASA MOMO • ZERO-DEPENDENCY SERVER & VERCEL ENTRYPOINT
 * Handles both local development (node server.js)
 * and Vercel Serverless Function deployments.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function handleRequest(req, res) {
  let reqUrl = (req.url || '/').split('?')[0];
  if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';

  // Search in public folder, then root folder
  let filePath = path.join(__dirname, 'public', reqUrl);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, reqUrl);
  }

  // Fallback to index.html for SPA/clean URLs if not found
  if (!fs.existsSync(filePath) && !path.extname(reqUrl)) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    // CORS & Content Security Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (ext === '.mp4') {
      const range = req.headers.range;
      const fileSize = stats.size;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        });
        file.pipe(res);
        return;
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    // Cache control
    if (reqUrl.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Export for Vercel Serverless Function entrypoint
module.exports = handleRequest;

// Run standalone server if started via node server.js
if (require.main === module) {
  // Rebuild on file changes in /sections, /styles, template.html when run locally
  const { exec } = require('child_process');
  ['sections', 'styles', 'template.html'].forEach(item => {
    const target = path.join(__dirname, item);
    if (fs.existsSync(target)) {
      fs.watch(target, { recursive: true }, (event, filename) => {
        exec('node build.js', (err, stdout) => {
          if (!err && stdout) console.log(stdout.trim());
        });
      });
    }
  });

  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`CASA MOMO GRAZ • Dev Server Running!`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}
