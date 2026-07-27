const fs = require('fs');

let file1 = 'src/components/ledger/Reconciliation.tsx';
let recon = fs.readFileSync(file1, 'utf8');
if (!recon.includes('import { useLedgerStore }')) {
  recon = "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { useAuthStore } from '../../stores/useAuthStore';\nimport { useTransactionActions } from '../../hooks/useTransactionActions';\n" + recon;
}
fs.writeFileSync(file1, recon);

let file2 = 'src/components/planning/BudgetManager.tsx';
let bm = fs.readFileSync(file2, 'utf8');
if (!bm.includes('import { useLedgerStore }')) {
  bm = "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { useAuthStore } from '../../stores/useAuthStore';\n" + bm;
}
bm = bm.replace(/budgets\.map\(\(budget\)/g, 'budgets.map((budget: any)');
bm = bm.replace(/b => b.id ===/g, '(b: any) => b.id ===');
bm = bm.replace(/acc => acc.id/g, '(acc: any) => acc.id');
bm = bm.replace(/key=\{acc => acc.id\}/g, 'key={acc.id}');
fs.writeFileSync(file2, bm);

