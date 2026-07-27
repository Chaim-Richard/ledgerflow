const fs = require('fs');
const file = 'src/hooks/useSystemContext.ts';
let content = fs.readFileSync(file, 'utf8');

// Use regex to remove export function useSystemProps(...) { ... }
// Since it's a huge function, we can slice it
const startIndex = content.indexOf('export function useSystemProps');
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
  fs.writeFileSync(file, content);
}
