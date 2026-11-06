const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9286;

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
        const sec = document.getElementById('locations') || document.querySelector('.framer-1cs5c92');
        if (!sec) return { error: 'not found' };
        
        const imgs = Array.from(sec.querySelectorAll('img')).map(i => ({
          src: i.src,
          alt: i.alt,
          rect: i.getBoundingClientRect(),
          classes: i.className
        }));

        // check scroll animation or code-component
        const codeComponents = Array.from(sec.querySelectorAll('[data-code-component-plugin-id]')).map(c => ({
          id: c.id,
          outerHTML: c.outerHTML.slice(0, 300)
        }));

        // find the image container
        let imgContainer = sec.querySelector('[data-framer-name*="Photo"]') || sec.querySelector('[data-framer-name*="Image"]') || sec.querySelector('img')?.parentElement;

        return {
          id: sec.id,
          className: sec.className,
          name: sec.getAttribute('data-framer-name'),
          rect: sec.getBoundingClientRect(),
          imgs,
          codeComponents,
          imgContainerHTML: imgContainer ? imgContainer.outerHTML.slice(0, 600) : null,
          innerStructure: Array.from(sec.children).map(c => ({
            tag: c.tagName,
            class: c.className,
            name: c.getAttribute('data-framer-name'),
            rect: c.getBoundingClientRect()
          }))
        };
      })()`,
      returnByValue: true
    });

    console.log('Locations / Moritz section info:\n', JSON.stringify(data.result.value, null, 2));

  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
