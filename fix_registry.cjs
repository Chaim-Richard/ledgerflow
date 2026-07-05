const fs = require('fs');
let content = fs.readFileSync('src/config/registry.tsx', 'utf8');

const lines = content.split('\n');
const seen = new Set();
const outLines = [];

let inMap = false;

for (let line of lines) {
  if (line.includes("export const appRegistry: Record<string, any> = {")) {
    inMap = true;
    outLines.push(line);
    continue;
  }
  
  if (inMap && line.trim().startsWith("'") && line.includes("': lazy(")) {
    const keyMatch = line.match(/'([^']+)'/);
    if (keyMatch) {
      const key = keyMatch[1];
      if (seen.has(key)) {
        continue; // skip duplicate
      }
      seen.add(key);
    }
  }
  
  outLines.push(line);
  if (inMap && line.trim() === "};") {
    inMap = false;
  }
}

fs.writeFileSync('src/config/registry.tsx', outLines.join('\n'));
console.log('Fixed registry');
