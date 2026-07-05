const fs = require('fs');

function replaceFile(path, from, to) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(from, to);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('src/components/intelligence/IntelligenceCenter.tsx', /map\(\(item\) =>/g, 'map((item: any) =>');
replaceFile('src/components/layout/InstructionGuide.tsx', /map\(\(_, i\)/g, 'map((_: any, i: number)');
replaceFile('src/components/layout/InstructionGuide.tsx', /map\(\(i\)/g, 'map((i: any)');
replaceFile('src/components/layout/InstructionGuide.tsx', /\(_, i\)/g, '(_: any, i: number)');
replaceFile('src/components/layout/InstructionGuide.tsx', /\(item, i\)/g, '(item: any, i: number)');

console.log('Fixed lint issues 3');
