const fs = require('fs');
let file1 = 'src/components/ledger/Reconciliation.tsx';
let recon = fs.readFileSync(file1, 'utf8');
const reconImports = `import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTransactionActions } from '../../hooks/useTransactionActions';\n`;
if (!recon.includes('useLedgerStore')) recon = reconImports + recon;
fs.writeFileSync(file1, recon);

let file2 = 'src/components/planning/BudgetManager.tsx';
let bm = fs.readFileSync(file2, 'utf8');
const bmImports = `import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';\n`;
if (!bm.includes('useLedgerStore')) bm = bmImports + bm;

bm = bm.replace(/const user = useAuthStore\(s => s.user\);/g, 'const user = useAuthStore((s: any) => s.user);');
bm = bm.replace(/const budgets = useLedgerStore\(s => s.budgets\);/g, 'const budgets = useLedgerStore((s: any) => s.budgets);');
bm = bm.replace(/const transactions = useLedgerStore\(s => s.transactions\);/g, 'const transactions = useLedgerStore((s: any) => s.transactions);');
bm = bm.replace(/const accounts = useLedgerStore\(s => s.accounts\);/g, 'const accounts = useLedgerStore((s: any) => s.accounts);');
bm = bm.replace(/const onAutoReconcile = txActions\.handleAutoReconcile;/g, '');

bm = bm.replace(/budgets\.map\(\(budget\)/, 'budgets.map((budget: any)');
bm = bm.replace(/reduce\(\(sum, t\)/, 'reduce((sum: number, t: any)');
bm = bm.replace(/filter\(l =>/, 'filter((l: any) =>');
bm = bm.replace(/reduce\(\(s, l\)/, 'reduce((s: number, l: any)');
bm = bm.replace(/b\.id ===/, '(b: any) => b.id ===');
bm = bm.replace(/acc\.id/, '(acc: any) => acc.id');

fs.writeFileSync(file2, bm);
