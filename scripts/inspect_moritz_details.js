const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9288;

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

    const details = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        const sec = document.getElementById('locations');
        if (!sec) return 'sec not found';
        const h2 = sec.querySelector('h2');
        const h2s = h2 ? window.getComputedStyle(h2) : null;
        const p = sec.querySelector('p');
        const ps = p ? window.getComputedStyle(p) : null;
        const wrap = sec.querySelector('.framer-iuarc1');
        const wraps = wrap ? window.getComputedStyle(wrap) : null;
        const img = sec.querySelector('img');
        const imgs = img ? window.getComputedStyle(img) : null;
        const btn = sec.querySelector('a, button');
        const btns = btn ? window.getComputedStyle(btn) : null;

        return {
          h2: h2 ? {
            text: h2.textContent,
            fontSize: h2s.fontSize,
            lineHeight: h2s.lineHeight,
            letterSpacing: h2s.letterSpacing,
            fontFamily: h2s.fontFamily,
            color: h2s.color,
            margin: h2s.margin
          } : null,
          p: p ? {
            fontSize: ps.fontSize,
            lineHeight: ps.lineHeight,
            letterSpacing: ps.letterSpacing,
            color: ps.color
          } : null,
          wrapper: wrap ? {
            display: wraps.display,
            gridTemplateColumns: wraps.gridTemplateColumns,
            gap: wraps.gap,
            flexDirection: wraps.flexDirection,
            alignItems: wraps.alignItems
          } : null,
          img: img ? {
            width: imgs.width,
            height: imgs.height,
            objectFit: imgs.objectFit
          } : null,
          btn: btn ? {
            text: btn.textContent,
            background: btns.backgroundColor,
            color: btns.color,
            borderRadius: btns.borderRadius,
            padding: btns.padding
          } : null
        };
      })()`,
      returnByValue: true
    });

    console.log('Details:\n', JSON.stringify(details.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
