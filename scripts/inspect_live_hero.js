const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      try {
        const data = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${PORT}/json/version`, res => {
            let str = '';
            res.on('data', d => str += d);
            res.on('end', () => resolve(JSON.parse(str)));
          }).on('error', reject);
        });
        if (data.webSocketDebuggerUrl) {
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {
        await sleep(250);
      }
    }

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

    const { targetId } = await send('Target.createTarget', { url: 'https://www.casamomo.at/' });
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
    console.log('Navigating to live site (1440x900)...');
    await sendP('Page.navigate', { url: 'https://www.casamomo.at/' });
    await sleep(4000);

    const info = await sendP('Runtime.evaluate', {
      expression: `(() => {
        const casaDiv = document.querySelector('.framer-127143z');
        const momoDiv = document.querySelector('.framer-gx6kn9');
        const taglineDiv = document.querySelector('.framer-1mzmlpu');
        const header = document.querySelector('header');
        const video = document.querySelector('video');
        const videoContainer = video ? video.parentElement : null;

        function getFull(el) {
          if (!el) return null;
          const s = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            html: el.outerHTML,
            rect: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right },
            css: {
              position: s.position,
              top: s.top,
              left: s.left,
              right: s.right,
              bottom: s.bottom,
              transform: s.transform,
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              lineHeight: s.lineHeight,
              letterSpacing: s.letterSpacing,
              color: s.color,
              backgroundColor: s.backgroundColor,
              borderRadius: s.borderRadius,
              padding: s.padding,
              margin: s.margin,
              display: s.display,
              justifyContent: s.justifyContent,
              alignItems: s.alignItems,
              gap: s.gap
            }
          };
        }

        return {
          casa: getFull(casaDiv),
          momo: getFull(momoDiv),
          tagline: getFull(taglineDiv),
          header: getFull(header),
          video: getFull(video),
          videoContainer: getFull(videoContainer)
        };
      })()`,
      returnByValue: true
    });

    console.log('--- EXACT DETAILS ---');
    console.log(JSON.stringify(info.result.value, null, 2));

    console.log('--- LIVE HERO INSPECTION RESULT ---');
    console.log(JSON.stringify(info.result.value, null, 2));

    await send('Target.closeTarget', { targetId });
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
