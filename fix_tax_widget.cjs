const fs = require('fs');
let file = 'src/components/finance/TaxReserveWidget.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/return calculateSafeToSpend\(transactions, accounts, taxRate \/ 100\);/g, 'return calculateSafeToSpend(transactions, accounts);');
txt = txt.replace(/const rawCash = taxReserveResult\.rawCash;/g, 'const rawCash = taxReserveResult.rawCashCents;');
txt = txt.replace(/const estimatedTax = taxReserveResult\.estimatedTax;/g, 'const estimatedTax = taxReserveResult.estimatedTaxCents;');

fs.writeFileSync(file, txt);
