const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getFiles(path.join(__dirname, 'src', 'components'));

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  const regex = /const\s+(\w+)\s*=\s*\[\s*\{[\s\S]*?\}\s*(?:,\s*)?\];/g;
  let wasModified = false;
  
  content = content.replace(regex, (match, p1) => {
    const ignore = [
      'NAV_GROUPS', 'plugins', 'routes', 'tabs', 'items', 'NAV_ITEMS', 
      'links', 'navigation', 'menuItems', 'groups', 'metrics', 'stats', 'kpis'
    ];
    if (ignore.includes(p1)) {
      return match;
    }
    wasModified = true;
    return `const ${p1}: any[] = [];`;
  });
  
  if (wasModified) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Modified ${file}`);
  }
}

console.log(`Total files modified: ${modifiedCount}`);
