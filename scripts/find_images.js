const fs = require('fs');

const transcript = fs.readFileSync('C:/Users/poona/.gemini/antigravity/brain/300f2e47-5f04-4911-9967-35f1a7d2427f/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = transcript.split('\n');

for (const l of lines) {
  if (l.includes('boutique-n1') || l.includes('boutique-n2') || l.includes('framer-cbil4k')) {
    const urls = l.match(/https:\/\/[^"'\\<>\s]+\.(?:webp|jpg|png)/gi);
    if (urls) {
      console.log('URLs:', Array.from(new Set(urls)));
    }
  }
}

