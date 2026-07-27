const fs = require('fs');

// Fix Inventory.tsx
let inv = fs.readFileSync('src/components/inventory/Inventory.tsx', 'utf8');
inv = inv.replace(/..\/..\/modules\/intelligence\/StrategicEngine/, '../../services/strategicEngine');
fs.writeFileSync('src/components/inventory/Inventory.tsx', inv);

// Fix Ledger.tsx
let ledg = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');
// Fix user issues
ledg = ledg.replace(/user: user as any,/g, 'user: (user || {} as any),');
ledg = ledg.replace(/const user = useAuthStore\(s => s.user\);/g, 'const user = useAuthStore(s => s.user) || ({} as any);');
ledg = ledg.replace(/workspaceId: workspaceId \|\| "",/g, 'workspaceId: workspaceId || "",');

// Just replace everything about `account: accounts.find(a => a.id === id)?.name` with `account: accounts.find(a => a.id === id)?.name || ""` globally
ledg = ledg.replace(/account: accounts\.find\(a => a\.id === id\)\?\.name/g, 'account: accounts.find(a => a.id === id)?.name || ""');
fs.writeFileSync('src/components/ledger/Ledger.tsx', ledg);
