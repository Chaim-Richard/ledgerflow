const fs = require('fs');
let file = 'src/components/planning/BudgetManager.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('useAuthStore')) {
  content = content.replace(/import \{ useLedgerStore \} from '\.\.\/\.\.\/stores\/useLedgerStore';/, "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { useAuthStore } from '../../stores/useAuthStore';");
}

content = content.replace(/interface BudgetManagerProps {[\s\S]*?}/, '');
content = content.replace(/export default function BudgetManager\(\{ budgets = \[\], transactions = \[\], accounts = \[\], user \}\: BudgetManagerProps = \{\}\) \{/, `export default function BudgetManager() {
  const user = useAuthStore(s => s.user);
  const budgets = useLedgerStore(s => s.budgets);
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);`);

fs.writeFileSync(file, content);
