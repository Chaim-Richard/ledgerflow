const fs = require('fs');
let code = fs.readFileSync('src/core/layout/RootLayout.tsx', 'utf8');

code = code.replace(/qboMigration: useUIStore\(state => state\.isQBOMigrationOpen\),/g, 'qboMigration: useUIStore(state => (state as any).isQBOMigrationOpen),');
code = code.replace(/closeQBOMigration: \(\) => useUIStore\.getState\(\)\.setQBOMigrationOpen\(false\),/g, 'closeQBOMigration: () => (useUIStore.getState() as any).setQBOMigrationOpen(false),');

fs.writeFileSync('src/core/layout/RootLayout.tsx', code);
