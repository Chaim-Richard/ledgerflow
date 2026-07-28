const fs = require('fs');
let code = fs.readFileSync('src/config/registry.tsx', 'utf8');

if (!code.includes("id: 'export'")) {
  code = code.replace(
    /\{ id: 'shortcuts', label:/,
    "{ id: 'export', label: { en: 'Backup & Export', he: 'גיבוי וייצוא' }, componentName: 'ExportView', icon: Database },\n  { id: 'shortcuts', label:"
  );

  code = code.replace(
    /'ShortcutsView': lazy/,
    "'ExportView': lazy(() => import('../components/platform/settings/BackupExportSettings')),\n  'ShortcutsView': lazy"
  );
  
  if (!code.includes('Database')) {
    code = code.replace('import { ', 'import { Database, ');
  }

  fs.writeFileSync('src/config/registry.tsx', code);
}
