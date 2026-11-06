const https = require('https');
const fs = require('fs');
const path = require('path');

const vendorDir = path.resolve(__dirname, '..', 'assets', 'vendor');
if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir, { recursive: true });

const files = [
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', name: 'gsap.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js', name: 'ScrollTrigger.min.js' },
  { url: 'https://unpkg.com/lenis@1.1.18/dist/lenis.min.js', name: 'lenis.min.js' }
];

function download(item) {
  return new Promise((resolve, reject) => {
    const dest = path.join(vendorDir, item.name);
    https.get(item.url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, res2 => {
          const stream = fs.createWriteStream(dest);
          res2.pipe(stream);
          stream.on('finish', () => { stream.close(); resolve(dest); });
        }).on('error', reject);
        return;
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(dest); });
    }).on('error', reject);
  });
}

async function run() {
  for (let f of files) {
    console.log('Downloading', f.name, '...');
    const p = await download(f);
    console.log('Saved to', p, '(size:', fs.statSync(p).size, ')');
  }
}

run().catch(console.error);

