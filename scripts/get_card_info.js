const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromeProc = spawn(CHROME_PATH, ['--remote-debugging-port=9265', '--headless=new', '--disable-gpu', '--no-sandbox', 'https://www.casamomo.at/']);

chromeProc.stderr.on('data', async d => {
  const m = d.toString().match(/DevTools listening on (ws:\/\/[^\s\r\n]+)/);
  if (m) {
    const ws = new WebSocket(m[1]);
    await new Promise(r => ws.onopen = r);
    let id = 1;
    const send = (method, params = {}) => new Promise(res => {
      const mid = id++;
      const handler = msg => {
        const p = JSON.parse(msg.data);
        if (p.id === mid) { ws.removeEventListener('message', handler); res(p.result); }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'https://www.casamomo.at/' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const sendP = (method, params = {}) => new Promise(res => {
      const mid = id++;
      const handler = msg => {
        const p = JSON.parse(msg.data);
        if (p.id === mid) { ws.removeEventListener('message', handler); res(p.result); }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: mid, sessionId, method, params }));
    });
    await sendP('Page.enable');
    await sendP('Runtime.enable');
    await new Promise(r => setTimeout(r, 4000));
    const res = await sendP('Runtime.evaluate', {
      expression: 'document.querySelector(".framer-fdgjuz").innerText',
      returnByValue: true
    });
    console.log('ITEM 1 TEXT:\n', res.result.value);
    const html = await sendP('Runtime.evaluate', {
      expression: 'document.querySelector(".framer-fdgjuz a").innerHTML',
      returnByValue: true
    });
    console.log('ITEM 1 INNER HTML (LAST 800 CHARS):\n', html.result.value.slice(-800));
    chromeProc.kill();
    process.exit(0);
  }
});

