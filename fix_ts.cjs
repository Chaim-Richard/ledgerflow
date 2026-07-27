const fs = require('fs');

// Fix Vault
let vault = fs.readFileSync('src/components/forensics/Vault.tsx', 'utf8');
vault = vault.replace(/workspaceId,/g, 'workspaceId: workspaceId || "",');
vault = vault.replace(/uid,/g, 'uid: uid || "",');
fs.writeFileSync('src/components/forensics/Vault.tsx', vault);

// Fix Inventory
let inv = fs.readFileSync('src/components/inventory/Inventory.tsx', 'utf8');
inv = inv.replace(/workspaceId,/g, 'workspaceId: workspaceId || "",');
inv = inv.replace(/uid,/g, 'uid: uid || "",');
fs.writeFileSync('src/components/inventory/Inventory.tsx', inv);

// Fix Ledger
let ledger = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');
ledger = ledger.replace(/user\.uid/g, 'user?.uid || ""');
ledger = ledger.replace(/user\.email/g, 'user?.email || ""');
ledger = ledger.replace(/workspaceId \|\| 'TEMP_WS'/g, 'workspaceId || "TEMP_WS"');
fs.writeFileSync('src/components/ledger/Ledger.tsx', ledger);

// Fix Projects
let proj = fs.readFileSync('src/components/projects/Projects.tsx', 'utf8');
proj = proj.replace(/user\.uid/g, 'user?.uid || ""');
proj = proj.replace(/user\.email/g, 'user?.email || ""');
fs.writeFileSync('src/components/projects/Projects.tsx', proj);

