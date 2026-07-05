const fs = require('fs');
const path = require('path');

function replaceColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/\[#eceeef\]/g, 'slate-200');
  content = content.replace(/\[#e9ebeb\]/g, 'slate-200');
  content = content.replace(/\[#e2e4e4\]/g, 'slate-300');
  content = content.replace(/\[#818a91\]/g, 'slate-500');
  content = content.replace(/\[#555f61\]/g, 'slate-600');
  content = content.replace(/\[#fcfdfe\]/g, 'slate-50');
  fs.writeFileSync(filePath, content);
}

const dir = 'src/components';
function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceColorsInFile(fullPath);
    }
  });
}

traverseDir(dir);
console.log('Replaced colors');
