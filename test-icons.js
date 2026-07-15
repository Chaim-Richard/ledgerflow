import fs from 'fs';
const code = fs.readFileSync('./src/config/registry.tsx', 'utf8');
const iconMatches = code.match(/icon:\s*([A-Za-z0-9_]+)/g);
console.log(iconMatches);
