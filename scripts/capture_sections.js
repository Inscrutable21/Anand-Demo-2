const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9270;
const HTTP_PORT = 3030;

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
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise(resolve => server.listen(HTTP_PORT, () => resolve(server)));
}

async function run() {
  const server = await startServer();
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

    await sleep(2200);

    // 1. Host Section
    await sendP('Runtime.evaluate', { expression: `(() => {
      const el = document.getElementById('host');
      if (el) window.scrollTo({ top: el.offsetTop - 40, behavior: 'instant' });
    })()` });
    await sleep(1000);
    const shotHost = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_host.png', Buffer.from(shotHost.data, 'base64'));
    console.log('Saved local_host.png');

    // 2. Philosophy & Reviews Section
    await sendP('Runtime.evaluate', { expression: `(() => {
      const el = document.getElementById('philosophy');
      if (el) window.scrollTo({ top: el.offsetTop - 40, behavior: 'instant' });
    })()` });
    await sleep(1000);
    const shotReviews = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_reviews.png', Buffer.from(shotReviews.data, 'base64'));
    console.log('Saved local_reviews.png');

    // 3. Footer Section
    await sendP('Runtime.evaluate', { expression: 'window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });' });
    await sleep(1000);
    const shotFooter = await sendP('Page.captureScreenshot');
    fs.writeFileSync('local_footer.png', Buffer.from(shotFooter.data, 'base64'));
    console.log('Saved local_footer.png');

    await send('Target.closeTarget', { targetId });
  } finally {
    chromeProc.kill();
    server.close();
  }
}

run().catch(console.error);

