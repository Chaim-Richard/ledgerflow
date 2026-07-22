const fs = require('fs');
let code = fs.readFileSync('src/components/transactions/TransactionEditModal.tsx', 'utf8');

const target1 = `const calculatedTotal = lines.reduce((acc, l) => acc + Math.abs(l.amountCents || 0), 0) / 2;`;
const rep1 = `const calculatedTotal = TruthEngine.deriveSignedTotal(lines, accounts);`;

const target2 = `totalAmountCents: Math.round(calculatedTotal)`;
const rep2 = `totalAmountCents: calculatedTotal`;

code = code.replace(target1, rep1);
code = code.replace(target2, rep2);

if(!code.includes('TruthEngine')) {
  code = code.replace(`import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';`, `import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';\nimport { TruthEngine } from '../../modules/integrity/TruthEngine';`);
}

fs.writeFileSync('src/components/transactions/TransactionEditModal.tsx', code);
console.log("Patched TransactionEditModal!");
