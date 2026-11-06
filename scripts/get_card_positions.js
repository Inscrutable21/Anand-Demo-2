const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9275;

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

    const positions = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/apartments/"]'));
        return links.map((a, i) => {
          const r = a.getBoundingClientRect();
          const img = a.querySelector('img');
          const imgR = img ? img.getBoundingClientRect() : null;
          const s = window.getComputedStyle(a);
          const parentS = window.getComputedStyle(a.parentElement);
          return {
            index: i,
            title: a.innerText.split('\\n')[0],
            top: Math.round(r.top + window.scrollY),
            left: Math.round(r.left),
            width: Math.round(r.width),
            height: Math.round(r.height),
            imgHeight: imgR ? Math.round(imgR.height) : null,
            imgWidth: imgR ? Math.round(imgR.width) : null,
            parentTopMargin: parentS.marginTop,
            parentTransform: parentS.transform,
            styleTop: s.top,
            styleTransform: s.transform
          };
        });
      })()`,
      returnByValue: true
    });

    console.log('Apartments Card Positions on casamomo.at:\n', JSON.stringify(positions.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
