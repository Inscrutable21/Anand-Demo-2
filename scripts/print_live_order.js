const fs = require('fs');
const structure = JSON.parse(fs.readFileSync('site_structure.json', 'utf8'));

// Filter top-level or main sections
const sections = structure.filter(s => ['SECTION', 'FOOTER', 'HEADER'].includes(s.tag) || (s.id && ['bigtext', 'apartments', 'locations', 'philosophy'].includes(s.id)));
console.log('--- LIVE SECTIONS IN ORDER ---');
sections.forEach((s, i) => {
  console.log(`${i}: Tag=<${s.tag}> ID="${s.id}" Name="${s.name}" Class="${s.className}" Text="${s.text.slice(0, 60)}"`);
});

