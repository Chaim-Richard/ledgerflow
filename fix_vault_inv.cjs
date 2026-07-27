const fs = require('fs');
let file = 'src/components/forensics/Vault.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\[workspaceId: workspaceId \|\| "", uid\]/, '[workspaceId, uid]');
content = content.replace(/\[workspaceId: workspaceId \|\| "", uid: uid \|\| "",\]/, '[workspaceId, uid]');
fs.writeFileSync(file, content);

file = 'src/components/inventory/Inventory.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/\[workspaceId: workspaceId \|\| "", uid\]/, '[workspaceId, uid]');
content = content.replace(/\[workspaceId: workspaceId \|\| "", uid: uid \|\| "",\]/, '[workspaceId, uid]');
fs.writeFileSync(file, content);
