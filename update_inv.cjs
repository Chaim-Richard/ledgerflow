const fs = require('fs');
const file = 'src/components/inventory/Inventory.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/interface InventoryProps {[\s\S]*?}/, '');
content = content.replace(/export default function Inventory\(\{ workspaceId, uid, formatCurrency \}: InventoryProps\) \{/, 'import { useAuthStore } from \'../../stores/useAuthStore\';\nimport { formatCurrency } from \'../../lib/utils\';\n\nexport default function Inventory() {\n  const workspaceId = useAuthStore(s => s.currentWorkspaceId);\n  const uid = useAuthStore(s => s.user?.uid);');

fs.writeFileSync(file, content);
