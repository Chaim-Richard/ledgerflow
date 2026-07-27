const fs = require('fs');
let ledg = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');
ledg = ledg.replace(/user=\{user\}/g, 'user={user as any}');
ledg = ledg.replace(/workspaceId=\{workspaceId\}/g, 'workspaceId={workspaceId || ""}');
fs.writeFileSync('src/components/ledger/Ledger.tsx', ledg);
