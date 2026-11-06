const { execFileSync } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const outPath = path.resolve(__dirname, '..', 'local_hero_test.png');

console.log('Capturing:', htmlPath);
execFileSync(chromePath, [
  '--headless=new',
  '--screenshot=' + outPath,
  '--window-size=1440,900',
  '--virtual-time-budget=2000',
  htmlPath
]);

console.log('Screenshot saved to:', outPath);

