const fs = require('fs');
const file = 'src/components/sales/Sales.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/interface SalesProps {[\s\S]*?}/, '');
content = content.replace(/export default function Sales\(\{[\s\S]*?\}\: SalesProps\) \{/, 'import { useAuthStore } from \'../../stores/useAuthStore\';\nimport { useLedgerStore } from \'../../stores/useLedgerStore\';\nimport { useEntityOperations } from \'../../hooks/useEntityOperations\';\n\nexport default function Sales() {\n  const user = useAuthStore(s => s.user);\n  const invoices = useLedgerStore(s => s.invoices);\n  const customers = useLedgerStore(s => s.customers);\n  const accounts = useLedgerStore(s => s.accounts);\n  const { addEntity, updateEntity } = useEntityOperations();\n  const onAddInvoice = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity(\'invoices\', id, updates); } return addEntity(\'invoices\', data); };\n  const onAddCustomer = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity(\'customers\', id, updates); } return addEntity(\'customers\', data); };');

fs.writeFileSync(file, content);
