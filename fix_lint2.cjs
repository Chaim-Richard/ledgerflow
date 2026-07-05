const fs = require('fs');

function replaceFile(path, from, to) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(from, to);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('src/components/finance/TagsDimensions.tsx', /v: any =>/g, '(v: any) =>');
replaceFile('src/components/intelligence/IntelligenceCenter.tsx', /item: any =>/g, '(item: any) =>');
replaceFile('src/components/intelligence/IntelligenceCenter.tsx', /i: any =>/g, '(i: any) =>');
replaceFile('src/components/system/WebhookManager.tsx', /e: any =>/g, '(e: any) =>');

console.log('Fixed lint issues 2');
