const fs = require('fs');
const file = 'src/components/intelligence/IntelligenceCenter.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace interface
content = content.replace(/interface AnalyticalCenterProps {[\s\S]*?}/, '');
content = content.replace(/export default function AnalyticalCenter\(\{[\s\S]*?\}\: AnalyticalCenterProps\) {/, 'import { useLedgerStore } from \'../../stores/useLedgerStore\';\nimport { useUIStore } from \'../../stores/useUIStore\';\nimport { useCommandDispatcher } from \'../../hooks/useSystemContext\';\nimport { useAuditTelemetry } from \'../../hooks/useAuditTelemetry\';\n\nexport default function AnalyticalCenter() {\n  const transactions = useLedgerStore(s => s.transactions);\n  const accounts = useLedgerStore(s => s.accounts);\n  const projects = useLedgerStore(s => s.projects);\n  const bills = useLedgerStore(s => s.bills);\n  const invoices = useLedgerStore(s => s.invoices);\n  const filterCriteria = useUIStore(s => s.filterCriteria);\n  const { handleAction: onAction } = useCommandDispatcher();\n  const computedAccounts = useLedgerStore(s => s.computedAccounts);\n  const passedMetrics = useAuditTelemetry(transactions, computedAccounts);');

fs.writeFileSync(file, content);
