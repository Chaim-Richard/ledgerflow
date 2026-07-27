const fs = require('fs');
const file = 'src/components/forensics/Vault.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace interface and component signature
content = content.replace(/interface VaultProps {[\s\S]*?}/, '');
content = content.replace(/export default function Vault\(\{ workspaceId, uid, transactions \}: VaultProps\) {/, 'import { useAuthStore } from \'../../stores/useAuthStore\';\nimport { useLedgerStore } from \'../../stores/useLedgerStore\';\n\nexport default function Vault() {\n  const workspaceId = useAuthStore(s => s.currentWorkspaceId);\n  const uid = useAuthStore(s => s.user?.uid);\n  const transactions = useLedgerStore(s => s.transactions);');

fs.writeFileSync(file, content);
