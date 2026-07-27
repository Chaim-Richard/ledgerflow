const fs = require('fs');
const file = 'src/components/purchases/Purchases.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/interface PurchasesProps {[\s\S]*?}/, '');
content = content.replace(/export default function Purchases\(\{[\s\S]*?\}\: PurchasesProps\) \{/, 'import { useAuthStore } from \'../../stores/useAuthStore\';\nimport { useLedgerStore } from \'../../stores/useLedgerStore\';\nimport { useEntityOperations } from \'../../hooks/useEntityOperations\';\n\nexport default function Purchases() {\n  const user = useAuthStore(s => s.user);\n  const bills = useLedgerStore(s => s.bills);\n  const vendors = useLedgerStore(s => s.vendors);\n  const accounts = useLedgerStore(s => s.accounts);\n  const { addEntity, updateEntity } = useEntityOperations();\n  const onAddBill = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity(\'bills\', id, updates); } return addEntity(\'bills\', data); };\n  const onUpdateBill = (id: string, updates: any) => updateEntity(\'bills\', id, updates);\n  const onAddVendor = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity(\'vendors\', id, updates); } return addEntity(\'vendors\', data); };');

fs.writeFileSync(file, content);
