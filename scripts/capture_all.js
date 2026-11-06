const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9235;
const HTTP_PORT = 3015;

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startServer() {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';
    const filePath = path.join(root, reqUrl);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
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
        }
      }
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise(resolve => server.listen(HTTP_PORT, () => resolve(server)));
}

async function run() {
  const server = await startServer();
  const tmpDir = path.join(require('os').tmpdir(), 'chrome-prof-' + Date.now());
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  const wsUrl = await new Promise((resolve, reject) => {
    chromeProc.stderr.on('data', d => {
      const m = d.toString().match(/DevTools listening on (ws:\/\/[^\s\r\n]+)/);
      if (m) resolve(m[1]);
    });
    setTimeout(() => reject(new Error('Timeout waiting for DevTools WS')), 5000);
  });

  console.log('Connected to Chrome:', wsUrl);
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = msg => {
    const p = JSON.parse(msg.data);
    if (p.id && pending.has(p.id)) {
      const { resolve, reject } = pending.get(p.id);
      pending.delete(p.id);
      if (p.error) reject(p.error); else resolve(p.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = id++;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  try {
    const { targetId } = await send('Target.createTarget', { url: `http://localhost:${HTTP_PORT}/` });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    const sendPage = (method, params = {}) => new Promise((resolve, reject) => {
      const mid = id++;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, sessionId, method, params }));
    });

    await sendPage('Page.enable');
    await sendPage('Runtime.enable');
    await sendPage('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting for preloader and intro...');
    await sleep(2400);

    // 1. Capture Hero (with unified floating navbar)
    const shot1 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('local_hero.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved local_hero.png');

    // 2. Scroll to Statement (Between quiet minimalism...)
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 880, behavior: "instant"});' });
    await sleep(1000);
    const shot2 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('local_statement.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved local_statement.png');

    // 3. Scroll to Boutique N°3 Showcase Image
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 1550, behavior: "instant"});' });
    await sleep(800);
    const shot3 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('local_showcase.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved local_showcase.png');

    // 4. Inspect Header & Statement state
    const evalData = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        const header = document.getElementById('siteHeader');
        const wordmark = document.getElementById('brandWordmark');
        const capsule = document.querySelector('.nav-capsule');
        const soundBtn = document.getElementById('soundToggleBtn');
        const activeWords = Array.from(document.querySelectorAll('.scrub-word.active')).map(w => w.textContent.trim());
        const totalWords = Array.from(document.querySelectorAll('.scrub-word')).map(w => w.textContent.trim());
        
        return {
          headerClasses: header?.className,
          wordmarkOpacity: window.getComputedStyle(wordmark).opacity,
          capsuleVisible: !!capsule,
          soundBtnVisible: !!soundBtn,
          totalWords: totalWords.length,
          activeWords: activeWords
        };
      })()`,
      returnByValue: true
    });
    console.log('Render Evaluation:', JSON.stringify(evalData.result.value, null, 2));

  } finally {
    chromeProc.kill();
    server.close();
  }
}

run().catch(console.error);
