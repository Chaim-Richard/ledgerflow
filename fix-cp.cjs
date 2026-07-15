const fs = require('fs');
let code = fs.readFileSync('./src/components/layout/CommandPalette.tsx', 'utf8');

// The match helper needs to handle undefined:
code = code.replace(/const match = \(str: string\) => {/g, 'const match = (str?: string) => {');
fs.writeFileSync('./src/components/layout/CommandPalette.tsx', code);

// Fix Sales.tsx
let salesCode = fs.readFileSync('./src/components/sales/Sales.tsx', 'utf8');
salesCode = salesCode.replace(/inv\.tags\?/g, '(inv as any).tags?');
fs.writeFileSync('./src/components/sales/Sales.tsx', salesCode);

