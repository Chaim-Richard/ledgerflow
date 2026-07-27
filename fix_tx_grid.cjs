const fs = require('fs');
let file = 'src/components/ledger/TransactionGrid.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { useCommandDispatcher }')) {
    content = content.replace(/import \{ useTransactionActions \} from '\.\.\/\.\.\/hooks\/useTransactionActions';/, "import { useTransactionActions } from '../../hooks/useTransactionActions';\nimport { useCommandDispatcher } from '../../hooks/useSystemContext';\nimport { useEntityOperations } from '../../hooks/useEntityOperations';");
}

content = content.replace(/interface TransactionGridProps {[\s\S]*?}/, '');
content = content.replace(/export default function TransactionGrid\(\{[\s\S]*?\}\: TransactionGridProps\) \{/, `export default function TransactionGrid() {
  const transactions = useLedgerStore(s => s.transactions);
  const filterCriteria = useUIStore(s => s.filterCriteria);
  const onFilterApplied = (c) => useUIStore.getState().setFilterCriteria(c);
  const { handleAction: onAction } = useCommandDispatcher();
  const txActions = useTransactionActions();
  const { updateEntity, deleteEntity } = useEntityOperations();
  const onUpdate = (id, updates) => updateEntity('transactions', id, updates);
  const onVoid = (id) => deleteEntity('transactions', id);
  const onNewEntry = () => txActions.handleQuickAdd?.() || onAction('quick-entry');
  const onImport = () => onAction('open-importer');
  const onOpenImporter = () => onAction('open-importer');
  const onCreateRule = (tx) => {}; // not fully implemented here
  const categories = useLedgerStore(s => s.categories) || [];
  const isProMode = false;
  const isCompactMode = false;
  const dateFormat = 'MMM dd, yyyy';
  const passedAnomalies = undefined;`);

fs.writeFileSync(file, content);
