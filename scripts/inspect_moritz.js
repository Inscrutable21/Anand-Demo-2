const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9285;

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

    const data = await sendPage('Runtime.evaluate', {
      expression: `(() => {
        // Find the "Hi, I'm Moritz" section
        let moritzSec = null;
        document.querySelectorAll('h1, h2, h3, h4, p').forEach(el => {
          if (el.textContent.includes("Hi, I'm Moritz") || el.textContent.includes("Hi, I’m Moritz")) {
            moritzSec = el.closest('section') || el.closest('[data-framer-name]');
          }
        });

        if (!moritzSec) {
          // search by text
          const sections = document.querySelectorAll('section');
          sections.forEach(s => {
            if (s.textContent.includes('Moritz')) moritzSec = s;
          });
        }

        if (!moritzSec) return { error: 'Moritz section not found' };

        const rect = moritzSec.getBoundingClientRect();
        const top = rect.top + window.scrollY;

        // Find image inside moritz section
        const img = moritzSec.querySelector('img');
        const imgWrap = img ? img.parentElement : null;
        const imgWrapParent = imgWrap ? imgWrap.parentElement : null;

        return {
          sectionTag: moritzSec.tagName,
          sectionClass: moritzSec.className,
          sectionName: moritzSec.getAttribute('data-framer-name'),
          top: Math.round(top),
          width: rect.width,
          height: rect.height,
          imgSrc: img ? img.src : null,
          imgCurrentSrc: img ? img.currentSrc : null,
          imgWrapHTML: imgWrapParent ? imgWrapParent.outerHTML.slice(0, 600) : null,
          sectionHTML: moritzSec.outerHTML.slice(0, 1500)
        };
      })()`,
      returnByValue: true
    });

    console.log('Moritz section info:\n', JSON.stringify(data.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
