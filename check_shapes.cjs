const fs = require('fs');
const content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
const classes = new Set();
const regex = /rounded-[a-z0-9-]+/g;
let match;
while ((match = regex.exec(content)) !== null) {
  classes.add(match[0]);
}
console.log('Dashboard rounded classes:', Array.from(classes).sort());

const shadowClasses = new Set();
const shadowRegex = /shadow-[a-z0-9-]+/g;
while ((match = shadowRegex.exec(content)) !== null) {
  shadowClasses.add(match[0]);
}
console.log('Dashboard shadow classes:', Array.from(shadowClasses).sort());
