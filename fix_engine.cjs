const fs = require('fs');
const path = require('path');

let enginePath = path.join(__dirname, 'src/lib/ledger-engine.ts');
let engine = fs.readFileSync(enginePath, 'utf8');

engine = engine.replace(
  `const accountTypeMap = new Map<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense'>();`,
  `const accountTypeMap = new Map<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_goods' | 'revenue'>();`
);
engine = engine.replace(
  `const isDebitNature = type === 'asset' || type === 'expense';`,
  `const isDebitNature = type === 'asset' || type === 'expense' || type === 'cost_of_goods';`
);

fs.writeFileSync(enginePath, engine);
console.log("Fixed ledger-engine.ts.");
