const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9226;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
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

    console.log('Navigating to casamomo.at (1440x900)...');
    await sendP('Page.navigate', { url: 'https://www.casamomo.at/' });
    await sleep(4000);

    const data = await sendP('Runtime.evaluate', {
      expression: `(() => {
        // Collect all main sections and their layout details
        const allSec = Array.from(document.querySelectorAll('section, footer'));
        return allSec.map((sec, idx) => {
          const s = window.getComputedStyle(sec);
          const r = sec.getBoundingClientRect();
          const headings = Array.from(sec.querySelectorAll('h1, h2, h3, h4, p, a, button'))
            .map(el => ({
              tag: el.tagName,
              text: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80),
              color: window.getComputedStyle(el).color,
              font: window.getComputedStyle(el).fontFamily.split(',')[0],
              fontSize: window.getComputedStyle(el).fontSize
            }))
            .filter(item => item.text.length > 0)
            .slice(0, 15);

          const images = Array.from(sec.querySelectorAll('img')).map(img => ({
            src: img.src,
            width: img.width,
            height: img.height,
            alt: img.alt
          })).slice(0, 8);

          return {
            index: idx,
            id: sec.id,
            className: sec.className,
            bgColor: s.backgroundColor,
            height: r.height,
            headings,
            images
          };
        });
      })()`,
      returnByValue: true
    });

    console.log('--- ALL SECTIONS ON LIVE CASAMOMO.AT ---');
    console.log(JSON.stringify(data.result.value, null, 2));

    await send('Target.closeTarget', { targetId });
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

