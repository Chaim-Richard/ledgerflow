const fs = require('fs');
const path = require('path');
let bsPath = path.join(__dirname, 'src/components/ledger/BalanceSheetView.tsx');
let bs = fs.readFileSync(bsPath, 'utf8');
bs = bs.replace(/acc\.type === 'income'/g, `(acc.type === 'income' || acc.type === 'revenue')`);
bs = bs.replace(/acc\.type === 'expense'/g, `(acc.type === 'expense' || acc.type === 'cost_of_goods')`);
fs.writeFileSync(bsPath, bs);
