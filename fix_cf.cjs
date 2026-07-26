const fs = require('fs');
const path = require('path');
let cfPath = path.join(__dirname, 'src/components/ledger/CashFlowView.tsx');
if (fs.existsSync(cfPath)) {
  let cf = fs.readFileSync(cfPath, 'utf8');
  cf = cf.replace(/acc\.type === 'income'/g, `(acc.type === 'income' || acc.type === 'revenue')`);
  cf = cf.replace(/acc\.type === 'expense'/g, `(acc.type === 'expense' || acc.type === 'cost_of_goods')`);
  fs.writeFileSync(cfPath, cf);
}
