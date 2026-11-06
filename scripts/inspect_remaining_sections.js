const fs = require('fs');
const structure = JSON.parse(fs.readFileSync('site_structure.json', 'utf8'));

// Print all sections from index 5 to 10
const mainSections = structure.filter(s => 
  ['SECTION', 'FOOTER'].includes(s.tag) || 
  (s.id && ['locations', 'apartments-1', 'philosophy', 'locations-1'].includes(s.id))
);

console.log('--- DETAILED LIVE SECTIONS ---');
mainSections.forEach((s, idx) => {
  console.log(`\n=== SECTION ${idx}: ${s.name || s.id || s.tag} ===`);
  console.log('Tag:', s.tag, 'ID:', s.id, 'Class:', s.className);
  console.log('Text preview:', s.text.slice(0, 150));
});

