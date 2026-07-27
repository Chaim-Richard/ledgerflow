const fs = require('fs');
const file = 'src/components/planning/CashFlowPredictor.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "if (l.accountId === 'cash') {",
  "const acc = useLedgerStore.getState().accounts.find(a => a.id === l.accountId);\n        if (acc && (acc.type === 'asset' && acc.category?.toLowerCase().includes('cash'))) {"
);

fs.writeFileSync(file, content);
console.log("Patched CashFlowPredictor");
