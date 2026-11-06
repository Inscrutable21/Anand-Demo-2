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

    console.log('Waiting 5s for casamomo.at...');
    await sleep(5000);

    const info = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        // Find bigtext element
        const bigtext = document.getElementById('bigtext');
        // Find next element
        let next = bigtext ? bigtext.nextElementSibling : null;
        let img = null;
        let el = null;
        // search for images between bigtext and apartments
        const imgs = document.querySelectorAll('img');
        const list = [];
        imgs.forEach(i => {
          const rect = i.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          list.push({ src: i.src, currentSrc: i.currentSrc, top: Math.round(top), alt: i.alt, width: rect.width, height: rect.height });
        });
        
        // Find the container after bigtext
        const parallaxContainer = document.querySelector('[data-framer-name*="Parallax"]') || document.querySelector('.framer-1c97q5r');
        let containerHTML = parallaxContainer ? parallaxContainer.outerHTML.slice(0, 500) : 'not found';
        let styles = parallaxContainer ? window.getComputedStyle(parallaxContainer) : null;

        return {
          list,
          parallaxContainer: parallaxContainer ? {
            tag: parallaxContainer.tagName,
            class: parallaxContainer.className,
            name: parallaxContainer.getAttribute('data-framer-name'),
            width: styles ? styles.width : null,
            maxWidth: styles ? styles.maxWidth : null,
            borderRadius: styles ? styles.borderRadius : null,
            overflow: styles ? styles.overflow : null
          } : null,
          containerHTML
        };
      })()`,
      returnByValue: true
    });

    console.log('Parallax info:\n', JSON.stringify(info.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
