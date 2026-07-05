const fs = require('fs');

function replaceFile(path, from, to) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(from, to);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('src/components/layout/InstructionGuide.tsx', /filter\(i =>/g, 'filter((i: any) =>');
replaceFile('src/components/layout/InstructionGuide.tsx', /filter\(s =>/g, 'filter((s: any) =>');

console.log('Fixed lint issues 5');
