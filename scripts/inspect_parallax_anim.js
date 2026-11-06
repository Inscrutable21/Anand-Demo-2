const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9280;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'https://www.casamomo.at/'
  ]);

  const wsUrl = await new Promise((resolve, reject) => {
    chromeProc.stderr.on('data', d => {
      const m = d.toString().match(/DevTools listening on (ws:\/\/[^\s\r\n]+)/);
      if (m) resolve(m[1]);
    });
    setTimeout(() => reject(new Error('Timeout waiting for DevTools WS')), 6000);
  });

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
    const { targetId } = await send('Target.createTarget', { url: 'https://www.casamomo.at/' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    const sendPage = (method, params = {}) => new Promise((resolve, reject) => {
      const mid = id++;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, sessionId, method, params }));
    });

    await sendPage('Page.enable');
    await sendPage('Runtime.enable');

    console.log('Waiting 5s for casamomo.at to load...');
    await sleep(5000);

    // Scroll through different points and measure the Parallax Image width/scale/transform/rect
    const scrollPoints = [800, 1200, 1600, 2000, 2400];
    const results = [];

    for (const top of scrollPoints) {
      await sendPage('Runtime.evaluate', { expression: `window.scrollTo({ top: ${top}, behavior: 'instant' });` });
      await sleep(500);

      const data = await sendPage('Runtime.evaluate', {
        expression: `(() => {
          const imgWrap = document.querySelector('.framer-1c97q5r') || document.querySelector('[data-framer-name*="Parallax"]');
          if (!imgWrap) return { error: 'not found' };
          const img = imgWrap.querySelector('img');
          const r = imgWrap.getBoundingClientRect();
          const s = window.getComputedStyle(imgWrap);
          const imgS = img ? window.getComputedStyle(img) : null;
          return {
            scroll: window.scrollY,
            rect: { top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
            transform: s.transform,
            width: s.width,
            borderRadius: s.borderRadius,
            imgTransform: imgS ? imgS.transform : null
          };
        })()`,
        returnByValue: true
      });
      results.push(data.result.value);
    }

    console.log('Parallax Image Animation Data:\n', JSON.stringify(results, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

