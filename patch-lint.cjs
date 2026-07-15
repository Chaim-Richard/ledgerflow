const fs = require('fs');

// Patch CommandPalette.tsx
let cpCode = fs.readFileSync('./src/components/layout/CommandPalette.tsx', 'utf8');
cpCode = cpCode.replace(/let results = \[\];/g, 'let results: any[] = [];');
cpCode = cpCode.replace(/fuse\.search\(search\)/g, 'fuse.search(search || "")');
fs.writeFileSync('./src/components/layout/CommandPalette.tsx', cpCode);

// Patch IntelligenceCenter.tsx
let icCode = fs.readFileSync('./src/components/intelligence/IntelligenceCenter.tsx', 'utf8');
icCode = icCode.replace(/const activeTabDef = INTELLIGENCE_TABS_REGISTRY\.find\(t => t\.id === activeTab\);/, 
  'const activeTabDef = INTELLIGENCE_TABS_REGISTRY.find((t: any) => t.id === activeTab);');
fs.writeFileSync('./src/components/intelligence/IntelligenceCenter.tsx', icCode);

// Patch Purchases.tsx
let purCode = fs.readFileSync('./src/components/purchases/Purchases.tsx', 'utf8');
purCode = purCode.replace(/const tagCount = bill\.tags\?/g, 'const tagCount = (bill as any).tags?');
fs.writeFileSync('./src/components/purchases/Purchases.tsx', purCode);

// Patch Sales.tsx
let salesCode = fs.readFileSync('./src/components/sales/Sales.tsx', 'utf8');
salesCode = salesCode.replace(/const tagCount = inv\.tags\?/g, 'const tagCount = (inv as any).tags?');
fs.writeFileSync('./src/components/sales/Sales.tsx', salesCode);

