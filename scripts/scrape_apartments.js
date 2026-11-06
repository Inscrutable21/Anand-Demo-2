const { spawn } = require('child_process');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9255;

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

    const aptInfo = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        const aptGrid = document.querySelector('#mefgjz') || document.querySelector('.framer-mefgjz') || document.querySelector('.framer-cbil4k');
        if (!aptGrid) return { error: 'grid not found' };
        
        // Find all apartment cards/links
        const links = Array.from(document.querySelectorAll('a[href*="/apartments/"]'));
        const data = links.map(a => {
          const img = a.querySelector('img');
          const text = a.textContent.replace(/\\s+/g, ' ').trim();
          return {
            href: a.href,
            className: a.className,
            imgSrc: img ? (img.currentSrc || img.src) : null,
            imgAlt: img ? img.alt : '',
            text: text
          };
        });

        // also get computed styles of a card and the grid
        const firstLink = links[0];
        const cardStyle = firstLink ? {
          display: window.getComputedStyle(firstLink).display,
          borderRadius: window.getComputedStyle(firstLink).borderRadius,
          aspectRatio: window.getComputedStyle(firstLink).aspectRatio,
        } : null;

        return { count: links.length, data, cardStyle };
      })()`,
      returnByValue: true
    });

    console.log('Apartments Scrape Result:', JSON.stringify(aptInfo.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);

