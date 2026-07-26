const fs = require('fs');
let code = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');

// We just remove the blocks that we don't need
const toRemove = ['pnl', 'balance', 'cashflow', 'aging', 'reconciliation', 'budgets', 'tax', 'audit', 'inbox'];

toRemove.forEach(tab => {
  const regex = new RegExp(`\\{\\s*activeSubTab === '${tab}' && \\([\\s\\S]*?\\)\\s*\\}`, 'g');
  code = code.replace(regex, '');
});

fs.writeFileSync('src/components/ledger/Ledger.tsx', code);
