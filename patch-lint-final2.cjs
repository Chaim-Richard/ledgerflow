const fs = require('fs');

let typesCode = fs.readFileSync('./src/types.ts', 'utf8');

// I removed metadata earlier, but they're still used in the code. Let's add them back everywhere safely using a standard regex
typesCode = typesCode.replace(/tags\?: string\[\];/g, 'tags?: string[]; metadata?: Record<string, any>;');
// Then to fix duplicates:
typesCode = typesCode.replace(/(metadata\?: Record<string, any>;\s*)+/g, 'metadata?: Record<string, any>;');
fs.writeFileSync('./src/types.ts', typesCode);

// Fix IntelligenceCenter again, my last patch missed something maybe
let icCode = fs.readFileSync('./src/components/intelligence/IntelligenceCenter.tsx', 'utf8');
icCode = icCode.replace(/activeTabDef\.componentName/g, '(activeTabDef as any).componentName');
fs.writeFileSync('./src/components/intelligence/IntelligenceCenter.tsx', icCode);

// Fix Sales tags usage
let salesCode = fs.readFileSync('./src/components/sales/Sales.tsx', 'utf8');
salesCode = salesCode.replace(/inv\.tags/g, '(inv as any).tags');
fs.writeFileSync('./src/components/sales/Sales.tsx', salesCode);

