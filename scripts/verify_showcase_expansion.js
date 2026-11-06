const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9260;
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

  return new Promise(resolve => {
    server.listen(HTTP_PORT, () => resolve(server));
  });
}

async function run() {
  const server = await startServer();
  console.log('Static server running on port', HTTP_PORT);

  const tmpDir = path.join(require('os').tmpdir(), 'chrome-snap-prof-' + Date.now());
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  const wsUrlPromise = new Promise((resolve) => {
    chromeProc.stderr.on('data', d => {
      const str = d.toString();
      const m = str.match(/DevTools listening on (ws:\/\/[^\s\r\n]+)/);
      if (m) {
        resolve(m[1]);
      }
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

    console.log(`Navigating to http://localhost:${HTTP_PORT}/...`);
    await sendP('Page.navigate', { url: `http://localhost:${HTTP_PORT}/` });
    await sleep(2200);

    // Get position of #showcaseExpand and statement
    const evalPos = await sendP('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('showcaseExpand');
        const st = document.getElementById('statement');
        return {
          showcaseTop: el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null,
          statementTop: st ? Math.round(st.getBoundingClientRect().top + window.scrollY) : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Positions:', evalPos.result.value);
    const showcaseTop = evalPos.result.value.showcaseTop;

    // We will inspect at multiple scroll positions
    const scrolls = [
      { name: 'step1_initial', scroll: Math.max(0, showcaseTop - 800) },
      { name: 'step2_expanding', scroll: Math.max(0, showcaseTop - 450) },
      { name: 'step3_fullwidth', scroll: Math.max(0, showcaseTop - 50) }
    ];

    for (const s of scrolls) {
      await sendP('Runtime.evaluate', {
        expression: `if (window.__lenis) { window.__lenis.scrollTo(${s.scroll}, { immediate: true }); } else { window.scrollTo({ top: ${s.scroll}, behavior: 'instant' }); } ScrollTrigger.update();`
      });
      await sleep(600);

      const metrics = await sendP('Runtime.evaluate', {
        expression: `(() => {
          const f = document.getElementById('showcaseFrame');
          const img = document.getElementById('showcaseImg');
          if (!f) return { error: 'no frame' };
          const r = f.getBoundingClientRect();
          const s = window.getComputedStyle(f);
          return {
            scrollY: window.scrollY,
            top: Math.round(r.top),
            width: Math.round(r.width),
            height: Math.round(r.height),
            maxWidth: s.maxWidth,
            borderRadius: s.borderRadius,
            transform: s.transform
          };
        })()`,
        returnByValue: true
      });
      console.log(`[${s.name}] scroll=${s.scroll}:`, metrics.result.value);

      const shot = await sendP('Page.captureScreenshot');
      const outPath = `C:/Users/poona/.gemini/antigravity/brain/300f2e47-5f04-4911-9967-35f1a7d2427f/showcase_${s.name}.png`;
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot to ${outPath}`);
    }

  } finally {
    chromeProc.kill();
    server.close();
  }
}

run().catch(console.error);
