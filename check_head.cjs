const fs = require('fs');
const content = fs.readFileSync('src/components/layout/Header.tsx', 'utf8');
const textClasses = new Set();
const regex = /text-[a-z0-9-]+/g;
let match;
while ((match = regex.exec(content)) !== null) {
  textClasses.add(match[0]);
}
console.log('Header classes:', Array.from(textClasses).sort());
