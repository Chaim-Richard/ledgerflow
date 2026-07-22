const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/Inventory.tsx', 'utf8');

code = code.replace(/quantityAtHand: parseInt\(formData.get\('quantity'\) as string\),/g, "quantityAtHand: parseInt(formData.get('quantity') as string, 10) || 0,");
code = code.replace(/reorderPoint: parseInt\(formData.get\('reorderPoint'\) as string\),/g, "reorderPoint: parseInt(formData.get('reorderPoint') as string, 10) || 0,");
code = code.replace(/unitsPerPackage: formData.get\('unitsPerPackage'\) \? parseInt\(formData.get\('unitsPerPackage'\) as string\) : undefined/g, "unitsPerPackage: formData.get('unitsPerPackage') ? parseInt(formData.get('unitsPerPackage') as string, 10) || 1 : undefined");

fs.writeFileSync('src/components/inventory/Inventory.tsx', code);
