const { spawn } = require('child_process');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9260;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
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

    const gridInfo = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        const list = document.querySelector('.framer-cbil4k') || document.querySelector('#mefgjz');
        const item1 = document.querySelector('.framer-fdgjuz');
        const link1 = item1 ? item1.querySelector('a') : null;
        const img1 = link1 ? link1.querySelector('img') : null;
        const detailsPill = document.querySelector('.framer-1swxj4p') || document.querySelector('[data-framer-name="Apartment Details"]');

        function styles(el) {
          if (!el) return null;
          const s = window.getComputedStyle(el);
          return {
            display: s.display,
            gridTemplateColumns: s.gridTemplateColumns,
            gap: s.gap,
            padding: s.padding,
            margin: s.margin,
            width: s.width,
            height: s.height,
            backgroundColor: s.backgroundColor,
            borderRadius: s.borderRadius
          };
        }

        const innerHTML1 = item1 ? item1.outerHTML : '';

        return {
          listStyles: styles(list),
          itemStyles: styles(item1),
          linkStyles: styles(link1),
          imgStyles: styles(img1),
          firstCardHTML: innerHTML1.slice(0, 1500)
        };
      })()`,
      returnByValue: true
    });

    console.log('Grid & Card Styles:', JSON.stringify(gridInfo.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

