const fs = require('fs');
const path = require('path');
let storePath = path.join(__dirname, 'src/stores/useLedgerStore.ts');
let store = fs.readFileSync(storePath, 'utf8');
store = store.replace(
  `const isDebit = acc.type === 'asset' || acc.type === 'expense';`,
  `const isDebit = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';`
);
fs.writeFileSync(storePath, store);
