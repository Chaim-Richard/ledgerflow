const fs = require('fs');
const path = require('path');

let validatorPath = path.join(__dirname, 'src/kernel/validation/DoubleEntryValidator.ts');
let validator = fs.readFileSync(validatorPath, 'utf8');

validator = validator.replace(
  `    transaction.lines = transaction.lines.filter(l => l.accountId !== 'fx-rounding');
    const netImpact = transaction.lines.reduce((sum, line) => {`,
  `    const lines = transaction.lines.filter(l => l.accountId !== 'fx-rounding');
    const netImpact = lines.reduce((sum, line) => {`
);

validator = validator.replace(
  `    // Automatically balance sub-cent floating point precision discrepancies (<= 10 cents)
    if (!netImpact.isZero()) {
      if (netImpact.abs().lte(10)) {
        // Create synthetic balancing line
        transaction.lines.push({
          id: \`\${transaction.id}-fx-balance\`,
          accountId: 'fx-rounding',
          accountName: 'FX Rounding Adjustment',
          amountCents: netImpact.negated().toNumber(),
          description: 'Synthetic balancing line for floating point discrepancy',
        } as any);
      } else {`,
  `    // Automatically allow sub-cent floating point precision discrepancies (<= 10 cents)
    if (!netImpact.isZero()) {
      if (netImpact.abs().lte(10)) {
        // It's acceptable, we don't mutate the transaction here to avoid breaking state
        return true;
      } else {`
);
fs.writeFileSync(validatorPath, validator);
console.log("Fixed DoubleEntryValidator.");
