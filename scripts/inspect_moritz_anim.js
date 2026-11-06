const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9287;

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
    setTimeout(() => reject(new Error('Timeout')), 7000);
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
    await sleep(4000);

    const pos = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        const sec = document.getElementById('locations');
        return sec ? Math.round(sec.getBoundingClientRect().top + window.scrollY) : 0;
      })()`,
      returnByValue: true
    });
    const secTop = pos.result.value;
    console.log('Moritz section top:', secTop);

    // Scroll around secTop and inspect .framer-1xxdtmy-container
    const scrollPoints = [secTop - 600, secTop - 300, secTop, secTop + 300, secTop + 600];
    const results = [];

    for (const top of scrollPoints) {
      await sendPage('Runtime.evaluate', { expression: `window.scrollTo({ top: ${top}, behavior: 'instant' });` });
      await sleep(300);

      const data = await sendPage('Runtime.evaluate', {
        expression: `(() => {
          const sec = document.getElementById('locations');
          const wrap = sec.querySelector('.framer-1xxdtmy-container');
          if (!wrap) return 'wrap not found';
          const r = wrap.getBoundingClientRect();
          const s = window.getComputedStyle(wrap);
          const child = wrap.firstElementChild;
          const cs = child ? window.getComputedStyle(child) : null;
          const img = wrap.querySelector('img');
          const is = img ? window.getComputedStyle(img) : null;

          return {
            scroll: window.scrollY,
            rect: { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) },
            transform: s.transform,
            borderRadius: s.borderRadius,
            clipPath: cs ? cs.clipPath : null,
            childTransform: cs ? cs.transform : null,
            imgSrc: img ? img.src : null,
            imgTransform: is ? is.transform : null
          };
        })()`,
        returnByValue: true
      });
      results.push(data.result.value);
    }

    console.log('Moritz image animation data:\n', JSON.stringify(results, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
