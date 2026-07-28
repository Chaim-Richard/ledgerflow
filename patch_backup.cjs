const fs = require('fs');
let code = fs.readFileSync('src/components/platform/settings/BackupExportSettings.tsx', 'utf8');

code = code.replace(
  /const categoryName = accounts\.find\(a => a\.id === t\.categoryId\)\?.name \|\| 'Uncategorized';/,
  "const categoryName = t.lines && t.lines.length > 0 ? t.lines[0].accountName || 'Split' : 'Uncategorized';"
);

code = code.replace(
  /const amountStr = \(t\.type === 'expense' \? -Math\.abs\(t\.amount\) : Math\.abs\(t\.amount\)\)\.toString\(\);/,
  "const amountStr = ((t.totalAmountCents || 0) / 100).toFixed(2);"
);

code = code.replace(
  /t\.type,/g,
  "(t as any).type || 'actual',"
);

code = code.replace(
  /t\.status,/g,
  "(t as any).status || 'posted',"
);

code = code.replace(
  /\`\"\$\{\(t\.reference \|\| \'\'\)\.replace\(\/\"\/g, \'\"\"\'\)\}\"\`/g,
  "`\"${((t as any).reference || '').replace(/\"/g, '\"\"')}\"`"
);

fs.writeFileSync('src/components/platform/settings/BackupExportSettings.tsx', code);
