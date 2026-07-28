const fs = require('fs');
let code = fs.readFileSync('src/stores/useUIStore.ts', 'utf8');

if (!code.includes('isQBOMigrationOpen')) {
  code = code.replace('isImporterOpen: boolean;', 'isImporterOpen: boolean;\n  isQBOMigrationOpen: boolean;');
  code = code.replace('isImporterOpen: false,', 'isImporterOpen: false,\n  isQBOMigrationOpen: false,');
  code = code.replace('setImporterOpen: (isImporterOpen) => set({ isImporterOpen }),', 'setImporterOpen: (isImporterOpen) => set({ isImporterOpen }),\n  setQBOMigrationOpen: (isQBOMigrationOpen) => set({ isQBOMigrationOpen }),');
  
  code = code.replace('setImporterOpen: (open: boolean) => void;', 'setImporterOpen: (open: boolean) => void;\n  setQBOMigrationOpen: (open: boolean) => void;');
  fs.writeFileSync('src/stores/useUIStore.ts', code);
}
