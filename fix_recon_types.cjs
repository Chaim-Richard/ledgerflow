const fs = require('fs');
let file1 = 'src/components/ledger/Reconciliation.tsx';
let recon = fs.readFileSync(file1, 'utf8');

recon = recon.replace(/const user = useAuthStore\(s => s.user\);/g, 'const user = useAuthStore((s: any) => s.user);');
recon = recon.replace(/const workspaceId = useAuthStore\(s => s.currentWorkspaceId\);/g, 'const workspaceId = useAuthStore((s: any) => s.currentWorkspaceId);');
recon = recon.replace(/const transactions = useLedgerStore\(s => s.transactions\);/g, 'const transactions = useLedgerStore((s: any) => s.transactions);');
recon = recon.replace(/const bankLines = useLedgerStore\(s => s.bankLines \|\| \[\]\);/g, 'const bankLines = useLedgerStore((s: any) => s.bankLines || []);');
recon = recon.replace(/const accounts = useLedgerStore\(s => s.accounts\);/g, 'const accounts = useLedgerStore((s: any) => s.accounts);');

fs.writeFileSync(file1, recon);
