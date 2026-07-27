const fs = require('fs');
let file = 'src/components/ledger/Reconciliation.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('useTransactionActions')) {
  content = content.replace(/import \{ useLedgerStore \} from '\.\.\/\.\.\/stores\/useLedgerStore';/, "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { useAuthStore } from '../../stores/useAuthStore';\nimport { useTransactionActions } from '../../hooks/useTransactionActions';");
}

content = content.replace(/interface ReconciliationProps {[\s\S]*?}/, '');
content = content.replace(/export default function Reconciliation\(\{[\s\S]*?\}\: ReconciliationProps\) \{/, `export default function Reconciliation() {
  const user = useAuthStore(s => s.user);
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  const transactions = useLedgerStore(s => s.transactions);
  const bankLines = useLedgerStore(s => s.bankLines || []);
  const accounts = useLedgerStore(s => s.accounts);
  const txActions = useTransactionActions();
  const onMatch = txActions.handleReconcileMatch;
  const onIgnore = txActions.handleReconcileIgnore;
  const onAddFromBank = txActions.handleReconcileCreate;
  const onAutoReconcile = txActions.handleAutoReconcile;
  const onUndoMatch = txActions.handleReconcileUndo;`);

fs.writeFileSync(file, content);
