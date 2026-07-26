const fs = require('fs');
const path = require('path');

// Fix ProfitAndLossView
let pnlPath = path.join(__dirname, 'src/components/ledger/ProfitAndLossView.tsx');
if (fs.existsSync(pnlPath)) {
  let pnl = fs.readFileSync(pnlPath, 'utf8');
  pnl = pnl.replace(
    `const revenue = accounts.filter(a => a.type === 'income');`,
    `const revenue = accounts.filter(a => a.type === 'income' || a.type === 'revenue');`
  );
  pnl = pnl.replace(
    `const expenses = accounts.filter(a => a.type === 'expense');`,
    `const expenses = accounts.filter(a => a.type === 'expense' || a.type === 'cost_of_goods');`
  );
  pnl = pnl.replace(
    `if (acc.type === 'income') {`,
    `if (acc.type === 'income' || acc.type === 'revenue') {`
  );
  pnl = pnl.replace(
    `} else if (acc.type === 'expense') {`,
    `} else if (acc.type === 'expense' || acc.type === 'cost_of_goods') {`
  );
  fs.writeFileSync(pnlPath, pnl);
}

// Fix BalanceSheetView
let bsPath = path.join(__dirname, 'src/components/ledger/BalanceSheetView.tsx');
if (fs.existsSync(bsPath)) {
  let bs = fs.readFileSync(bsPath, 'utf8');
  bs = bs.replace(
    `const isDebitNature = acc.type === 'asset' || acc.type === 'expense';`,
    `const isDebitNature = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';`
  );
  bs = bs.replace(
    `const isDebitNature = acc.type === 'asset' || acc.type === 'expense';`,
    `const isDebitNature = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';`
  );
  bs = bs.replace(
    `else if (acc.type === 'income') income[id] = (income[id] || 0) + delta;`,
    `else if (acc.type === 'income' || acc.type === 'revenue') income[id] = (income[id] || 0) + delta;`
  );
  bs = bs.replace(
    `else if (acc.type === 'expense') expense[id] = (expense[id] || 0) + delta;`,
    `else if (acc.type === 'expense' || acc.type === 'cost_of_goods') expense[id] = (expense[id] || 0) + delta;`
  );
  bs = bs.replace(
    `else if (acc.type === 'income') income[acc.id] = initVal;`,
    `else if (acc.type === 'income' || acc.type === 'revenue') income[acc.id] = initVal;`
  );
  bs = bs.replace(
    `else if (acc.type === 'expense') expense[acc.id] = initVal;`,
    `else if (acc.type === 'expense' || acc.type === 'cost_of_goods') expense[acc.id] = initVal;`
  );
  fs.writeFileSync(bsPath, bs);
}

console.log("Fixed views");
