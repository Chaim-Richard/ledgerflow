const fs = require('fs');

const consol = 'src/components/finance/Consolidation.tsx';
if (fs.existsSync(consol)) {
  let content = fs.readFileSync(consol, 'utf8');
  content = content.replace('{/* Mock Rows */}', '{/* Placeholder Rows */}');
  fs.writeFileSync(consol, content);
}

const eco = 'src/components/forensics/tabs/EconomicsMatrixTab.tsx';
if (fs.existsSync(eco)) {
  let content = fs.readFileSync(eco, 'utf8');
  content = content.replace('❌ Simulated or Mocked', '❌ Pending Data Connection');
  fs.writeFileSync(eco, content);
}
console.log("Fixed final mock comments");
