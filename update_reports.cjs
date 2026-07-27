const fs = require('fs');
const file = 'src/components/reporting/Reports.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/interface ReportsProps {[\s\S]*?}/, '');
content = content.replace(/const Reports = React\.memo\(\(\{ transactions = \[\], accounts = \[\], projects = \[\], budgets = \[\], onAction \}: ReportsProps\) => \{/, 'import { useLedgerStore } from \'../../stores/useLedgerStore\';\nimport { useCommandDispatcher } from \'../../hooks/useSystemContext\';\n\nconst Reports = React.memo(() => {\n  const transactions = useLedgerStore(s => s.transactions);\n  const accounts = useLedgerStore(s => s.accounts);\n  const projects = useLedgerStore(s => s.projects);\n  const budgets = useLedgerStore(s => s.budgets);\n  const { handleAction: onAction } = useCommandDispatcher();');

fs.writeFileSync(file, content);
