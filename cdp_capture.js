const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWebSocketUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}/json/version`, res => {
          let str = '';
          res.on('data', d => str += d);
          res.on('end', () => resolve(JSON.parse(str)));
        }).on('error', reject);
      });
      if (data && data.webSocketDebuggerUrl) {
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {
      await sleep(250);
    }
  }
  throw new Error('Failed to connect to Chrome debugging port');
}

async function run() {
  console.log('Launching Chrome in headless mode with remote debugging...');
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'about:blank'
  ]);

  try {
    const wsUrl = await getWebSocketUrl();
    console.log('Connected to Chrome CDP:', wsUrl);

    const ws = new WebSocket(wsUrl);
    let idCounter = 1;
    const pending = new Map();

    ws.onmessage = (msg) => {
      const parsed = JSON.parse(msg.data);
      if (parsed.id && pending.has(parsed.id)) {
        const { resolve, reject } = pending.get(parsed.id);
        pending.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };

    await new Promise(r => ws.onopen = r);

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = idCounter++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Create a new target / page
    const { targetId } = await send('Target.createTarget', { url: 'https://www.casamomo.at/' });
    console.log('Target created:', targetId);

    // Get page ws
    const targets = await send('Target.getTargets');
    const targetList = targets.targetInfos || targets.targetInfoList || [];
    const pageTarget = targetList.find(t => t.targetId === targetId);
    
    // Connect to page
    const pageWs = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${targetId}`);
    await new Promise(r => pageWs.onopen = r);
    
    let pId = 1;
    const pPending = new Map();
    pageWs.onmessage = (msg) => {
      const parsed = JSON.parse(msg.data);
      if (parsed.id && pPending.has(parsed.id)) {
        const { resolve, reject } = pPending.get(parsed.id);
        pPending.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };

    function sendPage(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = pId++;
        pPending.set(id, { resolve, reject });
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendPage('Page.enable');
    await sendPage('DOM.enable');
    await sendPage('Runtime.enable');

    console.log('Navigating to https://www.casamomo.at/...');
    await sendPage('Page.navigate', { url: 'https://www.casamomo.at/' });

    // Wait 5 seconds for preloader and intro animations to complete
    console.log('Waiting 5s for animations...');
    await sleep(5000);

    // Capture Hero state screenshot
    const shot1 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('shot_hero.png', Buffer.from(shot1.data, 'base64'));
    console.log('Captured shot_hero.png');

    // Scroll to 800px (Between quiet minimalism...)
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 800, behavior: "instant"});' });
    await sleep(1500);
    const shot2 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('shot_tunnel1.png', Buffer.from(shot2.data, 'base64'));
    console.log('Captured shot_tunnel1.png');

    // Scroll to 2000px (Tunnel depth)
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 2200, behavior: "instant"});' });
    await sleep(1500);
    const shot3 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('shot_tunnel2.png', Buffer.from(shot3.data, 'base64'));
    console.log('Captured shot_tunnel2.png');

    // Scroll to 3600px (Philosophy / Apartments)
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 3600, behavior: "instant"});' });
    await sleep(1500);
    const shot4 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('shot_apartments.png', Buffer.from(shot4.data, 'base64'));
    console.log('Captured shot_apartments.png');

    // Scroll to 5200px (Host / Moritz)
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 5400, behavior: "instant"});' });
    await sleep(1500);
    const shot5 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('shot_host.png', Buffer.from(shot5.data, 'base64'));
    console.log('Captured shot_host.png');

    // Scroll to 7000px (Footer)
    await sendPage('Runtime.evaluate', { expression: 'window.scrollTo({top: 7200, behavior: "instant"});' });
    await sleep(1500);
    const shot6 = await sendPage('Page.captureScreenshot');
    fs.writeFileSync('shot_footer.png', Buffer.from(shot6.data, 'base64'));
    console.log('Captured shot_footer.png');

    // Dump full page text structure
    const domInfo = await sendPage('Runtime.evaluate', {
      expression: `
        Array.from(document.querySelectorAll('section, [data-framer-name]')).map(el => {
          return {
            name: el.getAttribute('data-framer-name') || el.tagName,
            tag: el.tagName,
            id: el.id,
            className: el.className,
            text: el.innerText ? el.innerText.substring(0, 100).replace(/\\s+/g, ' ') : ''
          };
        }).filter(item => item.text.length > 5)
      `,
      returnByValue: true
    });
    fs.writeFileSync('site_structure.json', JSON.stringify(domInfo.result.value, null, 2), 'utf8');
    console.log('Saved site_structure.json with live section hierarchy!');

    ws.close();
    pageWs.close();
  } finally {
    chromeProc.kill();
    console.log('Chrome closed.');
  }
}

run().catch(console.error);
