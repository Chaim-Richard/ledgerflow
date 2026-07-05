const fs = require('fs');
const content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('{/* Perspective Segmented Control */}'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('</div>')); // wait, nested 

console.log(startIndex);
