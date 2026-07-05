const fs = require('fs');
const glob = require('child_process').execSync('grep -rl "MOCK_" src/components').toString().trim().split('\n');

for (const file of glob) {
  if (!file) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Find all definitions of MOCK_*
  const mockRegex = /const\s+MOCK_[A-Z0-9_]+\s*=\s*\[[\s\S]*?\];/g;
  
  content = content.replace(mockRegex, '');
  changed = true;
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
