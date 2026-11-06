const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9250;
const HTTP_PORT = 3025;

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
  console.log(`Static server running on ${HTTP_PORT}`);

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  const wsUrlPromise = new Promise((resolve) => {
    chromeProc.stderr.on('data', d => {
      const m = d.toString().match(/DevTools listening on (ws:\/\/[^\s\r\n]+)/);
      if (m) resolve(m[1]);
    });
  });

  try {
    const wsUrl = await wsUrlPromise;
    console.log('DevTools listening on:', wsUrl);
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

    const { targetId } = await send('Target.createTarget', { url: `http://localhost:${HTTP_PORT}/` });
    console.log('Created target:', targetId);
    const pageWs = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${targetId}`);
    let pid = 1;
    const pPending = new Map();
    pageWs.onmessage = msg => {
      const p = JSON.parse(msg.data);
      if (p.id && pPending.has(p.id)) {
        const { resolve, reject } = pPending.get(p.id);
        pPending.delete(p.id);
        if (p.error) reject(p.error); else resolve(p.result);
      }
    };
    await new Promise(r => pageWs.onopen = r);
    console.log('Connected to page WebSocket');

    const sendP = (method, params = {}) => new Promise((resolve, reject) => {
      const mid = pid++;
      pPending.set(mid, { resolve, reject });
      pageWs.send(JSON.stringify({ id: mid, method, params }));
    });

    await sendP('Page.enable');
    await sendP('Runtime.enable');
    await sendP('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting 2.5s for intro animation...');
    await sleep(2500);

    // 1. Hero shot
    const shot1 = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_hero.png', Buffer.from(shot1.data, 'base64'));
    console.log('Captured local_hero.png');

    // 2. Statement shot (scrolled completely into statement section)
    await sendP('Runtime.evaluate', { expression: 'window.scrollTo({top: 960, behavior: "instant"});' });
    await sleep(1000);
    const shot2 = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_statement.png', Buffer.from(shot2.data, 'base64'));
    console.log('Captured local_statement.png');

    // 3. Scroll to Apartments Section & hover over Boutique N°1 card
    await sendP('Runtime.evaluate', { expression: `(() => {
      const aptSec = document.getElementById('apartments');
      if (aptSec) {
        window.scrollTo({ top: aptSec.offsetTop + 120, behavior: 'instant' });
      }
      const firstCard = document.querySelector('.apt-card');
      if (firstCard) {
        firstCard.classList.add('hover-test');
        const pill = firstCard.querySelector('.apt-hover-pill');
        if (pill) pill.style.opacity = '1';
      }
    })()` });
    await sleep(1200);
    const shot3 = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_apartments.png', Buffer.from(shot3.data, 'base64'));
    console.log('Captured local_apartments.png');

    // 4. Scroll to Boutique N°3 and Boutique N°4 to verify height difference
    await sendP('Runtime.evaluate', { expression: `(() => {
      const b3 = document.querySelector('[data-id="boutique-3"]');
      if (b3) {
        const top = b3.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + 180, behavior: 'instant' });
      }
    })()` });
    await sleep(1000);
    const shot4 = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_apartments_stagger.png', Buffer.from(shot4.data, 'base64'));
    console.log('Captured local_apartments_stagger.png');

    // 3. Inspect navbar state at scroll 850
    const evalData = await sendP('Runtime.evaluate', {
      expression: `(() => {
        const header = document.getElementById('siteHeader');
        const wordmark = document.getElementById('brandWordmark');
        const capsule = document.querySelector('.nav-capsule');
        const activeWords = Array.from(document.querySelectorAll('.scrub-word.active')).map(w => w.textContent.trim());
        const totalWords = Array.from(document.querySelectorAll('.scrub-word')).map(w => w.textContent.trim());
        
        return {
          wordmarkOpacity: window.getComputedStyle(wordmark).opacity,
          capsuleItems: Array.from(document.querySelectorAll('.nav-capsule .nav-item, .nav-capsule .nav-cta-btn')).map(el => el.textContent.trim()),
          totalScrubWords: totalWords.length,
          activeScrubWords: activeWords
        };
      })()`,
      returnByValue: true
    });
    console.log('Status at 850px scroll:', JSON.stringify(evalData.result.value, null, 2));

    await send('Target.closeTarget', { targetId });
  } finally {
    chromeProc.kill();
    server.close();
  }
}

run().catch(console.error);
