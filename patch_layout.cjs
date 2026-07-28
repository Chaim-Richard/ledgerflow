const fs = require('fs');

// Patch RootLayout.tsx
let layout = fs.readFileSync('src/core/layout/RootLayout.tsx', 'utf8');
if (!layout.includes('qboMigration: useUIStore(state => state.isQBOMigrationOpen)')) {
  layout = layout.replace(
    'importer: useUIStore(state => state.isImporterOpen),',
    'importer: useUIStore(state => state.isImporterOpen),\n    qboMigration: useUIStore(state => state.isQBOMigrationOpen),'
  );
  layout = layout.replace(
    'closeImporter: () => useUIStore.getState().setImporterOpen(false),',
    'closeImporter: () => useUIStore.getState().setImporterOpen(false),\n    closeQBOMigration: () => useUIStore.getState().setQBOMigrationOpen(false),'
  );
  fs.writeFileSync('src/core/layout/RootLayout.tsx', layout);
}

// Patch CommandPortal.tsx
let portal = fs.readFileSync('src/components/layout/CommandPortal.tsx', 'utf8');
if (!portal.includes('qboMigration: boolean;')) {
  portal = portal.replace(
    'importer: boolean;',
    'importer: boolean;\n    qboMigration: boolean;'
  );
  portal = portal.replace(
    'closeImporter: () => void;',
    'closeImporter: () => void;\n    closeQBOMigration: () => void;'
  );
  
  if (!portal.includes('import QBOMigrationWizard')) {
    portal = portal.replace(
      'import StatementImporter',
      'import QBOMigrationWizard from \'../migration/QBOMigrationWizard\';\nimport StatementImporter'
    );
  }

  const qboBlock = `
      {modals.qboMigration && (
        <QBOMigrationWizard 
          isOpen={modals.qboMigration}
          onClose={handlers.closeQBOMigration}
        />
      )}
  `;
  
  portal = portal.replace(
    '{modals.importer && (',
    qboBlock.trim() + '\n      {modals.importer && ('
  );
  
  fs.writeFileSync('src/components/layout/CommandPortal.tsx', portal);
}
