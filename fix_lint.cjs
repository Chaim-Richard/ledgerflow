const fs = require('fs');

function replaceFile(path, from, to) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(from, to);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('src/components/finance/TagsDimensions.tsx', /v =>/g, 'v: any =>');
replaceFile('src/components/intelligence/IntelligenceCenter.tsx', /item =>/g, 'item: any =>');
replaceFile('src/components/intelligence/IntelligenceCenter.tsx', /\(item, i\)/g, '(item: any, i: number)');
replaceFile('src/components/intelligence/IntelligenceCenter.tsx', /i =>/g, 'i: any =>');
replaceFile('src/components/layout/InstructionGuide.tsx', /\(item, i\)/g, '(item: any, i: number)');
replaceFile('src/components/operations/ManufacturingRoutings.tsx', /\(c, i\)/g, '(c: any, i: number)');
replaceFile('src/components/system/WebhookManager.tsx', /e =>/g, 'e: any =>');

console.log('Fixed lint issues');
