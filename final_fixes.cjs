const fs = require('fs');

// App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/import \{ useCommandDispatcher, useSystemProps \} from '\.\/hooks\/useSystemContext';/, 'import { useCommandDispatcher } from \'./hooks/useSystemContext\';');
app = app.replace(/coreSystemProps=\{coreSystemProps\}/g, '');
fs.writeFileSync('src/App.tsx', app);

// Inventory.tsx
let inv = fs.readFileSync('src/components/inventory/Inventory.tsx', 'utf8');
inv = inv.replace(/import \{ useLedgerStore \} from '\.\.\/\.\.\/stores\/useLedgerStore';\n[\s\S]*?import \{ useLedgerStore \} from '\.\.\/\.\.\/stores\/useLedgerStore';/, 'import { useLedgerStore } from \'../../stores/useLedgerStore\';');
fs.writeFileSync('src/components/inventory/Inventory.tsx', inv);

// Ledger.tsx
let ledg = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');
ledg = ledg.replace(/workspaceId: workspaceId,/g, 'workspaceId: workspaceId || "",');
ledg = ledg.replace(/user: user,/g, 'user: user || {} as any,');
fs.writeFileSync('src/components/ledger/Ledger.tsx', ledg);

